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

function makeClients(cookie) {
  const getCookie = () => cookie
  const web = new WereadWebApi({ getCookie, getTimeoutMs: () => TIMEOUT_MS })
  const reader = new WereadWebReader({ getCookie, getTimeoutMs: () => TIMEOUT_MS })
  return { web, reader }
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

export function createWereadProvider({ readRecord }) {
  async function session() {
    const record = await readRecord()
    const cookie = String(record?.cookie ?? '').trim()
    if (cookie === '') throw new ProviderError('AUTH', '还没有连接微信读书：在来源卡片里粘贴浏览器 Cookie。')
    return { cookie, ...makeClients(cookie) }
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
      const clients = makeClients(raw)
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


    /** 从微信读书的搜索页里取出「图书广场」结果（页面把结果以 JSON 内嵌在 HTML 里）。 */
    async search(keyword) {
      const { cookie } = await session()
      const url = `https://weread.qq.com/web/search/books?keyword=${encodeURIComponent(keyword)}&count=20`
      let html = ''
      try {
        const response = await fetch(url, {
          headers: {
            cookie,
            referer: 'https://weread.qq.com/',
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
