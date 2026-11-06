/**
 * 番茄小说来源。
 *
 * 现实情况（2026-11 实测）：
 *  - 目录接口公开可用：`/api/reader/directory/detail?bookId=` 返回分卷章节列表。
 *  - 书页 HTML 公开可读：`/page/<bookId>` 里有书名。
 *  - 正文接口 `/api/reader/full` 需要 App 侧签名；网页版正文把常用字换成了
 *    U+E000 私用区字形（字体反爬），直接抓 HTML 只能拿到掺了空洞的文本。
 *
 * 所以这里：目录、书名、章节元数据照常同步；正文尽力抓，抓到的是混淆文本时
 * **如实报错**（code: OBFUSCATED），由界面引导「去番茄读」或「粘贴正文导入」，
 * 不把乱码当正文塞给读者。
 */
import { ProviderError, extractBookId, request, requestJson } from '../http.js'

const ORIGIN = 'https://fanqienovel.com'
const TIMEOUT_MS = 20000
const PUA_SOURCE = /[\ue000-\uf8ff]/g

function countPrivateUse(text) {
  return (String(text).match(PUA_SOURCE) ?? []).length
}

function stripTags(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function paragraphsOf(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

export function createFanqieProvider({ readRecord }) {
  async function cookie() {
    const record = await readRecord()
    return String(record?.cookie ?? '').trim()
  }

  async function directory(bookId) {
    let payload
    try {
      payload = await requestJson(`${ORIGIN}/api/reader/directory/detail?bookId=${encodeURIComponent(bookId)}`, {
        cookie: await cookie(),
        referer: `${ORIGIN}/page/${bookId}`,
        timeoutMs: TIMEOUT_MS,
      })
    } catch (error) {
      throw error instanceof ProviderError ? error : new ProviderError('NET', String(error?.message ?? error))
    }
    const data = payload.json?.data
    if (data === null || typeof data !== 'object') {
      throw new ProviderError('UPSTREAM', '番茄没有返回这本书的目录（书 id 可能不对）。')
    }
    const volumes = Array.isArray(data.chapterListWithVolume) ? data.chapterListWithVolume : []
    const chapters = []
    for (const volume of volumes) {
      for (const chapter of Array.isArray(volume) ? volume : []) {
        if (chapter === null || typeof chapter !== 'object' || chapter.itemId === undefined) continue
        chapters.push({
          chapterId: String(chapter.itemId),
          title: String(chapter.title ?? '').trim() || `第 ${chapters.length + 1} 章`,
          locked: chapter.needPay === 1 || chapter.isChapterLock === true,
        })
      }
    }
    if (chapters.length === 0 && Array.isArray(data.allItemIds)) {
      for (const [index, itemId] of data.allItemIds.entries()) {
        chapters.push({ chapterId: String(itemId), title: `第 ${index + 1} 章`, locked: false })
      }
    }
    if (chapters.length === 0) throw new ProviderError('UPSTREAM', '这本书的目录是空的。')
    return chapters
  }

  async function pageMeta(bookId) {
    try {
      const response = await request(`${ORIGIN}/page/${bookId}`, {
        cookie: await cookie(),
        timeoutMs: TIMEOUT_MS,
        accept: 'text/html,application/xhtml+xml',
      })
      const html = await response.text()
      const title = /<h1[^>]*>([^<]{1,80})<\/h1>/.exec(html)?.[1]?.trim() ?? ''
      const cover =
        /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/.exec(html)?.[1] ??
        /"thumb_url"\s*:\s*"([^"]+)"/.exec(html)?.[1] ??
        ''
      const author =
        /"author"\s*:\s*"([^"]{1,40})"/.exec(html)?.[1]?.trim() ??
        /作者[：:]\s*<[^>]*>([^<]{1,40})/.exec(html)?.[1]?.trim() ??
        ''
      return { title, author, cover }
    } catch {
      return { title: '', author: '' }
    }
  }

  return {
    id: 'fanqie',
    label: '番茄小说',

    async login({ cookie: raw }) {
      const value = String(raw ?? '').trim()
      if (value === '') throw new ProviderError('BADREQ', 'Cookie 是空的。')
      // 用一次目录请求确认网络与登录头都被接受。
      try {
        await directory('7143038691944959011')
      } catch (error) {
        if (error?.code === 'AUTH') throw error
        throw new ProviderError('AUTH', '这段 Cookie 没被番茄接受，或当前网络访问不了番茄。')
      }
      return { account: '番茄账号', shelfCount: 0 }
    },

    /** 番茄没有可用书架接口：这里返回空数组，书籍通过「链接/ID 添加」。 */
    async shelf() {
      return []
    },

    /** @param {{bookId: string, title?: string}} input */
    async toc({ bookId }) {
      const chapters = await directory(bookId)
      const meta = await pageMeta(bookId)
      return {
        title: meta.title || `番茄小说 ${bookId}`,
        author: meta.author,
        cover: meta.cover ?? '',
        chapters: chapters.map((chapter) => ({
          title: chapter.locked ? `${chapter.title}（付费）` : chapter.title,
          chapterId: chapter.chapterId,
          locked: chapter.locked,
        })),
      }
    },

    /** @param {{book: object, chapter: object}} input */
    async chapter({ book, chapter }) {
      const itemId = String(chapter.chapterId ?? '')
      if (itemId === '') throw new ProviderError('BADREQ', '这一章没有 itemId。')
      const sessionCookie = await cookie()

      // 1) 先试接口（登录态正常时偶尔能给纯文本）
      let text = ''
      try {
        const payload = await requestJson(`${ORIGIN}/api/reader/full?itemId=${encodeURIComponent(itemId)}`, {
          cookie: sessionCookie,
          referer: `${ORIGIN}/reader/${itemId}`,
          timeoutMs: TIMEOUT_MS,
        })
        const content = payload.json?.data?.content
        if (typeof content === 'string' && content.trim() !== '') text = stripTags(content)
      } catch {
        // 接口不可用是常态，继续走 SSR。
      }

      // 2) 退到服务端渲染的阅读页
      if (text.trim() === '') {
        const response = await request(`${ORIGIN}/reader/${itemId}`, {
          cookie: sessionCookie,
          referer: `${ORIGIN}/page/${book.sourceId}`,
          timeoutMs: TIMEOUT_MS,
          accept: 'text/html,application/xhtml+xml',
        })
        const html = await response.text()
        const match = /<div class="muye-reader-content[^"]*">([\s\S]*?)<\/div>/.exec(html)
        if (match) text = stripTags(match[1])
      }

      if (text.trim() === '') {
        throw new ProviderError('UPSTREAM', '番茄这一章没有返回可读正文（可能需要登录、付费，或被风控拦截）。')
      }

      const paragraphs = paragraphsOf(text)
      const joined = paragraphs.join('')
      const puaCount = countPrivateUse(joined)
      if (puaCount / Math.max(joined.length, 1) > 0.02) {
        throw new ProviderError(
          'OBFUSCATED',
          '这一章的正文被番茄换成了私用区字形（字体反爬），抓下来只能是乱码。请在番茄 App/网页里读这一章，或用「粘贴正文」把它导进灯下。',
          { ratio: Number((puaCount / Math.max(joined.length, 1)).toFixed(3)) },
        )
      }

      return {
        title: chapter.title,
        blocks: paragraphs.map((line) => ({ t: 'p', x: line })),
      }
    },

    /** 从链接或纯 id 解析书；界面「添加番茄书籍」用。 */
    resolve(input) {
      const bookId = extractBookId(input)
      if (bookId === '') throw new ProviderError('BADREQ', '没认出番茄的书 id，请粘贴 `fanqienovel.com/page/<id>` 链接。')
      return bookId
    },
  }
}
