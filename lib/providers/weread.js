/**
 * 微信读书来源：用你自己账号的 Cookie，读你自己的书架、目录与正文。
 *
 * 网络层复用 vendored 的 dsh-weread 实现（MIT，见 lib/vendor/weread/NOTICE）。
 * 这里只做三件事：凭据校验、书架/目录归一化、章节正文落成 blocks。
 */
import { WereadReaderError, WereadWebReader } from '../vendor/weread/reader.js'
import { WereadWebApi } from '../vendor/weread/web.js'
import { ProviderError, parseCookie } from '../http.js'

const TIMEOUT_MS = 25000

function makeClients(cookie, persistCookie) {
  const getCookie = () => cookie
  const onCookieRefresh =
    typeof persistCookie === 'function'
      ? (setCookies) => {
          const next = mergeSetCookies(cookie, setCookies)
          if (next !== cookie) {
            cookie = next
            persistCookie(next)
          }
        }
      : undefined
  const web = new WereadWebApi({ getCookie, getTimeoutMs: () => TIMEOUT_MS, onCookieRefresh })
  const reader = new WereadWebReader({ getCookie, getTimeoutMs: () => TIMEOUT_MS, onCookieRefresh })
  return { web, reader }
}

/** 把 Set-Cookie 里的新值并回原有的 cookie 串（微信读书会轮换 wr_skey）。 */
function mergeSetCookies(cookie, setCookies) {
  const jar = new Map()
  for (const part of String(cookie).split(';')) {
    const index = part.indexOf('=')
    if (index > 0) jar.set(part.slice(0, index).trim(), part.slice(index + 1).trim())
  }
  for (const raw of Array.isArray(setCookies) ? setCookies : []) {
    const [pair] = String(raw).split(';')
    const index = pair.indexOf('=')
    if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim())
  }
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ')
}

function translateError(error) {
  if (error instanceof ProviderError) return error
  const code = error?.code ?? ''
  const message = error?.message ?? String(error)
  if (code === 'weread/session-expired' || code === 'weread/no-session' || code === 'weread/bad-cookie') {
    return new ProviderError('AUTH', '微信读书登录已失效，请重新复制 Cookie。', { code })
  }
  if (code.startsWith?.('weread/')) return new ProviderError('UPSTREAM', message, { code })
  return new ProviderError('NET', message, { code })
}

function paragraphsToBlocks(paragraphs) {
  const blocks = []
  for (const paragraph of Array.isArray(paragraphs) ? paragraphs : []) {
    const text = String(paragraph ?? '').trim()
    if (text === '') continue
    blocks.push({ t: 'p', x: text })
  }
  return blocks
}

