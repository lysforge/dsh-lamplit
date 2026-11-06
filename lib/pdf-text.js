/**
 * lib/pdf-text.js —— 零依赖 PDF 文本抽取
 *
 * 只依赖 node:zlib 与 Node 内置 API（TextDecoder / Buffer）。
 *
 * 设计取舍：
 *  - 不信任 xref：直接扫描 `N G obj ... endobj`，交叉引用流/xref 表坏掉也能兜底；
 *    页面树走不通时再扫所有内容流。
 *  - 内容流支持 FlateDecode / ASCIIHex / ASCII85 / RunLength / LZW。
 *  - 文本算子：Tj / TJ / ' / "，定位：Td / TD / T* / TL / Tm / Tf / T* / cm / q / Q。
 *  - ToUnicode CMap（beginbfchar / beginbfrange，UTF-16BE 目标）映射 CID；
 *    无法映射的字形返回空串，不产生乱码。
 *  - 版面：同 baseline 合并、按几何间距补空格、按行距/缩进/短行切段，
 *    重复绘制（伪粗体/阴影）去重，最后压缩空白。
 *  - 同时给出「文字层检测」：pageCount / hasTextLayer / textDensity，
 *    供阅读器决定走排版阅读还是提示扫描件（OCR）。
 */

import { inflateSync, inflateRawSync, constants as zlibConstants } from 'node:zlib';

const IDENTITY = [1, 0, 0, 1, 0, 0];

/* ------------------------------------------------------------------ */
/* 基础工具                                                            */
/* ------------------------------------------------------------------ */

function isWsCode(c) {
  return c === 0x00 || c === 0x09 || c === 0x0a || c === 0x0c || c === 0x0d || c === 0x20;
}

const DELIM_CODES = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);

function isDelimCode(c) {
  return DELIM_CODES.has(c);
}

function toInt(v) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null;
}

function mul(m1, m2) {
  return [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
  ];
}

const CJK_RE = /[\u2e80-\u9fff\u3000-\u303f\u3400-\u4dbf\uf900-\ufaff\uff00-\uffef]/;

function isCJKChar(ch) {
  return !!ch && CJK_RE.test(ch);
}

/* ------------------------------------------------------------------ */
/* PDF 对象语法解析                                                    */
/* ------------------------------------------------------------------ */

class Ref {
  constructor(num) {
    this.num = num;
  }
}

function isRef(v) {
  return v instanceof Ref;
}

class PdfParser {
  constructor(src, pos = 0) {
    this.s = src;
    this.i = pos;
  }

  skip() {
    const s = this.s;
    while (this.i < s.length) {
      const c = s.charCodeAt(this.i);
      if (isWsCode(c)) {
        this.i++;
      } else if (c === 0x25) {
        while (this.i < s.length && s.charCodeAt(this.i) !== 0x0a && s.charCodeAt(this.i) !== 0x0d) this.i++;
      } else {
        break;
      }
    }
  }

  parseName() {
    const s = this.s;
    if (s[this.i] !== '/') return '';
    this.i++;
    let out = '';
    while (this.i < s.length) {
      const c = s.charCodeAt(this.i);
      if (isWsCode(c) || isDelimCode(c)) break;
      if (c === 0x23) {
        const hex = s.slice(this.i + 1, this.i + 3);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16));
          this.i += 3;
          continue;
        }
      }
      out += s[this.i];
      this.i++;
    }
    return out;
  }

  parseLiteral() {
    const s = this.s;
    this.i++; // '('
    const out = [];
    let depth = 1;
    while (this.i < s.length) {
      const c = s.charCodeAt(this.i++);
      if (c === 0x5c) {
        if (this.i >= s.length) break;
        const e = s.charCodeAt(this.i++);
        switch (e) {
          case 0x6e: out.push(10); break; // \n
          case 0x72: out.push(13); break; // \r
          case 0x74: out.push(9); break; // \t
          case 0x62: out.push(8); break; // \b
          case 0x66: out.push(12); break; // \f
          case 0x28: out.push(40); break;
          case 0x29: out.push(41); break;
          case 0x5c: out.push(92); break;
          case 0x0d: if (s.charCodeAt(this.i) === 0x0a) this.i++; break;
          case 0x0a: break;
          default:
            if (e >= 0x30 && e <= 0x37) {
              let oct = e - 0x30;
              for (let k = 0; k < 2; k++) {
                const d = s.charCodeAt(this.i);
                if (d >= 0x30 && d <= 0x37) {
                  oct = oct * 8 + (d - 0x30);
                  this.i++;
                } else break;
              }
              out.push(oct & 0xff);
            } else {
              out.push(e & 0xff);
            }
        }
      } else if (c === 0x28) {
        depth++;
        out.push(40);
      } else if (c === 0x29) {
        depth--;
        if (depth === 0) break;
        out.push(41);
      } else if (c === 0x0d) {
        out.push(10);
        if (s.charCodeAt(this.i) === 0x0a) this.i++;
      } else if (c === 0x0a) {
        out.push(10);
      } else {
        out.push(c & 0xff);
      }
    }
    return Buffer.from(out);
  }

  parseHex() {
    const s = this.s;
    this.i++; // '<'
    let hex = '';
    while (this.i < s.length) {
      const ch = s[this.i++];
      if (ch === '>') break;
      if (/[0-9a-fA-F]/.test(ch)) hex += ch;
    }
    if (hex.length % 2) hex += '0';
    const out = Buffer.alloc(hex.length / 2);
    for (let k = 0; k < out.length; k++) out[k] = parseInt(hex.slice(k * 2, k * 2 + 2), 16);
    return out;
  }

  parseNumber() {
    const m = /^[+-]?(?:\d+\.?\d*|\.\d+)/.exec(this.s.slice(this.i));
    if (!m) return null;
    this.i += m[0].length;
    return Number(m[0]);
  }

  parseNumberOrRef() {
    const num = this.parseNumber();
    if (num === null) return null;
    if (!Number.isInteger(num)) return num;
    const save = this.i;
    this.skip();
    const gen = this.parseNumber();
    if (gen !== null && Number.isInteger(gen)) {
      this.skip();
      const c = this.s[this.i];
      const next = this.s[this.i + 1] || '';
      if (c === 'R' && !/[A-Za-z0-9]/.test(next)) {
        this.i++;
        return new Ref(num);
      }
    }
    this.i = save;
    return num;
  }

  parseArray() {
    const s = this.s;
    this.i++; // '['
    const arr = [];
    while (this.i < s.length) {
      this.skip();
      if (s[this.i] === ']') {
        this.i++;
        break;
      }
      const before = this.i;
      const v = this.parseValue();
      if (this.i === before) {
        this.i++;
        continue;
      }
      arr.push(v);
    }
    return arr;
  }

  parseDict() {
    const s = this.s;
    if (!s.startsWith('<<', this.i)) return {};
    this.i += 2;
    const dict = {};
    while (this.i < s.length) {
      this.skip();
      if (s.startsWith('>>', this.i)) {
        this.i += 2;
        break;
      }
      if (s[this.i] !== '/') {
        const before = this.i;
        this.parseValue();
        if (this.i === before) this.i++;
        continue;
      }
      const key = this.parseName();
      this.skip();
      if (s.startsWith('>>', this.i)) {
        dict[key] = null;
        this.i += 2;
        break;
      }
      const val = this.parseValue();
      dict[key] = val;
    }
    return dict;
  }

  parseValue() {
    this.skip();
    const s = this.s;
    if (this.i >= s.length) return null;
    const ch = s[this.i];
    if (ch === '<' && s[this.i + 1] === '<') return this.parseDict();
    if (ch === '[') return this.parseArray();
    if (ch === '(') return this.parseLiteral();
    if (ch === '<') return this.parseHex();
    if (ch === '/') return this.parseName();
    if (ch === '+' || ch === '-' || ch === '.' || (ch >= '0' && ch <= '9')) return this.parseNumberOrRef();

    const start = this.i;
    while (this.i < s.length) {
      const c = s.charCodeAt(this.i);
      if (isWsCode(c) || isDelimCode(c)) break;
      this.i++;
    }
    if (this.i === start) {
      this.i++;
      return null;
    }
    const word = s.slice(start, this.i);
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (word === 'null') return null;
    return word;
  }
}

