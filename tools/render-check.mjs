/**
 * 把 client.js 真挂到 jsdom 上，然后点遍每个 tab。
 *
 * 为什么需要它：`node --check` 只看语法，静态契约测试只看图标/文案键，
 * 而「渲染到某个非默认视图时 ReferenceError」只有真挂载才抓得到——
 * 广场黑屏两次都是这类问题。
 *
 * 用法：
 *   npm i --no-save jsdom react@18 react-dom@18
 *   node tools/render-check.mjs
 * 退出码 0 = 四个 tab 都渲染且无异常。
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'

const require = createRequire('/tmp/lh2/')
const React = require('react')
const { createRoot } = require('react-dom/client')

const SRC = process.env.CLIENT_JS || '/Users/abcerk/Desktop/pillowbook/client.js'
const code = fs.readFileSync(SRC, 'utf8')

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://127.0.0.1:60813/' })
const { window } = dom
globalThis.window = window
globalThis.document = window.document
try { Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true }) } catch {}
globalThis.HTMLElement = window.HTMLElement
globalThis.Element = window.Element
globalThis.Node = window.Node
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
globalThis.localStorage = window.localStorage
globalThis.IS_REACT_ACT_ENVIRONMENT = false

const errors = []
window.addEventListener('error', (event) => errors.push(String(event.error?.stack || event.message)))
const originalError = console.error
console.error = (...args) => {
  const text = args.map((a) => (a && a.stack) || String(a)).join(' ')
  if (/ReferenceError|TypeError|is not a function|Cannot read/.test(text)) errors.push(text)
}

const state = JSON.parse(fs.readFileSync('/Users/abcerk/Desktop/pillowbook/tools/fixtures/state.json', 'utf8'))
globalThis.fetch = async (url) => {
  const u = String(url)
  const payload = u.includes('/api/state')
    ? state
    : u.includes('/discover/github/repos')
      ? { ok: true, repos: [{ spec: 'rpmuller/ePubs', owner: 'rpmuller', repo: 'ePubs', path: '' }], hasToken: false }
      : u.includes('/discover/github/files')
        ? { ok: true, files: [{ path: 'a.epub', name: 'a.epub', size: 100, kind: 'epub' }], branch: 'master' }
        : u.includes('/api/notes')
          ? { ok: true, notes: [] }
          : { ok: true }
  return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } })
}

const modules = new Map()
window.__ModuleLoader__ = { load: (entry) => modules.set(entry.id, entry.factory) }
new Function('window', 'document', 'navigator', code)(window, window.document, window.navigator)

const factoryEntry = [...modules.values()][0]
const factory = factoryEntry((name) => {
  if (name === 'react') return React
  throw new Error('unexpected require: ' + name)
})
const registered = []
const ctx = {
  locale: {
    register: () => () => {},
    bind: () => (key) => String(key),
    getLocale: () => ({ id: 'zh' }),
  },
  slots: {
    inject: (name, fn) => { fn(); return () => {} },
    register: (options, component) => { registered.push([options.name, options.key || options.id, component]); return () => {} },
  },
  effect: (fn) => { fn(); return () => {} },
  on: () => () => {},
}
factory.apply(ctx)

const Page = registered.find((item) => item[0] === 'main')[2]
const container = window.document.getElementById('root')
const root = createRoot(container)

let failed = null
try {
  root.render(React.createElement(Page, {}))
} catch (error) {
  failed = error
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 30))

await tick()
const views = ['view.shelf', 'view.plaza', 'view.settings', 'view.notes', 'view.stats']
for (const label of views) {
  const button = [...container.querySelectorAll('button')].find((node) => node.textContent === label)
  if (!button) { console.log('MISSING_TAB', label); continue }
  try {
    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  } catch (error) {
    errors.push(String(error?.stack || error))
  }
  await tick()
}

// 再点开一本书 —— 阅读器是另一条渲染路径，崩溃只会在那里出现。
const firstCover = [...container.querySelectorAll('button, [role="button"], .pb-cover, li')].find((node) =>
  /pb-cover|pb-book|pb-card/.test(String(node.className || '')),
)
if (firstCover) {
  try {
    firstCover.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  } catch (error) {
    errors.push('click-cover: ' + String(error?.stack || error))
  }
  await tick()
  await tick()
  console.log('reader mounted:', /pb-reader|pb-chapter|pb-prose/.test(container.innerHTML))
} else {
  console.log('reader: no cover found to click')
}

console.log('rendered nodes:', container.innerHTML.length)
if (failed) console.log('RENDER_THROW', failed?.stack?.split('\n').slice(0, 6).join('\n'))
const unique = [...new Set(errors)]
console.log(unique.length === 0 ? 'NO_ERRORS' : 'ERRORS:\n' + unique.slice(0, 3).join('\n---\n'))