export function createWereadProvider({ readRecord, persistCookie }) {
  async function session() {
    const record = await readRecord()
    const cookie = String(record?.cookie ?? '').trim()
    if (cookie === '') throw new ProviderError('AUTH', '还没有连接微信读书：在来源卡片里粘贴浏览器 Cookie。')
    return { cookie, ...makeClients(cookie, persistCookie) }
  }

  return {
    id: 'weread',
    label: '微信读书',

    /** @param {{cookie: string}} input */
    async login({ cookie }) {
      const raw = String(cookie ?? '').trim()
      if (raw === '') throw new ProviderError('BADREQ', 'Cookie 是空的。')
      const pairs = parseCookie(raw)
      if (!pairs.has('wr_skey') && !pairs.has('wr_vid')) {
        throw new ProviderError('AUTH', '这段 Cookie 里没有 wr_vid / wr_skey，像是复制错了位置。')
      }
      const clients = makeClients(raw, persistCookie)
      let books = []
      try {
        const payload = await clients.web.shelf()
        books = Array.isArray(payload?.books) ? payload.books : []
      } catch (error) {
        throw translateError(error)
      }
      const vid = pairs.get('wr_vid') ?? ''
      return {
        account: vid === '' ? '已连接' : `账号 ${vid.slice(0, 6)}${vid.length > 6 ? '…' : ''}`,
        shelfCount: books.length,
      }
    },

    async shelf() {
      const { web } = await session()
      let payload
      try {
        payload = await web.shelf()
      } catch (error) {
        throw translateError(error)
      }
      const books = Array.isArray(payload?.books) ? payload.books : []
      // 云端进度 / 阅读时长：书架响应里既有每本书上的字段，也有独立的 bookProgress 列表。
      const cloud = WereadWebApi.progressIndex(payload)
      return books.map((raw) => {
        const book = WereadWebApi.normalizeBook(raw)
        const progress = cloud.get(book.bookId)
        const percent = book.progress ?? progress?.progress ?? 0
        return {
          sourceId: String(book.bookId),
          title: String(book.title ?? ''),
          author: String(book.author ?? ''),
          cover: typeof book.cover === 'string' ? book.cover : '',
          percent: Number(percent) || 0,
          chapterUid: Number(book.chapterUid ?? progress?.chapterUid ?? 0),
          readingTime: Number(book.readingTime ?? progress?.readingTime ?? 0),
          updatedAt: Number(progress?.updateTime ?? book.readUpdateTime ?? 0),
        }
      })
    },



    /** 书城分类页（SSR 里有真实书目），用来给广场一个默认的“看看有什么”。 */
    async browse() {
      const { cookie } = await session()
      let html = ''
      try {
        const response = await fetch('https://weread.qq.com/web/category', {
          headers: {
            cookie,
            referer: 'https://weread.qq.com/',
            'user-agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
            accept: 'text/html,application/xhtml+xml',
          },
          signal: AbortSignal.timeout(20000),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        html = await response.text()
      } catch (error) {
        throw new ProviderError('NET', `连不上微信读书书城：${error?.message ?? String(error)}`)
      }
      // 首页只给 115 本，把几个分类页也抓下来，凑成几百本，搜索筛选才有意义。
      const categories = ['100000', '1000000', '1100000', '1200000', '1300000', '1400000']
      const pages = await Promise.all(
        categories.map(async (id) => {
          try {
            const response = await fetch(`https://weread.qq.com/web/category/${id}`, {
              headers: {
                cookie,
                referer: 'https://weread.qq.com/web/category',
                'user-agent':
                  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
                accept: 'text/html,application/xhtml+xml',
              },
              signal: AbortSignal.timeout(20000),
            })
            return response.ok ? await response.text() : ''
          } catch {
            return ''
          }
        }),
      )
      const merged = new Map()
      for (const book of parseCategoryBooks(html)) merged.set(book.bookId, book)
      for (const page of pages) {
        for (const book of parseCategoryBooks(page)) if (!merged.has(book.bookId)) merged.set(book.bookId, book)
      }
      return [...merged.values()]
    },

    /** 从微信读书的搜索页里取出「图书广场」结果（页面把结果以 JSON 内嵌在 HTML 里）。 */
    async search(keyword) {
      const { cookie } = await session()
      const url = `https://weread.qq.com/web/search/books?keyword=${encodeURIComponent(keyword)}&count=20`
      let html = ''
      try {
        // 注意：这一页**不能带 Cookie**。带上 cookie 时服务端会返回空壳（bookInfos: []），
        // 不带 cookie 才是服务端渲染好的结果。这是 0.2 里「搜不到」的根因。
        const response = await fetch(url, {
          headers: {
            'user-agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
            accept: 'text/html,application/xhtml+xml',
          },
          signal: AbortSignal.timeout(15000),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        html = await response.text()
      } catch (error) {
        throw new ProviderError('NET', `连不上微信读书书城：${error?.message ?? String(error)}`)
      }
      return parseStoreResults(html)
    },

    /** @param {{bookId: string}} input */
    async toc({ bookId }) {
      const { reader, web } = await session()
      let chapters = []
      try {
        chapters = await reader.webCatalog(String(bookId))
      } catch (error) {
        throw translateError(error)
      }
      let title = ''
      let author = ''
      try {
        const info = await web.bookInfo(String(bookId))
        title = String(info?.title ?? '')
        author = String(info?.author ?? '')
      } catch {
        // 书名不是必需的：拿不到就用 id。
      }
      return {
        title: title || `微信读书 ${bookId}`,
        author,
        chapters: chapters.map((chapter, index) => ({
          title: chapter.title || `第 ${index + 1} 章`,
          chapterId: String(chapter.chapterUid),
        })),
      }
    },

    /** @param {{book: object, chapter: {chapterId: string, title: string}}} input */
    async chapter({ book, chapter }) {
      const { reader } = await session()
      let payload
      try {
        payload = await reader.fetchChapter({
          bookId: String(book.sourceId),
          chapterUid: Number(chapter.chapterId),
          title: chapter.title,
        })
      } catch (error) {
        throw translateError(error)
      }
      const blocks = paragraphsToBlocks(payload?.paragraphs)
      if (blocks.length === 0) {
        throw new ProviderError('UPSTREAM', '微信读书这一章没有返回正文（可能需要付费或该章为空）。')
      }
      return { title: payload?.title || chapter.title, blocks }
    },
  }
}

/** 从 `"bookInfos":[...]` 那段内嵌 JSON 里取出书名、作者、封面。 */
function parseStoreResults(html) {
  const marker = '"bookInfos":'
  const start = html.indexOf(marker)
  if (start < 0) return []
  let index = start + marker.length
  if (html[index] !== '[') return []
  let depth = 0
  let end = index
  let inString = false
  let escaped = false
  for (; end < html.length; end += 1) {
    const char = html[end]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '[') depth += 1
    else if (char === ']') {
      depth -= 1
      if (depth === 0) break
    }
  }
  let list
  try {
    list = JSON.parse(html.slice(index, end + 1))
  } catch {
    return []
  }
  const out = []
  for (const entry of Array.isArray(list) ? list : []) {
    const info = entry?.bookInfo ?? entry
    const bookId = String(info?.bookId ?? '')
    if (bookId === '') continue
    out.push({
      bookId,
      title: String(info?.title ?? entry?.title ?? '').trim(),
      author: String(info?.author ?? entry?.author ?? '').trim(),
      cover: String(info?.cover ?? entry?.cover ?? ''),
    })
  }
  return out
}

/** 从分类页里把每个 `"bookInfo":{...}` 抠出来（它们嵌在页面脚本里）。 */
function parseCategoryBooks(html) {
  const text = String(html ?? '')
  const out = new Map()
  const marker = '"bookInfo":{"'
  let index = text.indexOf('"bookInfo":{')
  while (index >= 0) {
    const start = text.indexOf('{', index)
    let depth = 0
    let inString = false
    let escaped = false
    let cursor = start
    for (; cursor < text.length; cursor += 1) {
      const char = text[cursor]
      if (inString) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') inString = false
        continue
      }
      if (char === '"') inString = true
      else if (char === '{') depth += 1
      else if (char === '}') {
        depth -= 1
        if (depth === 0) break
      }
    }
    let parsed = null
    try {
      parsed = JSON.parse(text.slice(start, cursor + 1))
    } catch {
      parsed = null
    }
    const bookId = parsed === null ? '' : String(parsed.bookId ?? '')
    if (bookId !== '' && !out.has(bookId)) {
      out.set(bookId, {
        bookId,
        title: String(parsed.title ?? '').trim(),
        author: String(parsed.author ?? '').trim(),
        cover: String(parsed.cover ?? ''),
        category: String(parsed.category ?? '').trim(),
        words: Number(parsed.wordCount) || 0,
      })
    }
    index = text.indexOf('"bookInfo":{', cursor)
  }
  return [...out.values()].filter((book) => book.title !== '')
}
