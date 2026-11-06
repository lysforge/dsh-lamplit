/*!
 * Vendored from dsh-weread 1.9.1 (MIT License, © dsh-weread contributors) — lib/web.js
 * 只做来源标注，逻辑未改动。见 NOTICE.md。
 */
/**
 * Cookie-authenticated calls against weread.qq.com (not the Skills gateway).
 *
 * Shelf, search, book info and progress all work with the same Web session
 * the QR login / pasted Cookie produces. The chapter decoder still lives in
 * reader.js; this module only covers metadata.
 */

import { throwIfWereadPayloadError, USER_AGENT, warmWereadOrigin, WereadReaderError } from './reader.js'

/** Combine a caller signal with a request deadline. */
function withDeadline(signal, timeoutMs) {
  const deadline = AbortSignal.timeout(timeoutMs)
  return signal === undefined ? deadline : AbortSignal.any([signal, deadline])
}

/** Coerce a number-like field. */
function numberOr(value, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export class WereadWebApi {
  /**
   * @param options - session wiring, shared with the chapter reader.
   */
  constructor({ getCookie, getTimeoutMs, onCookieRefresh, logger }) {
    this.getCookie = getCookie
    this.timeoutMs = typeof getTimeoutMs === 'function' ? getTimeoutMs : () => getTimeoutMs ?? 20000
    this.onCookieRefresh = onCookieRefresh
    this.logger = logger
  }

  /** True when a usable Web session is configured. */
  hasSession() {
    const cookie = this.getCookie()
    return typeof cookie === 'string' && cookie.includes('wr_vid=') && cookie.includes('wr_skey=')
  }

  /**
   * One request against weread.qq.com.
   * Search is allowed without a session; everything else needs cookies.
   */
  async request(url, { method = 'GET', body, requireSession = true, signal } = {}) {
    if (requireSession && !this.hasSession()) {
      throw new WereadReaderError(
        'weread/needs-cookie',
        '尚未登录微信读书。请在「设置」里扫码，或粘贴 weread.qq.com 的 Cookie（须含 wr_vid 与 wr_skey）。',
      )
    }
    const cookie = this.getCookie()
    await warmWereadOrigin(typeof cookie === 'string' ? cookie : '', signal)
    const headers = {
      accept: 'application/json, text/plain, */*',
      origin: 'https://weread.qq.com',
      referer: 'https://weread.qq.com/',
      'user-agent': USER_AGENT,
    }
    if (typeof cookie === 'string' && cookie.length > 0) headers.cookie = cookie
    if (body !== undefined) headers['content-type'] = 'application/json;charset=UTF-8'

    let response
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'follow',
        signal: withDeadline(signal, this.timeoutMs()),
      })
    } catch (error) {
      if (error?.name === 'TimeoutError') {
        throw new WereadReaderError('weread/timeout', '请求微信读书超时。')
      }
      if (signal?.aborted === true) throw error
      throw new WereadReaderError('weread/network', `无法连接微信读书：${error?.message ?? String(error)}`)
    }

    const refreshed = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
    if (refreshed.length > 0 && typeof this.onCookieRefresh === 'function') {
      this.onCookieRefresh(refreshed)
    }
    if (response.status === 401 || response.status === 403) {
      throw new WereadReaderError('weread/session-expired', '登录已过期，请重新扫码或更新 Cookie。')
    }
    if (!response.ok) {
      throw new WereadReaderError(
        `weread/web-http-${response.status}`,
        `微信读书返回 HTTP ${response.status}。`,
      )
    }
    const payload = await response.json().catch(() => ({}))
    throwIfWereadPayloadError(payload)
    return payload
  }

  /** Bookshelf snapshot. */
  async shelf(signal) {
    const payload = await this.request(
      'https://weread.qq.com/web/shelf/sync?synckey=0&teenmode=0&lectureSynckey=0',
      { signal },
    )
    return payload
  }

  /** Book detail. */
  async bookInfo(bookId, signal) {
    const url = `https://weread.qq.com/web/book/info?bookId=${encodeURIComponent(bookId)}`
    return this.request(url, { signal })
  }

  /** Reading progress. */
  async progress(bookId, signal) {
    const url = `https://weread.qq.com/web/book/getProgress?bookId=${encodeURIComponent(bookId)}`
    return this.request(url, { signal })
  }

  /** Store search; works for many queries even without a session. */
  async search(keyword, count = 20, signal) {
    const url =
      'https://weread.qq.com/web/search/global?' +
      new URLSearchParams({
        keyword,
        maxIdx: '0',
        count: String(count),
        fragmentSize: '120',
        scope: '11',
      }).toString()
    return this.request(url, { requireSession: false, signal })
  }

  /** Highlights for one book. */
  async bookmarks(bookId, signal) {
    const url = `https://weread.qq.com/web/book/bookmarklist?bookId=${encodeURIComponent(bookId)}`
    return this.request(url, { signal })
  }

  /** Normalize one shelf book record from several Web payload shapes. */
  static normalizeBook(raw) {
    const book = raw?.book && typeof raw.book === 'object' ? raw.book : raw ?? {}
    const progress = numberOr(raw?.progress ?? book.progress ?? book.readingProgress, -1)
    return {
      bookId: String(book.bookId ?? raw?.bookId ?? ''),
      title: String(book.title ?? '未命名'),
      author: String(book.author ?? ''),
      cover: String(book.cover ?? ''),
      category: String(book.category ?? ''),
      intro: String(book.intro ?? ''),
      readUpdateTime: numberOr(raw?.readUpdateTime ?? book.readUpdateTime, 0),
      finishReading: numberOr(raw?.finishReading ?? book.finishReading, 0) === 1,
      secret: numberOr(raw?.secret ?? book.secret, 0) === 1,
      progress: progress >= 0 ? Math.max(0, Math.min(100, progress)) : undefined,
      chapterUid: numberOr(raw?.chapterUid ?? book.chapterUid, 0) || undefined,
      readingTime: numberOr(raw?.readingTime ?? book.readingTime ?? raw?.recordReadingTime, 0) || undefined,
      kind: 'book',
    }
  }

  /**
   * Index `bookProgress` (and similar arrays) from a shelf/sync payload.
   * @param payload - raw `/web/shelf/sync` JSON.
   * @returns Map of bookId → { progress, chapterUid, readingTime, updateTime }.
   */
  static progressIndex(payload) {
    const index = new Map()
    const lists = [payload?.bookProgress, payload?.progress, payload?.recent, payload?.readProgress]
    for (const list of lists) {
      if (!Array.isArray(list)) continue
      for (const item of list) {
        const bookId = String(item?.bookId ?? item?.book?.bookId ?? '')
        if (bookId.length === 0) continue
        index.set(bookId, {
          progress: numberOr(item?.progress ?? item?.readingProgress, 0),
          chapterUid: numberOr(item?.chapterUid, 0),
          chapterOffset: numberOr(item?.chapterOffset, 0),
          readingTime: numberOr(item?.readingTime ?? item?.recordReadingTime, 0),
          updateTime: numberOr(item?.updateTime ?? item?.readingTimeStamp, 0),
        })
      }
    }
    return index
  }
}
