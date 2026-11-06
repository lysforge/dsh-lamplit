/** 出站 HTTP 小工具：超时、UA、cookie、JSON 容错。 */

export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

export class ProviderError extends Error {
  constructor(code, message, details) {
    super(message)
    this.name = 'ProviderError'
    this.code = code
    this.details = details ?? {}
  }
}

export function withDeadline(timeoutMs, signal) {
  const deadline = AbortSignal.timeout(timeoutMs)
  return signal === undefined ? deadline : AbortSignal.any([signal, deadline])
}

/**
 * @param {string} url
 * @param {{method?: string, headers?: Record<string,string>, cookie?: string, body?: unknown, timeoutMs?: number, signal?: AbortSignal, referer?: string, accept?: string}} options
 */
export async function request(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    cookie,
    body,
    timeoutMs = 20000,
    signal,
    referer,
    accept = 'application/json, text/plain, */*',
  } = options
  const finalHeaders = {
    'user-agent': BROWSER_UA,
    accept,
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
    ...headers,
  }
  if (cookie) finalHeaders.cookie = cookie
  if (referer) finalHeaders.referer = referer
  let payload = body
  if (body !== undefined && typeof body !== 'string') {
    finalHeaders['content-type'] = finalHeaders['content-type'] ?? 'application/json'
    payload = JSON.stringify(body)
  }
  let response
  try {
    response = await fetch(url, { method, headers: finalHeaders, body: payload, signal: withDeadline(timeoutMs, signal) })
  } catch (error) {
    if (error?.name === 'TimeoutError') throw new ProviderError('NET', `请求超时：${new URL(url).host}`)
    throw new ProviderError('NET', `连不上 ${new URL(url).host}：${error?.message ?? String(error)}`)
  }
  return response
}

export async function requestJson(url, options = {}) {
  const response = await request(url, options)
  const text = await response.text()
  if (text.trim() === '') {
    throw new ProviderError('NET', `${new URL(url).host} 返回了空响应（可能被风控拦截）。`, { status: response.status })
  }
  try {
    return { status: response.status, ok: response.ok, json: JSON.parse(text), text }
  } catch {
    throw new ProviderError('NET', `${new URL(url).host} 返回的不是 JSON。`, { status: response.status, sample: text.slice(0, 160) })
  }
}

export function parseCookie(raw) {
  const pairs = new Map()
  for (const part of String(raw ?? '').split(';')) {
    const index = part.indexOf('=')
    if (index <= 0) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (key !== '') pairs.set(key, value)
  }
  return pairs
}

/** 从链接里取番茄 / 微信读书的 id。 */
export function extractBookId(input) {
  const text = String(input ?? '').trim()
  if (text === '') return ''
  const fanqie = /(?:fanqienovel\.com\/(?:page|reader)\/|changdunovel\.com\/(?:page|reader)\/)(\d{6,})/.exec(text)
  if (fanqie) return fanqie[1]
  const weread = /weread\.qq\.com\/web\/book\/(?:detail\/)?([A-Za-z0-9_-]{6,})/.exec(text)
  if (weread) return weread[1]
  if (/^\d{6,}$/.test(text)) return text
  return ''
}
