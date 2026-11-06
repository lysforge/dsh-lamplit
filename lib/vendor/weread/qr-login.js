/*!
 * Vendored from dsh-weread 1.9.1 (MIT License, © dsh-weread contributors) — qr-login.js
 * 只改了两处相对路径（reader.js / qrcode-generator.cjs 都在本目录）。见 NOTICE.md。
 */
/**
 * WeRead web QR login.
 *
 * Flow (same as the official weread.qq.com page):
 *   1. POST /web/login/getuid            → uid
 *   2. show QR for confirm?pf=2&uid=…
 *   3. POST /web/login/getinfo { uid }   → long-poll until scan
 *   4. POST /web/login/weblogin
 *   5. POST /web/login/session/init      → Set-Cookie (wr_vid / wr_skey / …)
 */

import { createRequire } from 'node:module'
import { USER_AGENT } from './reader.js'

const qrcode = createRequire(import.meta.url)('./qrcode-generator.cjs')

const CONFIRM_PREFIX = 'https://weread.qq.com/web/confirm?pf=2&uid='

/** Collect Set-Cookie values from a fetch Response. */
function setCookiesOf(response) {
  if (typeof response.headers.getSetCookie === 'function') return response.headers.getSetCookie()
  const single = response.headers.get('set-cookie')
  return single ? [single] : []
}

/** Merge Set-Cookie headers into a Cookie header string. */
export function cookieHeaderFromSetCookies(setCookies, previous = '') {
  const jar = {}
  if (typeof previous === 'string' && previous.length > 0) {
    for (const part of previous.split(';')) {
      const index = part.indexOf('=')
      if (index <= 0) continue
      jar[part.slice(0, index).trim()] = part.slice(index + 1).trim()
    }
  }
  for (const raw of setCookies) {
    const first = String(raw).split(';', 1)[0]
    const index = first.indexOf('=')
    if (index <= 0) continue
    const name = first.slice(0, index).trim()
    const value = first.slice(index + 1).trim()
    if (name.length > 0 && value.length > 0) jar[name] = value
  }
  return Object.entries(jar)
    .filter(([, value]) => value.length > 0)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

/** Encode a URL as an SVG QR code (no network). */
export function qrSvg(text) {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  if (typeof qr.createSvgTag === 'function') {
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
  }
  return qr.createSvgTag(4, 2)
}

/** One JSON POST to weread.qq.com login endpoints. */
async function postJson(url, body, { cookie, signal, timeoutMs = 60000 } = {}) {
  const headers = {
    accept: 'application/json, text/plain, */*',
    'content-type': 'application/json;charset=UTF-8',
    origin: 'https://weread.qq.com',
    referer: 'https://weread.qq.com/',
    'user-agent': USER_AGENT,
  }
  if (typeof cookie === 'string' && cookie.length > 0) headers.cookie = cookie
  const deadline = AbortSignal.timeout(timeoutMs)
  const combined = signal === undefined ? deadline : AbortSignal.any([signal, deadline])
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: body === undefined ? '{}' : JSON.stringify(body),
    signal: combined,
  })
  const cookies = setCookiesOf(response)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.errmsg ?? payload?.errMsg ?? `HTTP ${response.status}`
    const error = new Error(`微信读书登录失败：${message}`)
    error.status = response.status
    error.payload = payload
    throw error
  }
  return { payload, cookies }
}

/**
 * Start a QR login session.
 * @returns uid, confirm URL and an SVG QR image.
 */
export async function startQrLogin(signal) {
  const { payload } = await postJson('https://weread.qq.com/web/login/getuid', {}, { signal, timeoutMs: 15000 })
  const uid = typeof payload?.uid === 'string' ? payload.uid : ''
  if (uid.length === 0) {
    throw new Error('微信读书没有返回登录 uid，请稍后重试。')
  }
  const confirmUrl = `${CONFIRM_PREFIX}${encodeURIComponent(uid)}`
  return {
    uid,
    confirmUrl,
    qrSvg: qrSvg(confirmUrl),
    expiresAt: Date.now() + 4 * 60 * 1000,
  }
}

/**
 * Wait until the QR is scanned, then exchange the scan for a Cookie header.
 * @param uid - from {@link startQrLogin}.
 * @returns `{ cookie, vid }` on success.
 */
export async function completeQrLogin(uid, signal) {
  if (typeof uid !== 'string' || uid.length === 0) {
    throw new Error('缺少登录 uid。')
  }
  const info = await postJson(
    'https://weread.qq.com/web/login/getinfo',
    { uid },
    { signal, timeoutMs: 120000 },
  )
  const scan = info.payload ?? {}
  if (scan.scanCount === 0 || (scan.skey === undefined && scan.code === undefined && scan.vid === undefined)) {
    const error = new Error('二维码尚未确认或已过期，请重新扫码。')
    error.code = 'weread/qr-pending'
    throw error
  }

  const loginBody = {
    skey: scan.skey,
    vid: scan.vid,
    redirect_uri: scan.redirect_uri,
    pf: scan.pf ?? 2,
    code: scan.code,
    expireMode: scan.expireMode ?? 0,
    isAutoLogout: scan.isAutoLogout ?? 0,
  }
  const login = await postJson('https://weread.qq.com/web/login/weblogin', loginBody, { signal, timeoutMs: 20000 })
  let cookie = cookieHeaderFromSetCookies(login.cookies, cookieHeaderFromSetCookies(info.cookies))

  const session = await postJson(
    'https://weread.qq.com/web/login/session/init',
    { vid: scan.vid ?? login.payload?.vid ?? 0, skey: scan.skey ?? login.payload?.skey, localVid: 0 },
    { cookie, signal, timeoutMs: 20000 },
  )
  cookie = cookieHeaderFromSetCookies(session.cookies, cookie)
  if (!cookie.includes('wr_vid=') || !cookie.includes('wr_skey=')) {
    throw new Error('扫码成功，但没有拿到 wr_vid / wr_skey。请改用粘贴 Cookie。')
  }
  return {
    cookie,
    vid: scan.vid ?? login.payload?.vid,
  }
}
