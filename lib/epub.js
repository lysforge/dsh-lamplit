/**
 * EPUB 解析（零依赖）：ZIP 目录 → container.xml → OPF → spine → XHTML → blocks。
 *
 * 这就是常规电子书阅读器的做法：**把书拆成 HTML 文档再排版**，而不是当成图片。
 * MOBI / AZW3 / KFX 不在支持范围：它们是亚马逊私有容器（KFX 还带 DRM），
 * 桌面阅读器也是先转换（Calibre / KindleUnpack）再读，界面上会给同样的提示。
 */
import zlib from 'node:zlib'

import { decodeEntities } from './text-util.js'

// ---- ZIP ------------------------------------------------------------------

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50

function findEocd(buffer) {
  const min = Math.max(0, buffer.length - 66000)
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD) return offset
  }
  return -1
}

/** @returns {Map<string, () => Buffer>} 文件名 → 惰性解压函数 */
function readZip(buffer) {
  const eocd = findEocd(buffer)
  if (eocd < 0) throw new Error('not a zip')
  const count = buffer.readUInt16LE(eocd + 10)
  let cursor = buffer.readUInt32LE(eocd + 16)
  const files = new Map()

  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== CENTRAL) break
    const method = buffer.readUInt16LE(cursor + 10)
    const compressedSize = buffer.readUInt32LE(cursor + 20)
    const uncompressedSize = buffer.readUInt32LE(cursor + 24)
    const nameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    const localOffset = buffer.readUInt32LE(cursor + 42)
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength)
    cursor += 46 + nameLength + extraLength + commentLength

    files.set(name, () => {
      if (buffer.readUInt32LE(localOffset) !== LOCAL) throw new Error(`bad local header: ${name}`)
      const localNameLength = buffer.readUInt16LE(localOffset + 26)
      const localExtraLength = buffer.readUInt16LE(localOffset + 28)
      const start = localOffset + 30 + localNameLength + localExtraLength
      const raw = buffer.subarray(start, start + compressedSize)
      if (method === 0) return Buffer.from(raw)
      if (method === 8) return zlib.inflateRawSync(raw)
      throw new Error(`unsupported zip compression: ${method}`)
    })
  }
  return files
}

// ---- XHTML → blocks -------------------------------------------------------

const BLOCK_TAGS = /<(p|div|h1|h2|h3|h4|h5|h6|blockquote|li|tr|section|article)\b[^>]*>/gi

const HEADING_MARK = '\u0001H'

export function htmlToBlocks(html) {
  let text = String(html ?? '')
  text = text.replace(/<\s*(script|style|head)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  text = text.replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level, inner) => {
    const label = String(inner).replace(/<[^>]+>/g, '').trim()
    return `\n${HEADING_MARK}${level}${HEADING_MARK}${label}\n`
  })
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<img\b[^>]*alt="([^"]*)"[^>]*>/gi, (_match, alt) => `\n〔图：${alt}〕\n`)
  text = text.replace(/<img\b[^>]*>/gi, '\n〔图〕\n')
  text = text.replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|blockquote|li|tr|section|article)>/gi, '\n')
  text = text.replace(BLOCK_TAGS, '\n')
  text = text.replace(/<[^>]+>/g, '')
  text = decodeEntities(text)

  const blocks = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/[ \t\u00a0]+/g, ' ').trim()
    if (line === '') continue
    if (line.startsWith(HEADING_MARK)) {
      const parts = line.split(HEADING_MARK)
      const level = Number(parts[1]) || 3
      const heading = String(parts.slice(2).join('')).trim()
      if (heading !== '') blocks.push({ t: 'h', l: Math.min(Math.max(level, 1), 3), x: heading })
      continue
    }
    blocks.push({ t: 'p', x: line })
  }
  return blocks
}

