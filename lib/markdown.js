/** Markdown → 章节 / blocks。 */
import { joinLines, stripInline } from './text-util.js'

const HEADING = /^(#{1,6})\s+(.*)$/
const BULLET = /^\s{0,3}(?:[-*+]|\d{1,3}[.)])\s+(.*)$/
const FENCE = /^\s*(```+|~~~+)\s*([\w-]*)\s*$/
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/
const TABLE_ROW = /^\s*\|(.+)\|\s*$/
const TABLE_DIVIDER = /^\s*\|?[\s:|-]+\|?\s*$/
/** h2 只有在明显是「章」时才切章：节、小节不算。 */
const STRICT_CHAPTER = /^(?:第[零一二三四五六七八九十百千万两0-9]{1,12}[章回卷篇幕](?:\s|$|[：:、.．])|序章|楔子|尾声|终章|后记|番外|Chapter\s)/i

/**
 * @param {string} source
 * @param {{fallbackTitle?: string}} options
 * @returns {{title: string, author: string, chapters: Array<{title: string, blocks: Array, chars: number}>}}
 */
export function parseMarkdown(source, options = {}) {
  const fallbackTitle = (options.fallbackTitle ?? '').trim()
  const lines = String(source ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .split('\n')

  const meta = { title: '', author: '' }
  let start = 0
  if (lines[0]?.trim() === '---') {
    for (let index = 1; index < Math.min(lines.length, 80); index += 1) {
      if (lines[index].trim() === '---' || lines[index].trim() === '...') {
        for (let cursor = 1; cursor < index; cursor += 1) {
          const match = /^([A-Za-z_]+)\s*:\s*(.*)$/.exec(lines[cursor])
          if (!match) continue
          const key = match[1].toLowerCase()
          const value = match[2].trim().replace(/^["']|["']$/g, '')
          if (key === 'title' && value !== '') meta.title = value
          if (key === 'author' && value !== '') meta.author = value
        }
        start = index + 1
        break
      }
    }
  }

  // 有 h1 的书，h2 是节而不是章；没有 h1 的书，h2 才当章用。
  const hasH1 = lines.slice(start).some((line) => /^#\s+\S/.test(line))

  const chapters = []
  let chapter = { title: '', blocks: [] }
  let paragraph = []
  let quote = []
  let tableRows = []

  const pushBlock = (block) => {
    if (block !== null) chapter.blocks.push(block)
  }
  const flushParagraph = () => {
    if (paragraph.length === 0) return
    const text = stripInline(joinLines(paragraph))
    paragraph = []
    if (text !== '') pushBlock({ t: 'p', x: text })
  }
  const flushQuote = () => {
    if (quote.length === 0) return
    const text = quote.join(' ').trim()
    quote = []
    if (text !== '') pushBlock({ t: 'q', x: text })
  }
  const flushTable = () => {
    if (tableRows.length === 0) return
    const rows = tableRows
    tableRows = []
    const body = rows
      .filter((row) => !TABLE_DIVIDER.test(`|${row}|`))
      .map((row) => row.split('|').map((cell) => stripInline(cell)).filter((cell) => cell !== '').join(' ｜ '))
      .filter((row) => row !== '')
    for (const row of body) pushBlock({ t: 'p', x: row })
  }
  const flushAll = () => {
    flushParagraph()
    flushQuote()
    flushTable()
  }
  const finishChapter = () => {
    flushAll()
    if (chapter.blocks.length > 0) chapters.push(chapter)
    chapter = { title: '', blocks: [] }
  }

  let fence = null
  let fenceBuffer = []
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    const fenceMatch = FENCE.exec(line)
    if (fence !== null) {
      if (fenceMatch) {
        pushBlock({ t: 'code', x: fenceBuffer.join('\n').replace(/\s+$/, '') })
        fenceBuffer = []
        fence = null
      } else {
        fenceBuffer.push(line)
      }
      continue
    }
    if (fenceMatch) {
      flushAll()
      fence = fenceMatch[1]
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      const level = heading[1].length
      const text = stripInline(heading[2])
      flushAll()
      const chapterHeading = level === 1 || (level === 2 && (!hasH1 || STRICT_CHAPTER.test(text)))
      if (chapterHeading) {
        finishChapter()
        chapter.title = text
      } else if (text !== '') {
        pushBlock({ t: 'h', l: level === 2 ? 2 : 3, x: text })
      }
      continue
    }

    if (line.trim() === '') {
      flushAll()
      continue
    }

    const tableMatch = TABLE_ROW.exec(line)
    if (tableMatch) {
      flushParagraph()
      flushQuote()
      tableRows.push(tableMatch[1])
      continue
    }
    if (tableRows.length > 0) flushTable()

    if (RULE.test(line)) {
      flushAll()
      pushBlock({ t: 'hr' })
      continue
    }

    const quoteMatch = /^\s{0,3}>\s?(.*)$/.exec(line)
    if (quoteMatch) {
      flushParagraph()
      quote.push(stripInline(quoteMatch[1]))
      continue
    }
    if (quote.length > 0) flushQuote()

    const bullet = BULLET.exec(line)
    if (bullet) {
      flushParagraph()
      const text = stripInline(bullet[1])
      if (text !== '') pushBlock({ t: 'li', x: text })
      continue
    }

    paragraph.push(line.trim())
  }

  if (fence !== null) {
    pushBlock({ t: 'code', x: fenceBuffer.join('\n').replace(/\s+$/, '') })
  }
  finishChapter()

  const cleaned = chapters.length > 0 ? chapters : fallbackChapters(lines.slice(start), fallbackTitle)
  const segments = []
  cleaned.forEach((item, index) => {
    const baseTitle = item.title || (index === 0 ? fallbackTitle || '正文' : `第 ${index + 1} 章`)
    const parts = splitOversized(item.blocks)
    parts.forEach((part, partIndex) => {
      segments.push({
        title: partIndex === 0 ? baseTitle : `${baseTitle}（${partIndex + 1}）`,
        blocks: part,
      })
    })
  })

  return {
    title: meta.title || cleaned[0]?.title || fallbackTitle || '未命名',
    author: meta.author,
    chapters: segments.map((entry) => ({
      title: entry.title,
      blocks: entry.blocks,
      chars: entry.blocks.reduce((sum, block) => sum + (typeof block.x === 'string' ? block.x.length : 0), 0),
    })),
  }
}

/** 没有任何标题的 Markdown：整篇一段，标题用文件名。 */
function fallbackChapters(lines, fallbackTitle) {
  const blocks = []
  let paragraph = []
  for (const line of lines) {
    const text = stripInline(line)
    if (text === '') {
      if (paragraph.length > 0) {
        blocks.push({ t: 'p', x: joinLines(paragraph) })
        paragraph = []
      }
      continue
    }
    paragraph.push(text)
  }
  if (paragraph.length > 0) blocks.push({ t: 'p', x: joinLines(paragraph) })
  return [{ title: fallbackTitle || '正文', blocks }]
}

const MAX_CHAPTER_CHARS = 24000

/** 超长章节按段落切段，返回多个 block 数组。 */
function splitOversized(blocks) {
  const total = blocks.reduce((sum, block) => sum + (typeof block.x === 'string' ? block.x.length : 0), 0)
  if (total <= MAX_CHAPTER_CHARS) return [blocks]
  const parts = []
  let current = []
  let size = 0
  for (const block of blocks) {
    const length = typeof block.x === 'string' ? block.x.length : 0
    if (size > 0 && size + length > MAX_CHAPTER_CHARS) {
      parts.push(current)
      current = []
      size = 0
    }
    current.push(block)
    size += length
  }
  if (current.length > 0) parts.push(current)
  return parts.length > 0 ? parts : [blocks]
}
