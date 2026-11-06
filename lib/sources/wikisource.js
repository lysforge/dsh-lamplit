/**
 * 维基文库（zh.wikisource.org）—— 中文公版书与古籍，不需要账号。
 *
 * 搜索走 MediaWiki API；下载把条目的渲染 HTML 转成我们的 blocks，
 * 按标题层级切章，所以《史記》《紅樓夢》这种自带小标题的条目会直接成目录。
 */
import { htmlToBlocks } from '../epub.js'
import { ProviderError } from '../http.js'

const API = 'https://zh.wikisource.org/w/api.php'
const UA =
  'Lamplit/0.1 (DeepSeek Harness plugin; +https://github.com/lysforge/lamplit)'

async function api(params, timeoutMs = 15000) {
  const url = `${API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`
  let payload
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    payload = await response.json()
  } catch (error) {
    throw new ProviderError('NET', `连不上维基文库：${error?.message ?? String(error)}`)
  }
  return payload
}

export const wikisource = {
  id: 'wikisource',
  label: '维基文库',
  note: '中文公版书与古籍 · 不需要账号',

  async search(query) {
    const payload = await api({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: '20',
      srnamespace: '0',
    })
    const hits = payload?.query?.search ?? []
    return hits.map((hit) => ({
      id: String(hit.pageid ?? hit.title ?? ''),
      title: String(hit.title ?? ''),
      author: '',
      cover: '',
      snippet: String(hit.snippet ?? '').replace(/<[^>]+>/g, '').slice(0, 80),
    }))
  },

  /** @returns {{title: string, author: string, chapters: Array<{title: string, blocks: Array}>}} */
  async grab(title) {
    const payload = await api(
      { action: 'parse', page: title, prop: 'text|displaytitle', redirects: '1', disableeditsection: '1' },
      30000,
    )
    const html = payload?.parse?.text?.['*']
    if (typeof html !== 'string' || html.trim() === '') {
      throw new ProviderError('NOTFOUND', '维基文库没有返回这个条目的正文。')
    }
    const blocks = htmlToBlocks(html)
    if (blocks.length === 0) throw new ProviderError('FORMAT', '这一页没有可读的正文。')

    // 用二级/三级标题切章；没有标题就整篇一章。
    const chapters = []
    let current = { title: String(payload?.parse?.title ?? title), blocks: [] }
    for (const block of blocks) {
      if (block.t === 'h') {
        if (current.blocks.length > 0) chapters.push(current)
        current = { title: block.x, blocks: [] }
        continue
      }
      current.blocks.push(block)
    }
    if (current.blocks.length > 0) chapters.push(current)
    if (chapters.length === 0) chapters.push({ title: String(title), blocks })

    return {
      title: String(payload?.parse?.title ?? title).replace(/<[^>]+>/g, ''),
      author: '',
      chapters,
    }
  },
}
