/** 纯文本 → 章节 / 段落 / 块的公共工具，Markdown 与 TXT 共用。 */

const CJK = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/

const CHAPTER_PATTERN =
  /^\s*(?:第[零一二三四五六七八九十百千万两0-9０-９]{1,12}[章节回卷篇幕](?:\s|$|[：:、.．])|序章|楔子|引子|前言|后记|尾声|终章|番外|Chapter\s+[0-9IVXLC]+)/i

/** 两个片段的连接符：中文之间不加空格，西文之间加一个空格。 */
export function joinFragment(left, right) {
  if (left === '') return right
  if (right === '') return left
  const leftChar = left[left.length - 1]
  const rightChar = right[0]
  if (CJK.test(leftChar) || CJK.test(rightChar)) return left + right
  return `${left} ${right}`
}

/** 去掉行内 Markdown 标记，留下可读纯文本。 */
export function stripInline(input) {
  let text = String(input ?? '')
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_match, alt) => (alt ? `〔图：${alt}〕` : '〔图〕'))
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  text = text.replace(/`([^`]+)`/g, '$1')
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2')
  text = text.replace(/(\*|_)(.*?)\1/g, '$2')
  text = text.replace(/~~(.*?)~~/g, '$1')
  text = text.replace(/<br\s*\/?>/gi, ' ')
  text = text.replace(/<[^>]+>/g, '')
  text = decodeEntities(text)
  return text.replace(/[ \t\u00a0]+/g, ' ').trim()
}

export function decodeEntities(input) {
  return String(input)
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_match, code) => safeFromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => safeFromCodePoint(parseInt(code, 16)))
}

function safeFromCodePoint(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return ''
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}

/** 把若干行软换行合并成一个段落（中文不插空格）。 */
export function joinLines(lines) {
  return lines.reduce((acc, line) => joinFragment(acc, line.trim()), '').trim()
}

/** 判断一行是不是章节标题。 */
export function looksLikeChapter(line) {
  const text = String(line ?? '').trim()
  if (text.length === 0 || text.length > 60) return false
  return CHAPTER_PATTERN.test(text)
}

/** 把整段纯文本按章节标题切开；没有标题就按长度兜底切。 */
export function splitPlainChapters(text, options = {}) {
  const maxChars = options.maxChars ?? 12000
  const lines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')

  const chapters = []
  let current = { title: '', paragraphs: [] }
  let paragraph = []

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      current.paragraphs.push(joinLines(paragraph))
      paragraph = []
    }
  }
  const flushChapter = () => {
    flushParagraph()
    const body = current.paragraphs.filter((item) => item.length > 0)
    if (body.length > 0) chapters.push({ title: current.title, paragraphs: body })
    current = { title: '', paragraphs: [] }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === '') {
      flushParagraph()
      continue
    }
    if (looksLikeChapter(line)) {
      flushChapter()
      current.title = line
      continue
    }
    // 长行按句号粗切，避免一整章变成一行。
    if (line.length > 600) {
      flushParagraph()
      for (const piece of chunkSentence(line, 480)) current.paragraphs.push(piece)
      continue
    }
    paragraph.push(line)
  }
  flushChapter()

  if (chapters.length === 0) {
    const body = String(text ?? '').trim()
    if (body !== '') {
      const paragraphs = chunkSentence(body, 800)
      chapters.push({ title: '', paragraphs })
    }
  }

  // 没有章节标题的书：按长度切块，保证目录可用。
  if (chapters.length === 1 && chapters[0].title === '' && chapters[0].paragraphs.join('').length > maxChars) {
    return chunkChapters(chapters[0].paragraphs, maxChars)
  }
  return chapters
}

function chunkSentence(text, max) {
  const pieces = []
  let buffer = ''
  for (const char of String(text)) {
    buffer += char
    if (buffer.length >= max && /[。！？；…」』.!?]/.test(char)) {
      pieces.push(buffer.trim())
      buffer = ''
    } else if (buffer.length >= max * 1.6) {
      pieces.push(buffer.trim())
      buffer = ''
    }
  }
  if (buffer.trim() !== '') pieces.push(buffer.trim())
  return pieces.filter((item) => item !== '')
}

function chunkChapters(paragraphs, maxChars) {
  const chapters = []
  let current = []
  let size = 0
  for (const paragraph of paragraphs) {
    current.push(paragraph)
    size += paragraph.length
    if (size >= maxChars) {
      chapters.push(current)
      current = []
      size = 0
    }
  }
  if (current.length > 0) chapters.push(current)
  return chapters.map((group, index) => ({
    title: `第 ${index + 1} 段`,
    paragraphs: group,
  }))
}

/** 段落数组 → blocks。 */
export function paragraphsToBlocks(paragraphs) {
  const blocks = []
  for (const paragraph of paragraphs) {
    const text = String(paragraph ?? '').trim()
    if (text === '') continue
    blocks.push({ t: 'p', x: text })
  }
  return blocks
}
