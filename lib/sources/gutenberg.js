/**
 * Project Gutenberg（古登堡计划）—— 公版书，不需要账号。
 *
 * 元数据走 gutendex.com 的 JSON 接口；下载优先 EPUB，没有就退纯文本。
 */
import { ProviderError } from '../http.js'

const BASE = 'https://gutendex.com/books'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

function formatUrl(formats, prefix) {
  for (const [type, url] of Object.entries(formats || {})) {
    if (type.startsWith(prefix) && typeof url === 'string' && url !== '') return url
  }
  return ''
}

function authorOf(book) {
  const first = Array.isArray(book.authors) ? book.authors[0] : null
  if (!first || typeof first.name !== 'string') return ''
  const [last, ...rest] = first.name.split(',')
  return rest.length > 0 ? `${rest.join(',').trim()} ${last.trim()}` : first.name.trim()
}

export const gutenberg = {
  id: 'gutenberg',
  label: '古登堡',
  note: 'Project Gutenberg · 公版书 · 不需要账号',

  async search(query) {
    const url = `${BASE}?search=${encodeURIComponent(query)}`
    let payload
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      payload = await response.json()
    } catch (error) {
      throw new ProviderError('NET', `连不上古登堡：${error?.message ?? String(error)}`)
    }
    return (payload?.results ?? []).slice(0, 24).map((book) => ({
      id: String(book.id),
      title: String(book.title ?? '').trim(),
      author: authorOf(book),
      cover: formatUrl(book.formats, 'image/jpeg'),
      language: Array.isArray(book.languages) ? book.languages[0] ?? '' : '',
    }))
  },

  /** @returns {{title: string, author: string, format: 'epub'|'txt', buffer: Buffer}} */
  async grab(id) {
    let book
    try {
      const response = await fetch(`${BASE}/${encodeURIComponent(id)}/`, {
        headers: { 'user-agent': UA, accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      book = await response.json()
    } catch (error) {
      throw new ProviderError('NET', `拿不到这本书的信息：${error?.message ?? String(error)}`)
    }

    const formats = book?.formats ?? {}
    const epub = formatUrl(formats, 'application/epub+zip')
    const text = formatUrl(formats, 'text/plain')
    const url = epub !== '' ? epub : text
    if (url === '') throw new ProviderError('FORMAT', '这本书没有可下载的 EPUB 或纯文本。')

    try {
      const response = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const buffer = Buffer.from(await response.arrayBuffer())
      return {
        title: String(book?.title ?? `Gutenberg ${id}`).trim(),
        author: authorOf(book),
        format: epub !== '' ? 'epub' : 'txt',
        buffer,
      }
    } catch (error) {
      throw new ProviderError('NET', `下载失败：${error?.message ?? String(error)}`)
    }
  },
}
