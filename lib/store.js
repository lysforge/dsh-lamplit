/**
 * 灯下 · 本地存储。
 *
 * 目录布局（默认 `~/.dsh/lamplit`，可用 LAMPLIT_HOME 覆盖，测试用）：
 *
 *   state.json            设置 + 书架索引 + 两个来源的凭据
 *   books/<id>.json       一本书的正文（章 → blocks）
 *
 * 所有写入走「临时文件 + rename」，并保持 0600；凭据只存本机。
 */
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

export const DEFAULT_SETTINGS = {
  theme: 'paper',
  fontFamily: 'serif',
  fontSize: 19,
  lineHeight: 1.9,
  measure: 34,
  mode: 'scroll',
  justify: true,
  chromeAutoHide: true,
}

const THEMES = new Set(['paper', 'sepia', 'ink', 'moss'])
const FONTS = new Set(['serif', 'sans'])
const MODES = new Set(['scroll', 'paged'])

const PROVIDER_IDS = ['weread']

function clampNumber(value, min, max, fallback) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, num))
}

/** 只接受已知键；越界值收敛到范围内，非法值退回默认。 */
export function normalizeSettings(input, base = DEFAULT_SETTINGS) {
  const next = { ...base }
  if (input === null || typeof input !== 'object') return next
  if (THEMES.has(input.theme)) next.theme = input.theme
  if (FONTS.has(input.fontFamily)) next.fontFamily = input.fontFamily
  if (MODES.has(input.mode)) next.mode = input.mode
  if (typeof input.justify === 'boolean') next.justify = input.justify
  if (typeof input.chromeAutoHide === 'boolean') next.chromeAutoHide = input.chromeAutoHide
  next.fontSize = clampNumber(input.fontSize, 15, 32, next.fontSize)
  next.lineHeight = clampNumber(input.lineHeight, 1.4, 2.4, next.lineHeight)
  next.measure = clampNumber(input.measure, 24, 52, next.measure)
  return next
}

function emptyProvider(id) {
  return {
    id,
    cookie: '',
    apiKey: '',
    account: '',
    lastSyncAt: 0,
    error: null,
  }
}

function emptyState() {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    providers: { weread: emptyProvider('weread') },
    github: { repos: [], token: '', seeded: false },
    books: [],
    stats: { seconds: 0, opened: 0, days: {} },
  }
}

async function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(tmp, data, { mode: 0o600 })
  await fsp.rename(tmp, file)
}

function newBookId() {
  return `bk_${crypto.randomBytes(5).toString('hex')}`
}

/** 书架条目：去掉正文，只留 Client 需要的字段。 */
export function summaryOf(book) {
  return {
    id: book.id,
    title: book.title,
    author: book.author ?? '',
    source: book.source,
    sourceId: book.sourceId ?? null,
    format: book.format,
    cover: book.cover ?? null,
    chapterCount: book.chapterCount,
    chars: book.chars,
    pages: book.pages ?? 0,
    addedAt: book.addedAt,
    lastOpenedAt: book.lastOpenedAt ?? 0,
    finished: book.finished === true,
    progress: book.progress ?? { chapterIndex: 0, percent: 0, charsRead: 0, updatedAt: 0 },
    remote: book.remote ?? null,
  }
}

export class Store {
  constructor(options = {}) {
    this.root = options.root ?? process.env.LAMPLIT_HOME ?? path.join(os.homedir(), '.dsh', 'lamplit')
    this.stateFile = path.join(this.root, 'state.json')
    this.booksDir = path.join(this.root, 'books')
    this.filesDir = path.join(this.root, 'files')
    this.state = emptyState()
    this.loaded = false
    this.queue = Promise.resolve()
  }

  get storageDir() {
    return this.root
  }

