/** 笔记与划线：一本书里的引文 + 读者/AI 的想法。 */
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

export class Notes {
  constructor(root) {
    this.file = path.join(root, 'notes.json')
    this.notes = []
    this.loaded = false
    this.queue = Promise.resolve()
  }

  async load() {
    if (this.loaded) return this.notes
    try {
      const parsed = JSON.parse(await fsp.readFile(this.file, 'utf8'))
      this.notes = Array.isArray(parsed) ? parsed.filter((note) => note && typeof note.id === 'string') : []
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      this.notes = []
    }
    this.loaded = true
    return this.notes
  }

  serialize(operation) {
    const run = this.queue.then(operation, operation)
    this.queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  async #persist() {
    await fsp.mkdir(path.dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    await fsp.writeFile(tmp, JSON.stringify(this.notes, null, 2), { mode: 0o600 })
    await fsp.rename(tmp, this.file)
  }

  async list({ bookId } = {}) {
    await this.load()
    const items = bookId ? this.notes.filter((note) => note.bookId === bookId) : this.notes
    return [...items].sort((left, right) => right.createdAt - left.createdAt)
  }

  async counts() {
    await this.load()
    const map = new Map()
    for (const note of this.notes) map.set(note.bookId, (map.get(note.bookId) ?? 0) + 1)
    return map
  }

  async add(input) {
    return this.serialize(async () => {
      await this.load()
      const note = {
        id: `nt_${crypto.randomBytes(5).toString('hex')}`,
        bookId: String(input.bookId ?? ''),
        bookTitle: String(input.bookTitle ?? ''),
        chapterIndex: Number(input.chapterIndex) || 0,
        chapterTitle: String(input.chapterTitle ?? ''),
        quote: String(input.quote ?? '').slice(0, 4000),
        note: String(input.note ?? '').slice(0, 20000),
        mode: ['explain', 'expand', 'note'].includes(input.mode) ? input.mode : 'note',
        createdAt: Date.now(),
      }
      this.notes.push(note)
      await this.#persist()
      return note
    })
  }

  async remove(id) {
    return this.serialize(async () => {
      await this.load()
      const index = this.notes.findIndex((note) => note.id === id)
      if (index < 0) return false
      this.notes.splice(index, 1)
      await this.#persist()
      return true
    })
  }

  async removeBook(bookId) {
    return this.serialize(async () => {
      await this.load()
      const before = this.notes.length
      this.notes = this.notes.filter((note) => note.bookId !== bookId)
      if (this.notes.length !== before) await this.#persist()
    })
  }
}

/** 笔记导出成 Markdown：按书分组、按时间排序，带出处与模式。 */
export function notesToMarkdown(notes, options = {}) {
  const generatedAt = new Date().toLocaleString('zh-CN', { hour12: false })
  const lines = []
  lines.push('# 灯下 · 读书笔记')
  lines.push('')
  if (options.bookTitle) lines.push(`> 出自《${options.bookTitle}》`)
  lines.push(`> 导出时间：${generatedAt} · 共 ${notes.length} 条`)
  lines.push('')

  const groups = new Map()
  for (const note of notes) {
    const key = note.bookId
    if (!groups.has(key)) groups.set(key, { title: note.bookTitle || '未命名', items: [] })
    groups.get(key).items.push(note)
  }

  for (const [, group] of groups) {
    lines.push(`## 《${group.title}》`)
    lines.push('')
    const ordered = [...group.items].sort((left, right) => {
      if (left.chapterIndex !== right.chapterIndex) return left.chapterIndex - right.chapterIndex
      return left.createdAt - right.createdAt
    })
    for (const note of ordered) {
      const where = note.chapterTitle ? `第 ${note.chapterIndex + 1} 章 · ${note.chapterTitle}` : `第 ${note.chapterIndex + 1} 章`
      lines.push(`### ${where}`)
      if (note.quote) {
        for (const line of note.quote.split('\n')) lines.push(`> ${line}`)
        lines.push('')
      }
      if (note.note) {
        const label = note.mode === 'explain' ? '**解释**' : note.mode === 'expand' ? '**补充**' : ''
        lines.push(`${label}${label ? '：' : ''}${note.note}`)
        lines.push('')
      }
      lines.push(`<sub>${new Date(note.createdAt).toLocaleString('zh-CN', { hour12: false })}</sub>`)
      lines.push('')
    }
  }
  return lines.join('\n')
}

/** 书单导出：一眼看清读了什么、读到哪。 */
export function shelfToMarkdown(shelf) {
  const generatedAt = new Date().toLocaleString('zh-CN', { hour12: false })
  const lines = ['# 我的书架 · 灯下', '', `> 导出时间：${generatedAt} · 共 ${shelf.length} 本`, '']
  lines.push('| 书名 | 作者 | 来源 | 进度 | 状态 |')
  lines.push('| --- | --- | --- | --- | --- |')
  for (const book of shelf) {
    const percent = book.chapterCount > 0
      ? Math.round(((book.progress?.chapterIndex ?? 0) + (book.progress?.percent ?? 0)) / book.chapterCount * 100)
      : 0
    const source = book.source === 'weread' ? '微信读书' : book.source === 'fanqie' ? '番茄小说' : '本地'
    lines.push(`| ${book.title || '未命名'} | ${book.author || '—'} | ${source} | ${percent}% | ${book.finished ? '读完' : '在读'} |`)
  }
  lines.push('')
  return lines.join('\n')
}
