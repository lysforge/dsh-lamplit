/**
 * 灯下 Lamplit — Host half.
 *
 * 自带一个小型 HTTP 面（`/lamplit/api/*`），Client 用同源 fetch 读写：
 * 书架、导入（PDF / Markdown / TXT / EPUB）、阅读进度、笔记、划词 AI，
 * 以及两个内容来源（微信读书、番茄小说）的登录与同步。
 *
 * 数据落在 `~/.dsh/lamplit/`，不出本机。
 *
 * 用 handler 路由而不是 resource 路由：resource 只接 GET/HEAD，
 * 而这套接口要 POST/DELETE。
 */
import { createApi } from './lib/api.js'

export const name = 'lamplit'

/** `webServer` 是唯一的硬依赖：没有它就无从服务 Client。 */
export const inject = ['webServer']

function toRequest(req, body) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) headers.set(key, value.join(', '))
  }
  const method = (req.method || 'GET').toUpperCase()
  const url = `http://127.0.0.1${req.url || '/'}`
  const init = { method, headers }
  if (method !== 'GET' && method !== 'HEAD' && body.byteLength > 0) init.body = body
  return new Request(url, init)
}

export function apply(ctx, config) {
  const api = createApi({ ctx, config: config ?? {} })

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: '/lamplit',
      handler: async (req, res) => {
        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const response = await api.handle(toRequest(req, Buffer.concat(chunks)))
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          ctx.logger?.warn?.('[lamplit] 请求失败：%s', error?.stack ?? String(error))
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json; charset=utf-8')
          }
          res.end(JSON.stringify({ ok: false, code: 'INTERNAL', error: error?.message ?? String(error) }))
        }
      },
    }),
  )

  ctx.logger?.info?.('[lamplit] serving /lamplit (data: %s)', api.storageDir)
}