/* ------------------------------------------------------------------ */
/* 对象扫描（不依赖 xref）                                             */
/* ------------------------------------------------------------------ */

function parseIndirect(src, start, num, pos) {
  const p = new PdfParser(src, start);
  p.skip();
  let dict = null;
  let value = null;
  if (src.startsWith('<<', p.i)) {
    dict = p.parseDict();
    value = dict;
  } else {
    value = p.parseValue();
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !Buffer.isBuffer(value) &&
      !isRef(value)
    ) {
      dict = value;
    }
  }

  p.skip();
  let stream = null;
  let streamStart = null;
  if (src.startsWith('stream', p.i) && !/[A-Za-z0-9]/.test(src[p.i + 6] || '')) {
    let ds = p.i + 6;
    if (src[ds] === '\r') ds++;
    if (src[ds] === '\n') ds++;
    streamStart = ds;

    let end = -1;
    const directLen = dict ? toInt(dict.Length) : null;
    if (directLen !== null && directLen >= 0) {
      const cand = ds + directLen;
      if (cand <= src.length && /^\s*endstream/.test(src.slice(cand, cand + 12))) end = cand;
    }
    if (end < 0) {
      const es = src.indexOf('endstream', ds);
      if (es >= 0) {
        end = es;
        if (src[end - 1] === '\n') end--;
        if (src[end - 1] === '\r') end--;
      } else {
        end = src.length;
      }
    }
    stream = Buffer.from(src.slice(ds, end), 'latin1');
    p.i = end;
  }

  const eo = src.indexOf('endobj', p.i);
  const objEnd = eo >= 0 ? eo + 6 : Math.min(src.length, p.i + 1);
  return { num, dict, value, stream, streamStart, pos, objEnd };
}

function scanObjects(src) {
  const objs = new Map();
  const re = /(\d{1,10})\s+(\d{1,5})\s+obj\b/g;
  let m;
  while ((m = re.exec(src))) {
    const num = Number(m[1]);
    const bodyStart = m.index + m[0].length;
    let parsed = null;
    try {
      parsed = parseIndirect(src, bodyStart, num, m.index);
    } catch {
      parsed = null;
    }
    if (parsed) {
      const prev = objs.get(num);
      if (!prev || parsed.pos >= prev.pos) objs.set(num, parsed);
      re.lastIndex = Math.max(parsed.objEnd, bodyStart + 1);
    } else {
      re.lastIndex = bodyStart + 1;
    }
  }
  return objs;
}

function deref(v, objs, depth = 0) {
  let cur = v;
  while (isRef(cur) && depth++ < 32) {
    const e = objs.get(cur.num);
    if (!e) return null;
    cur = e.dict !== null && e.dict !== undefined ? e.dict : e.value;
  }
  return cur;
}

function entryOf(v, objs) {
  if (isRef(v)) return objs.get(v.num) || null;
  if (v && typeof v === 'object' && v.stream) return v;
  return null;
}

function fixStreamLengths(objs, raw) {
  for (const o of objs.values()) {
    if (typeof o.streamStart !== 'number' || !o.dict) continue;
    const len = toInt(deref(o.dict.Length, objs));
    if (len === null || len < 0 || o.streamStart + len > raw.length) continue;
    if (!/^\s*endstream/.test(raw.slice(o.streamStart + len, o.streamStart + len + 16))) continue;
    o.stream = Buffer.from(raw.slice(o.streamStart, o.streamStart + len), 'latin1');
  }
}