function firstHeading(html) {
  const match = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/i.exec(String(html))
  if (!match) return ''
  return decodeEntities(match[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

function tag(html, name) {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(String(html))
  if (!match) return ''
  return decodeEntities(match[1].replace(/<[^>]+>/g, '')).trim()
}

function resolvePath(base, href) {
  if (/^[a-z]+:/i.test(href)) return href
  const stack = base.split('/').filter((part) => part !== '' && part !== '.')
  for (const part of href.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return stack.join('/')
}

/**
 * @param {Buffer} buffer
 * @returns {{title: string, author: string, chapters: Array<{title, blocks}>, warnings: string[]}}
 */
export function parseEpub(buffer) {
  const files = readZip(buffer)
  const read = (name) => {
    const entry = files.get(name)
    if (!entry) return ''
    return entry().toString('utf8')
  }

  const container = read('META-INF/container.xml')
  const opfPath = /full-path="([^"]+)"/.exec(container)?.[1] ?? ''
  if (opfPath === '') throw new Error('epub 缺少 container.xml')
  const opf = read(opfPath)
  if (opf === '') throw new Error('epub 缺少 OPF')

  const title = tag(opf, 'dc:title') || tag(opf, 'title')
  const author = tag(opf, 'dc:creator') || tag(opf, 'creator')

  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : ''
  const manifest = new Map()
  for (const item of opf.matchAll(/<item\b[^>]*>/gi)) {
    const tagText = item[0]
    const id = /id="([^"]+)"/.exec(tagText)?.[1]
    const href = /href="([^"]+)"/.exec(tagText)?.[1]
    const type = /media-type="([^"]+)"/.exec(tagText)?.[1] ?? ''
    if (id && href) manifest.set(id, { href: resolvePath(base, href), type })
  }

  const spine = []
  for (const itemref of opf.matchAll(/<itemref\b[^>]*>/gi)) {
    const idref = /idref="([^"]+)"/.exec(itemref[0])?.[1]
    if (!idref) continue
    const item = manifest.get(idref)
    if (!item) continue
    if (!/html|xml/i.test(item.type)) continue
    spine.push(item.href)
  }
  if (spine.length === 0) throw new Error('epub 的 spine 是空的')

  // 目录标题（nav 或 ncx）
  const tocTitles = new Map()
  const navHref = [...manifest.values()].find((item) => /nav\.xhtml$/i.test(item.href))?.href
  const ncxHref = [...manifest.values()].find((item) => /\.ncx$/i.test(item.href))?.href
  const tocHtml = navHref ? read(navHref) : ncxHref ? read(ncxHref) : ''
  if (tocHtml !== '') {
    for (const match of tocHtml.matchAll(/<a\b[^>]*href="([^"#]+)(?:#[^"]*)?"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const target = resolvePath(navHref ? navHref.includes('/') ? navHref.slice(0, navHref.lastIndexOf('/')) : '' : '', match[1])
      const text = decodeEntities(match[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
      if (text !== '' && !tocTitles.has(target)) tocTitles.set(target, text)
    }
    for (const match of tocHtml.matchAll(/<navPoint\b[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?src="([^"]+)"/gi)) {
      const target = resolvePath(ncxHref.includes('/') ? ncxHref.slice(0, ncxHref.lastIndexOf('/')) : '', match[2])
      const text = decodeEntities(match[1]).trim()
      if (text !== '' && !tocTitles.has(target)) tocTitles.set(target, text)
    }
  }

  const chapters = []
  const warnings = []
  for (const [index, href] of spine.entries()) {
    const html = read(href)
    if (html === '') {
      warnings.push(`spine 第 ${index + 1} 项读不到：${href}`)
      continue
    }
    const blocks = htmlToBlocks(html)
    if (blocks.length === 0) continue
    const heading = firstHeading(html)
    const chapterTitle = tocTitles.get(href) || heading || `第 ${chapters.length + 1} 节`
    // 章标题已经写在目录里了，正文开头重复的同一个标题去掉。
    if (blocks.length > 0 && blocks[0].t === 'h' && blocks[0].x === chapterTitle) blocks.shift()
    chapters.push({ title: chapterTitle, blocks })
  }
  if (chapters.length === 0) throw new Error('epub 里没有可读的正文')

  return {
    title: title || '',
    author,
    chapters,
    warnings,
  }
}

/** 只判断是不是 EPUB 容器（不改状态）。 */
export function looksLikeEpub(buffer) {
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04
}
