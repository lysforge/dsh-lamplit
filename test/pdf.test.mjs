import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { extractPdfText } from '../lib/pdf-text.js';

/* ------------------------------------------------------------------ */
/* 手写 PDF 的小工具                                                   */
/* ------------------------------------------------------------------ */

function indirect(num, body) {
  return Buffer.concat([
    Buffer.from(`${num} 0 obj\n`, 'latin1'),
    Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1'),
    Buffer.from('\nendobj\n', 'latin1'),
  ]);
}

function streamBody(data, extra = '') {
  return Buffer.concat([
    Buffer.from(`<< /Length ${data.length}${extra ? ' ' + extra : ''} >>\nstream\n`, 'latin1'),
    data,
    Buffer.from('\nendstream', 'latin1'),
  ]);
}

function assemble(objects) {
  const parts = [Buffer.from('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  for (const [num, body] of objects) parts.push(indirect(num, body));
  parts.push(Buffer.from('trailer\n<< /Size 32 /Root 1 0 R >>\n%%EOF\n', 'latin1'));
  return Buffer.concat(parts);
}

function pageObjects({ pageNum = 3, contentNum = 5, resources = '/Resources << /Font << /F1 4 0 R >> >>' }) {
  return [
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [
      pageNum,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ${resources} /Contents ${contentNum} 0 R >>`,
    ],
  ];
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------------ */
/* 1. 最小 PDF：未压缩内容流 + ASCII Tj                                */
/* ------------------------------------------------------------------ */

test('最小 PDF：未压缩内容流里的 Tj 文本按顺序抽出', () => {
  const content =
    'BT /F1 24 Tf 72 720 Td (Hello Pillowbook) Tj 0 -32 Td (Second line) Tj 0 -32 Td (Third line) Tj ET';

  const pdf = assemble([
    ...pageObjects({}),
    [4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'],
    [5, streamBody(Buffer.from(content, 'latin1'))],
  ]);

  const res = extractPdfText(pdf);
  assert.equal(res.pages.length, 1);
  assert.equal(extractPdfText(new Uint8Array(pdf)).text, res.text);
  assert.equal(res.pages[0].index, 0);
  assert.equal(res.pageCount, 1);
  assert.equal(res.hasTextLayer, true);
  assert.ok(res.textDensity >= 25, `textDensity=${res.textDensity}`);

  const text = norm(res.text);
  assert.match(text, /Hello Pillowbook/);
  assert.match(text, /Second line/);
  assert.match(text, /Third line/);

  const i1 = text.indexOf('Hello Pillowbook');
  const i2 = text.indexOf('Second line');
  const i3 = text.indexOf('Third line');
  assert.ok(i1 >= 0 && i1 < i2 && i2 < i3, `文本顺序错误: ${text}`);
  assert.equal(res.charCount, res.text.length);
  assert.deepEqual(res.warnings, []);
});

/* ------------------------------------------------------------------ */
/* 2. Flate 压缩内容流                                                 */
/* ------------------------------------------------------------------ */

test('FlateDecode 内容流能被解压并抽取', () => {
  const content = 'BT /F1 14 Tf 72 700 Td (Compressed stream text) Tj 0 -20 Td (second compressed line) Tj ET';
  const z = deflateSync(Buffer.from(content, 'latin1'));

  const pdf = assemble([
    ...pageObjects({}),
    [4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'],
    [5, streamBody(z, '/Filter /FlateDecode')],
  ]);

  const res = extractPdfText(pdf);
  assert.equal(res.pageCount, 1);
  const text = norm(res.text);
  assert.match(text, /Compressed stream text/);
  assert.match(text, /second compressed line/);
});

/* ------------------------------------------------------------------ */
/* 2b. 多页 pageCount 与页序                                            */
/* ------------------------------------------------------------------ */

test('多页 PDF：pageCount、pages 顺序与全文拼接正确', () => {
  const c1 = 'BT /F1 12 Tf 72 700 Td (Page one text, long enough for the density check) Tj ET';
  const c2 = 'BT /F1 12 Tf 72 700 Td (Page two text, also long enough for it) Tj ET';

  const pdf = assemble([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>'],
    [3, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 7 0 R >> >> /Contents 5 0 R >>'],
    [4, '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>'],
    [5, streamBody(Buffer.from(c1, 'latin1'))],
    [6, streamBody(Buffer.from(c2, 'latin1'))],
    [7, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'],
  ]);

  const res = extractPdfText(pdf);
  assert.equal(res.pageCount, 2);
  assert.equal(res.pages.length, 2);
  assert.match(res.pages[0].text, /Page one/);
  assert.match(res.pages[1].text, /Page two/);
  assert.equal(res.text.indexOf('Page one') < res.text.indexOf('Page two'), true);
  assert.equal(res.hasTextLayer, true);
});

/* ------------------------------------------------------------------ */
/* 3. CID 字体 + ToUnicode CMap                                        */
/* ------------------------------------------------------------------ */

test('ToUnicode 的 bfchar/bfrange 能还原 CID 中文与 UTF-16BE 代理对', () => {
  const cmap = [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
    '4 beginbfchar',
    '<0041> <4F60>',
    '<0042> <597D>',
    '<0043> <4E16>',
    '<0044> <D83DDE00>',
    'endbfchar',
    '2 beginbfrange',
    '<0050> <0052> <754C>',
    '<0060> <0061> [<4E00> <4E8C>]',
    'endbfrange',
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n');

  // 你好 / 世界 / 畍畎 / 😀 / 一二（bfrange 数组目标）
  const content =
    'BT /F1 12 Tf 72 720 Td <00410042> Tj 0 -20 Td <00430050> Tj 0 -20 Td <00510052> Tj 0 -20 Td <0044> Tj 0 -20 Td <00600061> Tj ET';

  const pdf = assemble([
    ...pageObjects({ contentNum: 7 }),
    [
      4,
      '<< /Type /Font /Subtype /Type0 /BaseFont /PillowSong /Encoding /Identity-H /DescendantFonts [6 0 R] /ToUnicode 5 0 R >>',
    ],
    [5, streamBody(Buffer.from(cmap, 'latin1'))],
    [
      6,
      '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /PillowSong /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /DW 1000 >>',
    ],
    [7, streamBody(Buffer.from(content, 'latin1'))],
  ]);

  const res = extractPdfText(pdf);
  assert.equal(res.pageCount, 1);
  const text = res.text;
  assert.ok(text.includes('你好'), `未还原 bfchar 中文: ${JSON.stringify(text)}`);
  assert.ok(text.includes('世界'), `未还原 bfrange 中文: ${JSON.stringify(text)}`);
  assert.ok(text.includes('畍畎'), `bfrange 递增错误: ${JSON.stringify(text)}`);
  assert.ok(text.includes('😀'), `未还原 UTF-16BE 代理对: ${JSON.stringify(text)}`);
  assert.ok(text.includes('一二'), `bfrange 数组目标错误: ${JSON.stringify(text)}`);
});

/* ------------------------------------------------------------------ */
/* 3b. 对象流（PDF 1.5 ObjStm）里藏页面树                               */
/* ------------------------------------------------------------------ */

test('页面树在对象流里也能找到（无 xref）', () => {
  const content = 'BT /F1 12 Tf 72 700 Td (Object stream page) Tj ET';
  const inner = [
    ['1', '<< /Type /Catalog /Pages 2 0 R >>'],
    ['2', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [
      '3',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    ],
  ];

  let header = '';
  let bodies = '';
  for (const [num, body] of inner) {
    header += `${num} ${bodies.length} `;
    bodies += body + '\n';
  }
  const first = header.length;
  const objstm = deflateSync(Buffer.from(header + bodies, 'latin1'));

  const pdf = assemble([
    [4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'],
    [5, streamBody(Buffer.from(content, 'latin1'))],
    [
      10,
      Buffer.concat([
        Buffer.from(
          `<< /Type /ObjStm /N 3 /First ${first} /Length ${objstm.length} /Filter /FlateDecode >>\nstream\n`,
          'latin1',
        ),
        objstm,
        Buffer.from('\nendstream', 'latin1'),
      ]),
    ],
  ]);

  const res = extractPdfText(pdf);
  assert.equal(res.pages.length, 1);
  assert.equal(res.pageCount, 1);
  assert.match(norm(res.text), /Object stream page/);
});

/* ------------------------------------------------------------------ */
/* 4. 非 PDF                                                           */
/* ------------------------------------------------------------------ */

test('非 PDF 输入抛 not a pdf', () => {
  assert.throws(() => extractPdfText(Buffer.from('hello, this is not a pdf')), /not a pdf/);
  assert.throws(() => extractPdfText(Buffer.alloc(0)), /not a pdf/);
});

/* ------------------------------------------------------------------ */
/* 5. 无文本层（扫描件形态）不抛错                                     */
/* ------------------------------------------------------------------ */

test('只有图像 XObject、没有 Tj 文本：判为无文字层且不抛错', () => {
  const image = Buffer.from([0x00]);
  const pdf = assemble([
    ...pageObjects({ resources: '/Resources << /XObject << /Im1 6 0 R >> >>' }),
    [5, streamBody(Buffer.from('q 100 0 0 100 72 600 cm /Im1 Do Q', 'latin1'))],
    [
      6,
      Buffer.concat([
        Buffer.from(
          '<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n',
          'latin1',
        ),
        image,
        Buffer.from('\nendstream', 'latin1'),
      ]),
    ],
  ]);

  const res = extractPdfText(pdf);
  assert.equal(res.text, '');
  assert.equal(res.charCount, 0);
  assert.equal(res.pageCount, 1);
  assert.equal(res.hasTextLayer, false);
  assert.equal(res.textDensity, 0);
  assert.ok(res.warnings.includes('no-text-layer'), `warnings=${JSON.stringify(res.warnings)}`);
});

/* ------------------------------------------------------------------ */
/* 6. cupsfilter 真实 PDF 冒烟                                         */
/* ------------------------------------------------------------------ */

test('cupsfilter 生成的真实 PDF 能抽出非空文本', (t) => {
  if (process.platform !== 'darwin') {
    t.skip('cupsfilter 是 macOS 工具');
    return;
  }

  const dir = mkdtempSync(join(tmpdir(), 'lamplit-pdf-'));
  const txt = join(dir, 'hello.txt');
  const maxBuffer = 32 * 1024 * 1024;
  const sample = 'hello\nworld\nlamplit pdf text extraction smoke test\n';
  let pdf = null;

  try {
    writeFileSync(txt, sample);

    // 有的 macOS 版本接受文件参数；有的需要 stdin。两种都试。
    let run = spawnSync('cupsfilter', ['-m', 'application/pdf', txt], { maxBuffer });
    if (!run.error && run.status === 0 && run.stdout) {
      const out = Buffer.from(run.stdout);
      if (out.subarray(0, 5).toString('latin1') === '%PDF-') pdf = out;
    }

    if (!pdf) {
      run = spawnSync('cupsfilter', ['-m', 'application/pdf'], {
        input: sample,
        maxBuffer,
      });
      if (!run.error && run.status === 0 && run.stdout) {
        const out = Buffer.from(run.stdout);
        if (out.subarray(0, 5).toString('latin1') === '%PDF-') pdf = out;
      }
    }

    if (!pdf && run && run.error && run.error.code === 'ENOENT') {
      t.skip('cupsfilter 不存在');
      return;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  if (!pdf) {
    t.skip('cupsfilter 不可用');
    return;
  }

  const res = extractPdfText(pdf);
  assert.ok(res.text.trim().length > 0, '真实 PDF 抽出的文本为空');
  assert.ok(res.pageCount >= 1, `pageCount=${res.pageCount}`);
  assert.equal(res.hasTextLayer, true, `textDensity=${res.textDensity}`);
  assert.ok(res.textDensity > 0);
  const lower = res.text.toLowerCase();
  assert.match(lower, /hello/);
  assert.match(lower, /world/);
  assert.match(lower, /lamplit/);
});