  /** 串行化写入，避免并发请求互相覆盖。 */
  serialize(operation) {
    const run = this.queue.then(operation, operation)
    this.queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  async load() {
    if (this.loaded) return this.state
    try {
      const raw = await fsp.readFile(this.stateFile, 'utf8')
      const parsed = JSON.parse(raw)
      this.state = this.#migrate(parsed)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      this.state = emptyState()
    }
    this.loaded = true
    return this.state
  }

  #migrate(parsed) {
    const base = emptyState()
    const state = { ...base, ...(parsed && typeof parsed === 'object' ? parsed : {}) }
    state.settings = normalizeSettings(state.settings, base.settings)
    state.providers = { ...base.providers }
    for (const id of PROVIDER_IDS) {
      const stored = parsed?.providers?.[id]
      state.providers[id] = { ...emptyProvider(id), ...(stored && typeof stored === 'object' ? stored : {}) }
      state.providers[id].id = id
    }
    state.books = Array.isArray(state.books) ? state.books.filter(isBookish) : []
    const github = parsed?.github
    state.github = {
      repos: Array.isArray(github?.repos) ? github.repos.filter((item) => typeof item === 'string' && item.includes('/')) : [],
      token: typeof github?.token === 'string' ? github.token : '',
      seeded: github?.seeded === true,
    }
    const days = state.stats?.days
    state.stats = {
      seconds: Number(state.stats?.seconds) || 0,
      opened: Number(state.stats?.opened) || 0,
      days: days !== null && typeof days === 'object' ? { ...days } : {},
    }
    return state
  }