function expandObjectStreams(objs) {
  const list = [...objs.values()].filter((o) => o.dict && o.dict.Type === 'ObjStm' && o.stream);
  for (const os of list) {
    let data = null;
    try {
      data = decodeStream(os, objs);
    } catch {
      data = null;
    }
    if (!data) continue;
    const text = data.toString('latin1');
    const n = toInt(deref(os.dict.N, objs));
    const first = toInt(deref(os.dict.First, objs));
    if (n === null || first === null || n <= 0 || n > 100000) continue;

    const nums = [];
    const re = /\d+/g;
    let m;
    while (nums.length < n * 2 && (m = re.exec(text))) nums.push(Number(m[0]));
    if (nums.length < n * 2) continue;

    for (let k = 0; k < n; k++) {
      const objNum = nums[k * 2];
      const off = nums[k * 2 + 1];
      const from = first + off;
      const to = k + 1 < n ? first + nums[(k + 1) * 2 + 1] : text.length;
      if (from < 0 || from >= to || from >= text.length) continue;
      const sub = text.slice(from, to);
      let val = null;
      try {
        const p = new PdfParser(sub, 0);
        val = p.parseValue();
      } catch {
        continue;
      }
      let d = null;
      if (
        val &&
        typeof val === 'object' &&
        !Array.isArray(val) &&
        !Buffer.isBuffer(val) &&
        !isRef(val)
      ) {
        d = val;
      }
      const prev = objs.get(objNum);
      if (!prev || os.pos >= prev.pos) {
        objs.set(objNum, {
          num: objNum,
          dict: d,
          value: val,
          stream: null,
          streamStart: null,
          pos: os.pos + 0.5,
        });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 流过滤器                                                            */
/* ------------------------------------------------------------------ */

function inflateData(data) {
  const opts = { finishFlush: zlibConstants.Z_SYNC_FLUSH };
  try {
    return inflateSync(data, opts);
  } catch {
    /* 继续尝试 */
  }
  try {
    return inflateRawSync(data, opts);
  } catch {
    /* 继续尝试 */
  }
  try {
    return inflateRawSync(data.subarray(2), opts);
  } catch {
    return null;
  }
}

function decodeASCIIHex(data) {
  const s = data.toString('latin1');
  let hex = '';
  for (const ch of s) {
    if (ch === '>') break;
    if (/[0-9a-fA-F]/.test(ch)) hex += ch;
  }
  if (hex.length % 2) hex += '0';
  const out = Buffer.alloc(hex.length / 2);
  for (let k = 0; k < out.length; k++) out[k] = parseInt(hex.slice(k * 2, k * 2 + 2), 16);
  return out;
}

function decodeASCII85(data) {
  const s = data.toString('latin1');
  const out = [];
  let group = [];
  let start = 0;
  if (s.startsWith('<~')) start = 2;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === '~') break;
    if (isWsCode(ch.charCodeAt(0))) continue;
    if (ch === 'z' && group.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    const v = s.charCodeAt(i) - 33;
    if (v < 0 || v > 84) continue;
    group.push(v);
    if (group.length === 5) {
      let n = 0;
      for (const g of group) n = n * 85 + g;
      out.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
      group = [];
    }
  }
  if (group.length) {
    const take = group.length - 1;
    while (group.length < 5) group.push(84);
    let n = 0;
    for (const g of group) n = n * 85 + g;
    const bytes = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    out.push(...bytes.slice(0, take));
  }
  return Buffer.from(out);
}

function decodeRunLength(data) {
  const out = [];
  let i = 0;
  while (i < data.length) {
    const n = data[i++];
    if (n === 128) break;
    if (n < 128) {
      const take = n + 1;
      for (let k = 0; k < take && i < data.length; k++) out.push(data[i++]);
    } else {
      if (i >= data.length) break;
      const b = data[i++];
      for (let k = 0; k < 257 - n; k++) out.push(b);
    }
  }
  return Buffer.from(out);
}

function decodeLZW(data, earlyChange = 1) {
  const out = [];
  let dict = [];
  const reset = () => {
    dict = [];
    for (let i = 0; i < 256; i++) dict.push([i]);
    dict.push(null); // 256 clear
    dict.push(null); // 257 eod
  };
  reset();
  let codeLen = 9;
  let bitBuf = 0;
  let bitCnt = 0;
  let prev = null;

  for (let i = 0; i < data.length; i++) {
    bitBuf = ((bitBuf << 8) | data[i]) >>> 0;
    bitCnt += 8;
    while (bitCnt >= codeLen) {
      const code = (bitBuf >>> (bitCnt - codeLen)) & ((1 << codeLen) - 1);
      bitCnt -= codeLen;
      bitBuf &= (1 << bitCnt) - 1;
      if (code === 256) {
        reset();
        codeLen = 9;
        prev = null;
        continue;
      }
      if (code === 257) return Buffer.from(out);
      let entry;
      if (code < dict.length && dict[code]) entry = dict[code].slice();
      else if (prev) entry = prev.concat([prev[0]]);
      else continue;
      out.push(...entry);
      if (prev) dict.push(prev.concat([entry[0]]));
      prev = entry;
      if (dict.length + earlyChange >= 1 << codeLen && codeLen < 12) codeLen++;
    }
  }
  return Buffer.from(out);
}

function applyPredictor(data, parms, objs) {
  const p = deref(parms, objs);
  if (!p || typeof p !== 'object') return data;
  const predictor = toInt(deref(p.Predictor, objs)) || 1;
  if (predictor < 2) return data;
  const colors = toInt(deref(p.Colors, objs)) || 1;
  const bpc = toInt(deref(p.BitsPerComponent, objs)) || 8;
  const columns = toInt(deref(p.Columns, objs)) || 1;
  const bpp = Math.max(1, Math.ceil((colors * bpc) / 8));
  const rowLen = Math.ceil((columns * colors * bpc) / 8);
  if (rowLen <= 0) return data;

  if (predictor === 2) {
    // TIFF predictor，只处理 8bit
    if (bpc !== 8) return data;
    const out = Buffer.from(data);
    for (let off = 0; off + rowLen <= out.length; off += rowLen) {
      for (let i = bpp; i < rowLen; i++) out[off + i] = (out[off + i] + out[off + i - bpp]) & 0xff;
    }
    return out;
  }

  // PNG predictor 10..15
  const rows = [];
  let prev = new Uint8Array(rowLen);
  for (let off = 0; off + 1 + rowLen <= data.length; off += rowLen + 1) {
    const ft = data[off];
    const row = Uint8Array.from(data.subarray(off + 1, off + 1 + rowLen));
    for (let i = 0; i < rowLen; i++) {
      const left = i >= bpp ? row[i - bpp] : 0;
      const up = prev[i];
      const ul = i >= bpp ? prev[i - bpp] : 0;
      let add = 0;
      if (ft === 1) add = left;
      else if (ft === 2) add = up;
      else if (ft === 3) add = (left + up) >> 1;
      else if (ft === 4) {
        const pa = Math.abs(up - ul);
        const pb = Math.abs(left - ul);
        const pc = Math.abs(left + up - 2 * ul);
        add = pa <= pb && pa <= pc ? left : pb <= pc ? up : ul;
      }
      row[i] = (row[i] + add) & 0xff;
    }
    rows.push(Buffer.from(row));
    prev = row;
  }
  return Buffer.concat(rows);
}

function decodeStream(entry, objs, depth = 0) {
  if (!entry || !entry.stream || depth > 4) return null;
  let data = entry.stream;
  let filters = deref(entry.dict.Filter, objs);
  if (filters === null || filters === undefined) return data;
  const parms = deref(entry.dict.DecodeParms, objs) ?? deref(entry.dict.DP, objs);

  const filterList = Array.isArray(filters) ? filters : [filters];
  const parmList = Array.isArray(parms) ? parms : [parms];

  for (let k = 0; k < filterList.length; k++) {
    const f = deref(filterList[k], objs);
    const parm = parmList[k] ?? parmList[0] ?? null;
    switch (f) {
      case 'FlateDecode':
      case 'Fl':
        data = inflateData(data);
        if (data && parm) data = applyPredictor(data, parm, objs);
        break;
      case 'ASCIIHexDecode':
      case 'AHx':
        data = decodeASCIIHex(data);
        break;
      case 'ASCII85Decode':
      case 'A85':
        data = decodeASCII85(data);
        break;
      case 'RunLengthDecode':
      case 'RL':
        data = decodeRunLength(data);
        break;
      case 'LZWDecode':
      case 'LZW': {
        const early = parm ? toInt(deref(parm.EarlyChange, objs)) : 1;
        data = decodeLZW(data, early === 0 ? 0 : 1);
        break;
      }
      case 'Crypt':
        // 未解密，无法继续
        return null;
      default:
        // DCT / JPX / JBIG2 / CCITT 等图像编码，不含文本
        return null;
    }
    if (!data) return null;
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* ToUnicode CMap                                                     */
/* ------------------------------------------------------------------ */

function hexToBuffer(hex) {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const even = clean.length % 2 ? clean + '0' : clean;
  const out = Buffer.alloc(even.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(even.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bufferToInt(buf) {
  let n = 0;
  for (let i = 0; i < buf.length && i < 4; i++) n = n * 256 + buf[i];
  return n;
}

function utf16beToString(buf) {
  let s = '';
  for (let i = 0; i + 1 < buf.length; i += 2) s += String.fromCharCode((buf[i] << 8) | buf[i + 1]);
  if (buf.length % 2 === 1) s += String.fromCharCode(buf[buf.length - 1]);
  return s;
}

function utf16Units(buf) {
  const units = [];
  for (let i = 0; i + 1 < buf.length; i += 2) units.push((buf[i] << 8) | buf[i + 1]);
  return units;
}

function unitsToString(units) {
  let s = '';
  for (const u of units) s += String.fromCharCode(u & 0xffff);
  return s;
}

function addToUnits(units, delta) {
  const out = units.slice();
  let carry = delta;
  for (let i = out.length - 1; i >= 0 && carry > 0; i--) {
    const v = out[i] + carry;
    out[i] = v & 0xffff;
    carry = v >> 16;
  }
  return out;
}

function parseCMap(src) {
  const map = new Map();
  let codeBytes = null;

  const cs = /begincodespacerange([\s\S]*?)endcodespacerange/.exec(src);
  if (cs) {
    const re = /<([0-9a-fA-F\s]*)>/g;
    let m;
    while ((m = re.exec(cs[1]))) {
      const len = hexToBuffer(m[1]).length;
      if (len > 0 && (codeBytes === null || len > codeBytes)) codeBytes = len;
    }
  }

  let block = /beginbfchar([\s\S]*?)endbfchar/g;
  let m;
  while ((m = block.exec(src))) {
    const body = m[1];
    const re = /<([0-9a-fA-F\s]*)>\s*(?:<([0-9a-fA-F\s]*)>|\/([^\s<>\[\]/]+))/g;
    let mm;
    while ((mm = re.exec(body))) {
      const code = bufferToInt(hexToBuffer(mm[1]));
      let val = '';
      if (mm[2] !== undefined) val = utf16beToString(hexToBuffer(mm[2]));
      else if (mm[3] !== undefined) val = glyphToUnicode(mm[3]) || '';
      map.set(code, val);
    }
  }

  block = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = block.exec(src))) {
    const body = m[1];
    const re = /<([0-9a-fA-F\s]*)>\s*<([0-9a-fA-F\s]*)>\s*(?:<([0-9a-fA-F\s]*)>|\[([\s\S]*?)\])/g;
    let mm;
    while ((mm = re.exec(body))) {
      const lo = bufferToInt(hexToBuffer(mm[1]));
      const hi = bufferToInt(hexToBuffer(mm[2]));
      if (hi < lo || hi - lo > 65535) continue;
      if (mm[3] !== undefined) {
        const units = utf16Units(hexToBuffer(mm[3]));
        for (let code = lo; code <= hi; code++) {
          map.set(code, unitsToString(addToUnits(units, code - lo)));
        }
      } else if (mm[4] !== undefined) {
        const arr = [];
        const ar = /<([0-9a-fA-F\s]*)>/g;
        let am;
        while ((am = ar.exec(mm[4]))) arr.push(utf16beToString(hexToBuffer(am[1])));
        for (let code = lo; code <= hi; code++) {
          const idx = code - lo;
          if (idx >= arr.length) break;
          map.set(code, arr[idx]);
        }
      }
    }
  }

  return { map, codeBytes };
}

/* ------------------------------------------------------------------ */
/* 字形名 → Unicode（/Differences 用）                                 */
/* ------------------------------------------------------------------ */

const GLYPHS = {
  space: ' ', exclam: '!', quotedbl: '"', numbersign: '#', dollar: '$', percent: '%',
  ampersand: '&', quotesingle: "'", parenleft: '(', parenright: ')', asterisk: '*',
  plus: '+', comma: ',', hyphen: '-', period: '.', slash: '/', colon: ':', semicolon: ';',
  less: '<', equal: '=', greater: '>', question: '?', at: '@', bracketleft: '[',
  backslash: '\\', bracketright: ']', asciicircum: '^', underscore: '_', grave: '`',
  braceleft: '{', bar: '|', braceright: '}', asciitilde: '~',
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7',
  eight: '8', nine: '9', quoteleft: '‘', quoteright: '’', quotedblleft: '“',
  quotedblright: '”', quotesinglbase: '‚', quotedblbase: '„', endash: '–', emdash: '—',
  bullet: '•', ellipsis: '…', dagger: '†', daggerdbl: '‡', perthousand: '‰',
  trademark: '™', copyright: '©', registered: '®', degree: '°', plusminus: '±',
  multiply: '×', divide: '÷', fraction: '⁄', florin: 'ƒ', guillemotleft: '«',
  guillemotright: '»', guilsinglleft: '‹', guilsinglright: '›', section: '§',
  paragraph: '¶', periodcentered: '·', middot: '·', cedilla: '¸', acute: '´',
  dieresis: '¨', macron: '¯', circumflex: 'ˆ', tilde: '˜', caron: 'ˇ', breve: '˘',
  dotaccent: '˙', ring: '˚', ogonek: '˛', germandbls: 'ß', ae: 'æ', AE: 'Æ', oe: 'œ',
  OE: 'Œ', oslash: 'ø', Oslash: 'Ø', sterling: '£', yen: '¥', cent: '¢', euro: '€',
  nbspace: ' ', sfthyphen: '­', dotlessi: 'ı', Lslash: 'Ł', lslash: 'ł', Zcaron: 'Ž',
  zcaron: 'ž', fi: 'fi', fl: 'fl', ff: 'ff', ffi: 'ffi', ffl: 'ffl', mu: 'µ',
  micro: 'µ', ordfeminine: 'ª', ordmasculine: 'º', onesuperior: '¹',
  twosuperior: '²', threesuperior: '³', onequarter: '¼', onehalf: '½',
  threequarters: '¾', brokenbar: '¦', logicalnot: '¬', minus: '−', notequal: '≠',
  lessequal: '≤', greaterequal: '≥', infinity: '∞', integral: '∫', radical: '√',
  approxequal: '≈', Delta: 'Δ', Omega: 'Ω', pi: 'π', summation: '∑', product: '∏',
};

function glyphToUnicode(name) {
  if (!name) return '';
  if (name.length === 1) return name;
  if (GLYPHS[name] !== undefined) return GLYPHS[name];
  if (name.length === 2 && /^[A-Za-z]$/.test(name)) return name;
  let m = /^uni([0-9A-Fa-f]{4,})$/.exec(name);
  if (m) {
    let s = '';
    for (let i = 0; i + 4 <= m[1].length; i += 4) s += String.fromCharCode(parseInt(m[1].slice(i, i + 4), 16));
    return s;
  }
  m = /^u([0-9A-Fa-f]{4,6})$/.exec(name);
  if (m) return String.fromCodePoint(parseInt(m[1], 16));
  return '';
}

const WIN_ANSI_EXTRA = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
  0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘',
  0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜',
  0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};

let macRomanTable = null;

function macRomanChar(code) {
  if (!macRomanTable) {
    macRomanTable = new Array(256).fill('');
    try {
      const td = new TextDecoder('macintosh');
      for (let i = 0; i < 256; i++) {
        const s = td.decode(Uint8Array.of(i));
        macRomanTable[i] = s.includes('\uFFFD') ? '' : s;
      }
    } catch {
      for (let i = 0; i < 256; i++) macRomanTable[i] = i >= 32 && i < 127 ? String.fromCharCode(i) : '';
    }
  }
  return macRomanTable[code] || '';
}

function singleByteChar(code, kind) {
  if (code < 32 || code === 127) return '';
  if (code >= 32 && code <= 126) return String.fromCharCode(code);
  if (kind === 'winansi') return WIN_ANSI_EXTRA[code] || (code >= 0xa0 ? String.fromCharCode(code) : '');
  if (kind === 'macroman') return macRomanChar(code);
  if (code >= 0xa0) return String.fromCharCode(code);
  return '';
}

/* ------------------------------------------------------------------ */
/* 字体                                                               */
/* ------------------------------------------------------------------ */

function parseCIDWidths(desc, objs) {
  const map = new Map();
  const w = deref(desc.W, objs);
  if (!Array.isArray(w)) return map;
  let i = 0;
  while (i < w.length) {
    const first = toInt(deref(w[i], objs));
    if (first === null) {
      i++;
      continue;
    }
    const second = deref(w[i + 1], objs);
    if (Array.isArray(second)) {
      for (let k = 0; k < second.length; k++) {
        const v = toInt(deref(second[k], objs));
        if (v !== null) map.set(first + k, v);
      }
      i += 2;
    } else {
      const last = toInt(deref(w[i + 1], objs));
      const val = toInt(deref(w[i + 2], objs));
      if (last !== null && val !== null) {
        for (let c = first; c <= last && c - first < 65536; c++) map.set(c, val);
      }
      i += 3;
    }
  }
  return map;
}

function buildFont(fontDict, objs) {
  if (
    !fontDict ||
    typeof fontDict !== 'object' ||
    Array.isArray(fontDict) ||
    Buffer.isBuffer(fontDict) ||
    isRef(fontDict)
  ) {
    return null;
  }

  const type0 = fontDict.Subtype === 'Type0';
  const descArr = type0 ? deref(fontDict.DescendantFonts, objs) : null;
  const desc = type0 && Array.isArray(descArr) ? deref(descArr[0], objs) || {} : fontDict;

  let cmap = null;
  let cmapCodeBytes = null;
  const toUniEntry = entryOf(fontDict.ToUnicode, objs);
  if (toUniEntry) {
    try {
      const data = decodeStream(toUniEntry, objs);
      if (data) {
        const parsed = parseCMap(data.toString('latin1'));
        cmap = parsed.map;
        cmapCodeBytes = parsed.codeBytes;
      }
    } catch {
      cmap = null;
    }
  }

  const enc = deref(fontDict.Encoding, objs);
  let encName = null;
  let custom = null;
  if (typeof enc === 'string') {
    encName = enc;
  } else if (enc && typeof enc === 'object' && !Array.isArray(enc) && !Buffer.isBuffer(enc) && !isRef(enc)) {
    if (typeof enc.BaseEncoding === 'string') encName = enc.BaseEncoding;
    const diffs = deref(enc.Differences, objs);
    if (Array.isArray(diffs)) {
      custom = new Map();
      let code = 0;
      for (const item of diffs) {
        if (typeof item === 'number') code = item;
        else if (typeof item === 'string') {
          const u = glyphToUnicode(item);
          if (u) custom.set(code, u);
          code++;
        }
      }
    }
  }

  let kind = 'latin1';
  let codeBytes = 1;
  if (type0) {
    codeBytes = cmapCodeBytes || 2;
    if (cmap) kind = 'cid';
    else if (encName && /UCS2|UTF16|UCS-2/i.test(encName)) kind = 'ucs2';
    else if (encName && /GBK|GB-EUC|EUC-CN|GBpc|GBKp|GBK2K|GB18030/i.test(encName)) kind = 'gbk';
    else if (encName && /Big5|B5/i.test(encName)) kind = 'big5';
    else kind = 'cid';
  } else {
    codeBytes = 1;
    if (encName === 'MacRomanEncoding') kind = 'macroman';
    else if (encName && /WinAnsi/i.test(encName)) kind = 'winansi';
    else kind = 'latin1';
  }

  let widthMap = new Map();
  let defaultWidth = type0 ? 1000 : 500;
  if (type0) {
    const dw = toInt(deref(desc.DW, objs));
    if (dw !== null) defaultWidth = dw;
    widthMap = parseCIDWidths(desc, objs);
  } else {
    const fc = toInt(deref(fontDict.FirstChar, objs)) ?? 0;
    const widths = deref(fontDict.Widths, objs);
    if (Array.isArray(widths)) {
      for (let k = 0; k < widths.length; k++) {
        const v = toInt(deref(widths[k], objs));
        if (v !== null) widthMap.set(fc + k, v);
      }
    }
    const fd = deref(fontDict.FontDescriptor, objs);
    if (fd && typeof fd === 'object') {
      const mw = toInt(deref(fd.MissingWidth, objs));
      if (mw !== null) defaultWidth = mw;
    }
  }

  return { type0, kind, codeBytes, cmap, custom, widthMap, defaultWidth };
}

let gbkDecoder = null;
let big5Decoder = null;

function multibyteDecode(font, bytes) {
  let td = null;
  try {
    if (font.kind === 'gbk') {
      if (!gbkDecoder) gbkDecoder = new TextDecoder('gbk');
      td = gbkDecoder;
    } else {
      if (!big5Decoder) big5Decoder = new TextDecoder('big5');
      td = big5Decoder;
    }
    let text = td.decode(bytes).replace(/\uFFFD/g, '');
    let width = 0;
    let codes = 0;
    for (const ch of text) {
      codes++;
      width += isCJKChar(ch) ? 1000 : 500;
    }
    return { text, width, codes, spaces: 0 };
  } catch {
    return { text: '', width: 0, codes: 0, spaces: 0 };
  }
}

function decodeWithFont(font, bytes) {
  if (!bytes || !bytes.length) return { text: '', width: 0, codes: 0, spaces: 0 };

  if (font.kind === 'gbk' || font.kind === 'big5') return multibyteDecode(font, bytes);

  if (font.kind === 'ucs2') {
    let text = '';
    let width = 0;
    let codes = 0;
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const code = (bytes[i] << 8) | bytes[i + 1];
      text += String.fromCharCode(code);
      codes++;
      width += font.widthMap.get(code) ?? font.defaultWidth;
    }
    return { text, width, codes, spaces: 0 };
  }

  const step = font.codeBytes === 2 ? 2 : 1;
  let text = '';
  let width = 0;
  let codes = 0;
  let spaces = 0;

  for (let i = 0; i + step <= bytes.length; i += step) {
    let code = 0;
    for (let k = 0; k < step; k++) code = (code << 8) | bytes[i + k];
    codes++;
    if (step === 1 && code === 32) spaces++;

    let ch = null;
    if (font.cmap && font.cmap.has(code)) ch = font.cmap.get(code);
    else if (step === 1 && font.custom && font.custom.has(code)) ch = font.custom.get(code);
    else if (step === 1) ch = singleByteChar(code, font.kind);
    else ch = '';

    text += ch || '';
    width += font.widthMap.get(code) ?? font.defaultWidth;
  }

  return { text, width, codes, spaces };
}

function decodeRawText(bytes) {
  let text = '';
  for (const b of bytes) {
    if (b >= 32 && b < 127) text += String.fromCharCode(b);
  }
  return { text, width: text.length * 500, codes: bytes.length, spaces: 0 };
}

/* ------------------------------------------------------------------ */
/* 内容流词法                                                          */
/* ------------------------------------------------------------------ */

function* tokenizeContent(src) {
  const p = new PdfParser(src, 0);

  while (true) {
    p.skip();
    if (p.i >= src.length) break;
    const ch = src[p.i];

    if (ch === '(') {
      yield { t: 'str', bytes: p.parseLiteral() };
      continue;
    }
    if (ch === '<' && src[p.i + 1] === '<') {
      p.parseDict();
      yield { t: 'dict' };
      continue;
    }
    if (ch === '<') {
      yield { t: 'str', bytes: p.parseHex() };
      continue;
    }
    if (ch === '[') {
      const arr = p.parseArray();
      yield { t: 'arr', items: arr };
      continue;
    }
    if (ch === '/') {
      yield { t: 'name', value: p.parseName() };
      continue;
    }
    if (ch === ']' || ch === '}' || ch === ')' || ch === '>') {
      p.i++;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '.' || (ch >= '0' && ch <= '9')) {
      const n = p.parseNumber();
      if (n !== null) {
        yield { t: 'num', value: n };
        continue;
      }
    }

    const start = p.i;
    while (p.i < src.length) {
      const c = src.charCodeAt(p.i);
      if (isWsCode(c) || isDelimCode(c)) break;
      p.i++;
    }
    if (p.i === start) {
      p.i++;
      continue;
    }
    const op = src.slice(start, p.i);
    yield { t: 'op', value: op };

    // 内联图像的二进制数据：一直跳到 EI
    if (op === 'ID') {
      const re = /\sEI(?=\s|$)/g;
      re.lastIndex = p.i;
      const m = re.exec(src);
      p.i = m ? m.index + m[0].length : src.length;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 内容流解释器                                                        */
/* ------------------------------------------------------------------ */

function numOperand(tok) {
  return tok && tok.t === 'num' ? tok.value : 0;
}

function nameOperand(tok) {
  return tok && tok.t === 'name' ? tok.value : null;
}

function interpretContent(content, state) {
  const tokens = tokenizeContent(content);
  const textState = {
    tm: IDENTITY.slice(),
    tlm: IDENTITY.slice(),
    font: null,
    fontSize: 0,
    leading: 0,
    charSpace: 0,
    wordSpace: 0,
    hscale: 1,
    rise: 0,
  };
  let ctm = (state.ctm || IDENTITY).slice();
  const saved = [];
  let operands = [];

  const show = (token) => {
    let bytes = null;
    if (token && token.t === 'str') bytes = token.bytes;
    else if (Buffer.isBuffer(token)) bytes = token;
    if (!bytes || !bytes.length) return;

    const font = textState.font;
    const decoded = font ? decodeWithFont(font, bytes) : decodeRawText(bytes);
    const fs = textState.fontSize;
    const hscale = textState.hscale;

    const full = mul(textState.tm, ctm);
    const yScale = Math.hypot(full[2], full[3]) || 1;
    const xScale = Math.hypot(full[0], full[1]) || 1;
    const size = Math.abs(fs) * yScale || Math.abs(fs) || 10;

    const advance =
      (decoded.width / 1000) * fs + textState.charSpace * decoded.codes + textState.wordSpace * decoded.spaces;

    if (decoded.text && decoded.text.trim()) {
      state.fragments.push({
        x: full[4],
        y: full[5] + textState.rise * yScale,
        size,
        advance: advance * hscale * xScale,
        text: decoded.text,
      });
    }

    textState.tm = mul([1, 0, 0, 1, advance * hscale, 0], textState.tm);
  };

  const moveLine = (tx, ty) => {
    textState.tlm = mul([1, 0, 0, 1, tx, ty], textState.tlm);
    textState.tm = textState.tlm.slice();
  };

  const drawXObject = (name) => {
    if (!name || state.depth >= 6) return;
    const xo = deref(state.xobjects, state.objs);
    if (!xo || typeof xo !== 'object' || Array.isArray(xo)) return;
    const entry = entryOf(xo[name], state.objs);
    if (!entry || !entry.stream || !entry.dict) return;
    if (entry.dict.Subtype !== 'Form') return;

    const data = decodeStream(entry, state.objs);
    if (!data) return;

    let childCtm = ctm;
    const matrix = deref(entry.dict.Matrix, state.objs);
    if (Array.isArray(matrix) && matrix.length >= 6) {
      childCtm = mul(matrix.slice(0, 6).map((v) => Number(v) || 0), ctm);
    }

    const childRes = entry.dict.Resources !== undefined ? entry.dict.Resources : state.resources;
    const childFonts = state.fonts ? new Map(state.fonts) : new Map();
    mergeFonts(childFonts, childRes, state.objs);

    const childResDict = deref(childRes, state.objs);
    const childXObjects =
      childResDict && typeof childResDict === 'object' && !Array.isArray(childResDict)
        ? childResDict.XObject
        : state.xobjects;

    interpretContent(data.toString('latin1'), {
      objs: state.objs,
      fonts: childFonts,
      xobjects: childXObjects || state.xobjects,
      resources: childRes,
      ctm: childCtm,
      fragments: state.fragments,
      depth: state.depth + 1,
    });
  };

  for (const tok of tokens) {
    if (tok.t !== 'op') {
      operands.push(tok);
      continue;
    }

    const op = tok.value;
    switch (op) {
      case 'q':
        saved.push({
          ctm: ctm.slice(),
          tm: textState.tm.slice(),
          tlm: textState.tlm.slice(),
          font: textState.font,
          fontSize: textState.fontSize,
          leading: textState.leading,
          charSpace: textState.charSpace,
          wordSpace: textState.wordSpace,
          hscale: textState.hscale,
          rise: textState.rise,
        });
        break;
      case 'Q': {
        const st = saved.pop();
        if (st) {
          ctm = st.ctm;
          textState.tm = st.tm;
          textState.tlm = st.tlm;
          textState.font = st.font;
          textState.fontSize = st.fontSize;
          textState.leading = st.leading;
          textState.charSpace = st.charSpace;
          textState.wordSpace = st.wordSpace;
          textState.hscale = st.hscale;
          textState.rise = st.rise;
        }
        break;
      }
      case 'cm': {
        if (operands.length >= 6) {
          const m = operands.slice(-6).map((v) => numOperand(v));
          ctm = mul(m, ctm);
        }
        break;
      }
      case 'BT':
        textState.tm = IDENTITY.slice();
        textState.tlm = IDENTITY.slice();
        break;
      case 'ET':
        break;
      case 'Tf': {
        const name = nameOperand(operands[0]);
        const size = numOperand(operands[1]);
        textState.font = (state.fonts && state.fonts.get(name)) || null;
        textState.fontSize = size;
        break;
      }
      case 'TL':
        textState.leading = numOperand(operands[0]);
        break;
      case 'Tc':
        textState.charSpace = numOperand(operands[0]);
        break;
      case 'Tw':
        textState.wordSpace = numOperand(operands[0]);
        break;
      case 'Tz':
        textState.hscale = numOperand(operands[0]) / 100;
        break;
      case 'Ts':
        textState.rise = numOperand(operands[0]);
        break;
      case 'Td':
        moveLine(numOperand(operands[0]), numOperand(operands[1]));
        break;
      case 'TD':
        textState.leading = -numOperand(operands[1]);
        moveLine(numOperand(operands[0]), numOperand(operands[1]));
        break;
      case 'Tm': {
        if (operands.length >= 6) {
          const m = operands.slice(-6).map((v) => numOperand(v));
          textState.tm = m;
          textState.tlm = m.slice();
        }
        break;
      }
      case 'T*':
        moveLine(0, -textState.leading);
        break;
      case 'Tj':
        show(operands[operands.length - 1]);
        break;
      case 'TJ': {
        const arrTok = operands[operands.length - 1];
        const arr = arrTok && arrTok.t === 'arr' ? arrTok.items : [];
        for (const item of arr) {
          if (typeof item === 'number') {
            const tx = (-item / 1000) * textState.fontSize * textState.hscale;
            textState.tm = mul([1, 0, 0, 1, tx, 0], textState.tm);
          } else if (item && item.t === 'str') {
            show(item);
          } else if (Buffer.isBuffer(item)) {
            show({ t: 'str', bytes: item });
          }
        }
        break;
      }
      case "'":
        moveLine(0, -textState.leading);
        show(operands[operands.length - 1]);
        break;
      case '"': {
        const aw = numOperand(operands[0]);
        const ac = numOperand(operands[1]);
        textState.wordSpace = aw;
        textState.charSpace = ac;
        moveLine(0, -textState.leading);
        show(operands[operands.length - 1]);
        break;
      }
      case 'Do':
        drawXObject(nameOperand(operands[0]));
        break;
      default:
        break;
    }
    operands = [];
  }
}

/* ------------------------------------------------------------------ */
/* 版面重建                                                            */
/* ------------------------------------------------------------------ */

function normalizeFragmentText(t) {
  return String(t)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim();
}

function joinLines(a, b) {
  if (!a) return b;
  if (!b) return a;
  const last = a[a.length - 1];
  const first = b[0];
  if (last === '-' && /[a-z]/.test(first)) return a.slice(0, -1) + first;
  if (isCJKChar(last) || isCJKChar(first)) return a + b;
  if (/[，。！？；：、）》”’]/.test(last)) return a + b;
  if (/^[，。！？；：、]/.test(first)) return a + b;
  return a + ' ' + b;
}

function fragmentsToText(fragments) {
  const clean = [];
  for (const f of fragments) {
    if (!f || typeof f.text !== 'string') continue;
    const raw = f.text;
    if (!raw) continue;
    const leadSpace = /^\s/.test(raw);
    const trailSpace = /\s$/.test(raw);
    const text = normalizeFragmentText(raw);
    // 纯空白片段也保留：它代表一个真实的空格位移，由行内合并消费
    if (!text && !leadSpace) continue;
    clean.push({
      x: f.x,
      y: f.y,
      size: Math.max(1, f.size || 10),
      advance: Math.max(0, f.advance || 0),
      text,
      leadSpace,
      trailSpace,
    });
  }
  if (!clean.length) return '';

  clean.sort((a, b) => b.y - a.y || a.x - b.x);

  // 去重叠重复：只处理「同一原点重复绘制」的伪粗体/阴影，避免误删相邻字符
  const kept = [];
  for (const f of clean) {
    let dup = false;
    for (let j = kept.length - 1; j >= 0; j--) {
      const p = kept[j];
      const size = Math.max(p.size, f.size);
      if (p.y - f.y > Math.max(2, size * 0.6)) break;
      if (f.text === '' || p.text === '') continue;
      if (Math.abs(p.y - f.y) > Math.max(0.8, size * 0.2)) continue;
      const dx = Math.abs(p.x - f.x);
      if (dx > Math.max(1, size * 0.2)) continue;
      if (p.text === f.text) {
        dup = true;
        break;
      }
      // 同一原点、一份完整包含另一份（回填/描边）才算重复
      if (dx <= 0.75 && (p.text.includes(f.text) || f.text.includes(p.text))) {
        dup = true;
        break;
      }
    }
    if (!dup) kept.push(f);
  }

  // 同 baseline 合并成行
  const lines = [];
  for (const f of kept) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - f.y) <= Math.max(1.5, Math.max(last.size, f.size) * 0.35)) {
      last.items.push(f);
      last.size = Math.max(last.size, f.size);
    } else {
      lines.push({ y: f.y, size: f.size, items: [f] });
    }
  }

  // 行内按 x 排序，按几何间距与空格片段补空格
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    let text = '';
    let endX = -Infinity;
    let prev = null;
    let pendingSpace = false;
    let maxGap = 0;
    for (const it of line.items) {
      if (!it.text) {
        if (text) pendingSpace = true;
        endX = Math.max(endX, it.x + it.advance);
        prev = it;
        continue;
      }
      if (!text) {
        text = it.text;
        endX = it.x + it.advance;
        prev = it;
        line.startX = it.x;
        pendingSpace = false;
        continue;
      }
      const gap = it.x - endX;
      if (Number.isFinite(gap)) maxGap = Math.max(maxGap, gap);
      const size = Math.max(it.size, prev ? prev.size : it.size);
      let sep = '';
      if (pendingSpace || it.leadSpace || (prev && prev.trailSpace)) sep = ' ';
      if (gap > Math.max(0.6, size * 0.12)) {
        const a = text[text.length - 1];
        const b = it.text[0];
        const cjkTight = isCJKChar(a) && isCJKChar(b) && gap < size * 0.8;
        if (!cjkTight) sep = ' ';
      }
      if (sep === ' ' && text.endsWith(' ')) sep = '';
      text += sep + it.text;
      endX = Math.max(endX, it.x + it.advance);
      prev = it;
      pendingSpace = false;
    }
    line.text = text;
    line.startX = line.startX ?? 0;
    line.endX = endX === -Infinity ? line.startX : endX;
    // 一行里出现超宽空隙 → 表格/多栏行，单独成段，避免把表格行串成一段
    line.hasColumns = maxGap > Math.max(12, line.size * 3);
  }

  lines.sort((a, b) => b.y - a.y);

  const gaps = [];
  for (let i = 1; i < lines.length; i++) {
    const g = lines[i - 1].y - lines[i].y;
    if (g > 0.5) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;

  const sizes = lines.map((l) => l.size).sort((a, b) => a - b);
  const avgSize = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 10;

  const starts = lines.map((l) => l.startX).sort((a, b) => a - b);
  const left = starts.length ? starts[Math.floor(starts.length * 0.2)] : 0;
  const right = Math.max(...lines.map((l) => l.endX));
  const span = Math.max(1, right - left);

  const blocks = [];
  let cur = lines.length ? lines[0].text : '';
  for (let i = 1; i < lines.length; i++) {
    const prevLine = lines[i - 1];
    const line = lines[i];
    const gap = prevLine.y - line.y;

    let brk = false;
    if (gap > Math.max(medianGap * 1.55, avgSize * 1.7)) brk = true;
    // 首行缩进：只认「上一行顶满、本行从左边距附近缩进」的正文段落，
    // 排除居中的标题行（缩进很大）被误判成新段。
    const indent = line.startX - left;
    if (
      indent > avgSize * 0.9 &&
      indent < span * 0.35 &&
      prevLine.startX - left < avgSize * 0.9 &&
      prevLine.endX - left > span * 0.65
    ) {
      brk = true;
    }
    if (prevLine.endX < left + span * 0.55 && gap > Math.max(medianGap * 1.05, avgSize * 0.9)) brk = true;
    if (prevLine.hasColumns || line.hasColumns) brk = true;
    // 字号变化（标题→正文）才算分段；同一标题的多行字号一致，不应被拆开
    if (Math.abs(prevLine.size - line.size) > Math.max(2, avgSize * 0.3)) brk = true;

    if (brk) {
      blocks.push(cur);
      cur = line.text;
    } else {
      cur = joinLines(cur, line.text);
    }
  }
  if (cur) blocks.push(cur);

  return blocks.join('\n\n');
}

/* ------------------------------------------------------------------ */
/* 页面树 / 资源 / 页面文本                                            */
/* ------------------------------------------------------------------ */

function findCatalog(objs) {
  const catalogs = [...objs.values()]
    .filter((o) => o.dict && o.dict.Type === 'Catalog')
    .sort((a, b) => a.pos - b.pos);
  return catalogs.length ? catalogs[catalogs.length - 1].dict : null;
}

function collectPages(objs) {
  const pages = [];
  const seen = new Set();
  const catalog = findCatalog(objs);

  const walk = (ref, inherited) => {
    const entry = entryOf(ref, objs);
    if (!entry || !entry.dict) return;
    if (seen.has(entry.num)) return;
    seen.add(entry.num);

    const d = entry.dict;
    const resources = d.Resources !== undefined ? d.Resources : inherited.resources;
    const mediaBox = d.MediaBox !== undefined ? d.MediaBox : inherited.mediaBox;

    if (d.Type === 'Pages' || (d.Kids !== undefined && d.Contents === undefined)) {
      const kids = deref(d.Kids, objs);
      if (Array.isArray(kids)) for (const kid of kids) walk(kid, { resources, mediaBox });
      return;
    }
    if (d.Type === 'Page' || d.Contents !== undefined) {
      pages.push({ entry, dict: d, resources, mediaBox });
    }
  };

  if (catalog && catalog.Pages !== undefined) walk(catalog.Pages, {});

  const used = new Set(pages.map((p) => p.entry.num));
  for (const o of [...objs.values()].sort((a, b) => a.pos - b.pos)) {
    if (!o.dict || o.dict.Type !== 'Page' || used.has(o.num)) continue;
    pages.push({ entry: o, dict: o.dict, resources: o.dict.Resources, mediaBox: o.dict.MediaBox });
  }
  return pages;
}

function mergeFonts(base, resources, objs) {
  const res = deref(resources, objs);
  if (!res || typeof res !== 'object' || Array.isArray(res)) return base;
  const fd = deref(res.Font, objs);
  if (!fd || typeof fd !== 'object' || Array.isArray(fd)) return base;
  for (const [name, ref] of Object.entries(fd)) {
    const font = buildFont(deref(ref, objs), objs);
    if (font) base.set(name, font);
  }
  return base;
}

function collectGlobalFonts(objs) {
  const map = new Map();
  for (const o of objs.values()) {
    if (!o.dict || o.dict.Resources === undefined) continue;
    mergeFonts(map, o.dict.Resources, objs);
  }
  return map;
}

function pageContentBuffer(page, objs) {
  const chunks = [];
  const visit = (v, depth) => {
    if (depth > 8) return;
    if (isRef(v)) {
      const e = objs.get(v.num);
      if (e && e.stream) {
        const data = decodeStream(e, objs);
        if (data) chunks.push(data);
      }
    } else if (Array.isArray(v)) {
      for (const item of v) visit(item, depth + 1);
    }
  };
  visit(page.dict.Contents, 0);
  if (!chunks.length) return Buffer.alloc(0);
  return Buffer.from(chunks.map((c) => c.toString('latin1')).join('\n'), 'latin1');
}

function extractTextFromContent(data, resources, objs, globalFonts) {
  if (!data || !data.length) return '';
  const fonts = new Map(globalFonts || []);
  mergeFonts(fonts, resources, objs);

  const res = deref(resources, objs);
  const xobjects = res && typeof res === 'object' && !Array.isArray(res) ? res.XObject : null;

  const fragments = [];
  interpretContent(data.toString('latin1'), {
    objs,
    fonts,
    xobjects,
    resources: res || {},
    ctm: IDENTITY.slice(),
    fragments,
    depth: 0,
  });
  return fragmentsToText(fragments);
}

function fallbackContentStreams(objs) {
  const out = [];
  for (const o of [...objs.values()].sort((a, b) => a.pos - b.pos)) {
    if (!o.stream || !o.dict) continue;
    if (o.dict.Type === 'ObjStm' || o.dict.Type === 'XRef') continue;
    const data = decodeStream(o, objs);
    if (!data || data.length < 4) continue;
    const s = data.toString('latin1');
    if (!/\bBT\b/.test(s)) continue;
    if (!/(Tj|TJ)\b/.test(s)) continue;
    out.push(data);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 对外入口                                                            */
/* ------------------------------------------------------------------ */

function toBuffer(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  if (input && typeof input === 'object' && typeof input.length === 'number') return Buffer.from(input);
  return Buffer.alloc(0);
}

/**
 * 抽取 PDF 文字层。
 *
 * @param {Buffer|Uint8Array} buffer
 * @returns {{
 *   pages: Array<{ index: number, text: string }>,
 *   text: string,
 *   charCount: number,
 *   pageCount: number,
 *   hasTextLayer: boolean,
 *   textDensity: number,
 *   warnings: string[]
 * }}
 */
export function extractPdfText(buffer) {
  const buf = toBuffer(buffer);
  const head = buf.subarray(0, Math.min(buf.length, 1024)).toString('latin1');
  if (!head.includes('%PDF-')) throw new Error('not a pdf');

  const warnings = [];

  try {
    const raw = buf.toString('latin1');
    const objs = scanObjects(raw);
    fixStreamLengths(objs, raw);
    expandObjectStreams(objs);

    if (/\/Encrypt\s*(?:\d+\s+\d+\s+R|<<)/.test(raw)) warnings.push('encrypted');

    const globalFonts = collectGlobalFonts(objs);
    const pageList = collectPages(objs);
    const pages = [];

    if (pageList.length) {
      for (const page of pageList) {
        let text = '';
        try {
          const resources = deref(page.resources, objs);
          const data = pageContentBuffer(page, objs);
          text = extractTextFromContent(data, resources, objs, globalFonts);
        } catch {
          text = '';
        }
        pages.push({ index: pages.length, text });
      }
    } else {
      for (const data of fallbackContentStreams(objs)) {
        let text = '';
        try {
          text = extractTextFromContent(data, null, objs, globalFonts);
        } catch {
          text = '';
        }
        pages.push({ index: pages.length, text });
      }
    }

    const text = pages
      .map((p) => p.text)
      .filter((t) => t)
      .join('\n\n')
      .trim();

    const pageCount = pages.length;
    const charCount = text.length;
    // 文字层判据：每页平均至少 25 个字符（标题/页码不够，扫描件为 0）
    const textDensity = pageCount > 0 ? charCount / pageCount : 0;
    const hasTextLayer = pageCount > 0 && textDensity >= 25;

    if (!text) {
      warnings.push('no-text-layer');
      return {
        pages: pages.map((p, i) => ({ index: i, text: p.text })),
        text: '',
        charCount: 0,
        pageCount,
        hasTextLayer: false,
        textDensity: 0,
        warnings,
      };
    }

    return {
      pages: pages.map((p, i) => ({ index: i, text: p.text })),
      text,
      charCount,
      pageCount,
      hasTextLayer,
      textDensity,
      warnings,
    };
  } catch {
    warnings.push('parse-error', 'no-text-layer');
    return {
      pages: [],
      text: '',
      charCount: 0,
      pageCount: 0,
      hasTextLayer: false,
      textDensity: 0,
      warnings,
    };
  }
}