  async #persist() {
    await writeAtomic(this.stateFile, JSON.stringify(this.state, null, 2))
  }

  async stateSnapshot() {
    const state = await this.load()
    return {
      storage: this.root,
      settings: state.settings,
      shelf: state.books.map(summaryOf).sort(byRecent),
      providers: PROVIDER_IDS.map((id) => this.providerState(id)),
      stats: summarizeStats(state.stats),
    }
  }

  providerState(id) {
    const provider = this.state.providers[id]
    const count = this.state.books.filter((book) => book.source === id).length
    return {
      id,
      label: id === 'weread' ? '微信读书' : '番茄小说',
      connected: Boolean(provider.cookie) || Boolean(provider.apiKey),
      account: provider.account ?? '',
      shelfCount: count,
      lastSyncAt: provider.lastSyncAt ?? 0,
      error: provider.error ?? null,
    }
  }

  async patchSettings(patch) {
    return this.serialize(async () => {
      await this.load()
      this.state.settings = normalizeSettings(patch, this.state.settings)
      await this.#persist()
      return this.state.settings
    })
  }

  async books() {
    await this.load()
    return this.state.books
  }

  async book(id) {
    await this.load()
    return this.state.books.find((item) => item.id === id) ?? null
  }

  async readBook(id) {
    const book = await this.book(id)
    if (book === null) return null
    let payload
    try {
      payload = JSON.parse(await fsp.readFile(this.#bookFile(id), 'utf8'))
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      return { book, chapters: [] }
    }
    return {
      book,
      chapters: Array.isArray(payload.chapters) ? payload.chapters : [],
      sourceFile: payload.sourceFile ?? null,
    }
  }

  #bookFile(id) {
    return path.join(this.booksDir, `${id}.json`)
  }

  /**
   * 写入一本书（或整本替换）。
   * @param {{title?: string, author?: string, source: string, sourceId?: string|null, format: string, chapters: Array, sourceFile?: string|null, cover?: string|null}} input
   */
  async putBook(input) {
    return this.serialize(async () => {
      await this.load()
      const chapters = (input.chapters ?? []).map((chapter, index) => ({
        index,
        title: chapter.title || `第 ${index + 1} 章`,
        // 在线来源的正文是懒加载的：这里的 blocks 可以为 null。
        blocks: Array.isArray(chapter.blocks) ? chapter.blocks : null,
        chars: chapter.chars ?? (Array.isArray(chapter.blocks) ? countChars(chapter.blocks) : 0),
        chapterId: chapter.chapterId ?? null,
        locked: chapter.locked === true,
      }))
      const chars = chapters.reduce((sum, chapter) => sum + chapter.chars, 0)
      const existing = input.id
        ? this.state.books.find((item) => item.id === input.id)
        : this.state.books.find(
            (item) => item.source === input.source && input.sourceId != null && item.sourceId === input.sourceId,
          )
      const now = Date.now()
      const record = {
        id: existing?.id ?? newBookId(),
        title: (input.title || '未命名').trim(),
        author: (input.author ?? '').trim(),
        source: input.source,
        sourceId: input.sourceId ?? null,
        format: input.format,
        cover: typeof input.cover === 'string' && input.cover !== '' ? input.cover : (existing?.cover ?? null),
        chapterCount: chapters.length,
        chars,
        pages: Number(input.pages) || 0,
        addedAt: existing?.addedAt ?? now,
        lastOpenedAt: existing?.lastOpenedAt ?? 0,
        finished: existing?.finished === true,
        progress: existing?.progress ?? { chapterIndex: 0, percent: 0, charsRead: 0, updatedAt: 0 },
      }
      await writeAtomic(
        this.#bookFile(record.id),
        JSON.stringify({
          book: summaryOf(record),
          chapters,
          sourceFile: input.sourceFile ?? null,
        }),
      )
      if (existing) Object.assign(existing, record)
      else this.state.books.push(record)
      await this.#persist()
      return summaryOf(record)
    })
  }

  /** 在线来源懒加载完一章后回写。 */
  async patchChapter(id, index, blocks, title) {
    return this.serialize(async () => {
      await this.load()
      let payload
      try {
        payload = JSON.parse(await fsp.readFile(this.#bookFile(id), 'utf8'))
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error
        return null
      }
      const chapter = payload.chapters?.[index]
      if (!chapter) return null
      chapter.blocks = Array.isArray(blocks) ? blocks : []
      chapter.chars = countChars(chapter.blocks)
      if (typeof title === 'string' && title.trim() !== '') chapter.title = title
      await writeAtomic(this.#bookFile(id), JSON.stringify(payload))
      const book = this.state.books.find((item) => item.id === id)
      if (book) {
        book.chars = payload.chapters.reduce((sum, item) => sum + (item.chars ?? 0), 0)
        await this.#persist()
      }
      return chapter
    })
  }

  /** 影印 PDF 之类的原始文件放在 files/ 下，按书 id 命名。 */
  async saveFile(id, buffer, extension) {
    const file = path.join(this.filesDir, `${id}.${extension}`)
    await fsp.mkdir(this.filesDir, { recursive: true })
    await fsp.writeFile(file, buffer, { mode: 0o600 })
    return file
  }

  filePath(id, extension = 'pdf') {
    return path.join(this.filesDir, `${id}.${extension}`)
  }

  /**
   * 在线来源的 metadata-only 批量入库：一本书一个文件，但**只写一次 state**。
   * 一次同步 70 多本时，这个差别是「十几秒」和「一两秒」。
   */
  async putOnlineBooks(source, items) {
    return this.serialize(async () => {
      await this.load()
      const now = Date.now()
      const out = []
      for (const item of items) {
        const sourceId = item.sourceId === undefined || item.sourceId === null ? '' : String(item.sourceId)
        if (sourceId === '') continue
        const existing = this.state.books.find((book) => book.source === source && String(book.sourceId) === sourceId)
        const record = {
          id: existing?.id ?? newBookId(),
          title: (item.title || `未命名`).trim(),
          author: (item.author ?? '').trim(),
          source,
          sourceId,
          format: 'online',
          cover: typeof item.cover === 'string' && item.cover !== '' ? item.cover : (existing?.cover ?? null),
          chapterCount: existing?.chapterCount ?? 0,
          chars: existing?.chars ?? 0,
          pages: 0,
          addedAt: existing?.addedAt ?? now,
          lastOpenedAt: existing?.lastOpenedAt ?? 0,
          finished: existing?.finished === true,
          progress: existing?.progress ?? { chapterIndex: 0, percent: 0, charsRead: 0, updatedAt: 0 },
          // 微信读书那边的进度与累计阅读时长：只读快照，用来显示，也用来猜章节。
          remote: {
            percent: Math.max(0, Math.min(100, Number(item.percent) || 0)),
            chapterUid: Number(item.chapterUid) || 0,
            readingTime: Number(item.readingTime) || 0,
            updatedAt: Number(item.updatedAt) || 0,
          },
        }
        await writeAtomic(
          this.#bookFile(record.id),
          JSON.stringify({ book: summaryOf(record), chapters: [], sourceFile: null }),
        )
        if (existing) Object.assign(existing, record)
        else this.state.books.push(record)
        out.push({ book: summaryOf(record), created: existing === undefined })
      }
      await this.#persist()
      return out
    })
  }

  async deleteBook(id) {
    return this.serialize(async () => {
      await this.load()
      const index = this.state.books.findIndex((item) => item.id === id)
      if (index < 0) return false
      this.state.books.splice(index, 1)
      await this.#persist()
      await fsp.rm(this.#bookFile(id), { force: true })
      await fsp.rm(path.join(this.filesDir, `${id}.pdf`), { force: true })
      return true
    })
  }

  async touch(id) {
    return this.serialize(async () => {
      await this.load()
      const book = this.state.books.find((item) => item.id === id)
      if (!book) return null
      book.lastOpenedAt = Date.now()
      this.state.stats.opened += 1
      await this.#persist()
      return summaryOf(book)
    })
  }

  async updateProgress({ bookId, chapterIndex, percent, seconds }) {
    return this.serialize(async () => {
      await this.load()
      const book = this.state.books.find((item) => item.id === bookId)
      if (!book) return null
      const index = Math.max(0, Math.min(Number(chapterIndex) || 0, Math.max(book.chapterCount - 1, 0)))
      const ratio = Math.max(0, Math.min(Number(percent) || 0, 1))
      const charsRead = Math.round(book.chars * ((index + ratio) / Math.max(book.chapterCount, 1)))
      book.progress = {
        chapterIndex: index,
        percent: Number(ratio.toFixed(4)),
        charsRead,
        updatedAt: Date.now(),
      }
      book.lastOpenedAt = Date.now()
      const spent = Math.max(0, Math.min(Number(seconds) || 0, 3600))
      this.state.stats.seconds += spent
      if (spent > 0) {
        const key = dayKey(new Date())
        this.state.stats.days[key] = Math.round(((this.state.stats.days[key] ?? 0) + spent) * 10) / 10
      }
      await this.#persist()
      return summaryOf(book)
    })
  }

  async setFinished(id, finished) {
    return this.serialize(async () => {
      await this.load()
      const book = this.state.books.find((item) => item.id === id)
      if (!book) return null
      book.finished = finished === true
      if (book.finished) {
        book.progress = {
          chapterIndex: Math.max(book.chapterCount - 1, 0),
          percent: 1,
          charsRead: book.chars,
          updatedAt: Date.now(),
        }
      }
      await this.#persist()
      return summaryOf(book)
    })
  }

  /** GitHub 书库配置：仓库清单 + 可选 token。 */
  async githubConfig() {
    await this.load()
    return {
      repos: [...this.state.github.repos],
      token: this.state.github.token,
      seeded: this.state.github.seeded === true,
    }
  }

  async patchGithub(patch) {
    return this.serialize(async () => {
      await this.load()
      if (Array.isArray(patch.repos)) {
        const seen = new Set()
        this.state.github.repos = patch.repos
          .map((item) => String(item).trim())
          .filter((item) => item.includes('/') && !seen.has(item) && seen.add(item))
      }
      if (typeof patch.token === 'string') this.state.github.token = patch.token.trim()
      if (typeof patch.seeded === 'boolean') this.state.github.seeded = patch.seeded
      await this.#persist()
      return { repos: [...this.state.github.repos], token: this.state.github.token }
    })
  }

  async patchProvider(id, patch) {
    return this.serialize(async () => {
      await this.load()
      if (!this.state.providers[id]) return null
      Object.assign(this.state.providers[id], patch)
      await this.#persist()
      return this.providerState(id)
    })
  }

  async providerRecord(id) {
    await this.load()
    return this.state.providers[id] ?? null
  }
}

function isBookish(book) {
  return book !== null && typeof book === 'object' && typeof book.id === 'string' && typeof book.title === 'string'
}

function dayKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 今日 / 本周 / 连续天数，给界面直接用。 */
export function summarizeStats(stats) {
  const days = stats?.days ?? {}
  const now = new Date()
  const todaySeconds = Number(days[dayKey(now)] ?? 0)
  let weekSeconds = 0
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(now)
    date.setDate(now.getDate() - offset)
    weekSeconds += Number(days[dayKey(date)] ?? 0)
  }
  let streak = 0
  for (let offset = 0; offset < 400; offset += 1) {
    const date = new Date(now)
    date.setDate(now.getDate() - offset)
    const value = Number(days[dayKey(date)] ?? 0)
    if (offset === 0 && value <= 0) continue // 今天还没读不算断
    if (value > 0) streak += 1
    else break
  }
  return {
    seconds: stats?.seconds ?? 0,
    opened: stats?.opened ?? 0,
    today: Math.round(todaySeconds),
    week: Math.round(weekSeconds),
    streak,
    days,
  }
}

function byRecent(left, right) {
  return (right.lastOpenedAt || right.addedAt) - (left.lastOpenedAt || left.addedAt)
}

export function countChars(blocks) {
  if (!Array.isArray(blocks)) return 0
  let total = 0
  for (const block of blocks) {
    if (typeof block?.x === 'string') total += block.x.length
  }
  return total
}
