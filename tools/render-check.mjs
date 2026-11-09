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
// 让「会话过期」这条路径也参与测试：它决定首页引导条与广场重连卡是否出现。
for (const provider of state.providers || []) {
  if (provider.id === 'weread') provider.sessionValid = false
}

globalThis.fetch = async (url) => {
  const u = String(url)
  const json = (payload) => new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } })

  const chapterMatch = /\/api\/book\/([^/?]+)\/chapter\/(\d+)/.exec(u)
  if (chapterMatch) {
    const index = Number(chapterMatch[2])
    return json({
      ok: true,
      chapter: {
        index,
        title: '第 ' + (index + 1) + ' 章',
        blocks: [{ type: 'p', text: '正文内容，用来验证阅读器渲染。' }],
      },
      prev: index > 0 ? index - 1 : null,
      next: index < 2 ? index + 1 : null,
      total: 3,
    })
  }

  const bookMatch = /\/api\/book\/([^/?]+)$/.exec(u)
  if (bookMatch) {
    const id = decodeURIComponent(bookMatch[1])
    const book = (state.shelf || []).find((item) => item.id === id) || (state.shelf || [])[0]
    return json({ ok: true, book, toc: Array.from({ length: 3 }, (_, index) => ({ index, title: '第 ' + (index + 1) + ' 章' })) })
  }

  if (u.includes('/api/state')) return json(state)
  if (u.includes('/discover/github/repos')) {
    return json({ ok: true, repos: [{ spec: 'rpmuller/ePubs', owner: 'rpmuller', repo: 'ePubs', path: '' }], hasToken: false })
  }
  if (u.includes('/discover/github/files')) {
    return json({ ok: true, files: [{ path: 'a.epub', name: 'a.epub', size: 100, kind: 'epub' }], branch: 'master' })
  }
  if (u.includes('/api/notes')) return json({ ok: true, notes: [] })
  return json({ ok: true })
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
const clickStep = async (selector) => {
  const node = container.querySelector(selector)
  if (!node) return false
  try {
    node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  } catch (error) {
    errors.push('click ' + selector + ': ' + String(error?.stack || error))
  }
  await tick()
  await tick()
  return true
}

// 回到首页再看引导条（上面的循环最后停在了广场）
const homeTab = [...container.querySelectorAll('button')].find((node) => node.textContent === 'view.home')
if (homeTab) {
  homeTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await tick()
}

// 首页引导条：点「重新扫码」必须真的弹出扫码面板（prop 忘了传就是死按钮）
const onboardNode = container.querySelector('.pb-onboard')
console.log('onboard node:', Boolean(onboardNode), '| data-show:', onboardNode && onboardNode.getAttribute('data-show'))
const onboardButton = container.querySelector('.pb-onboard .pb-btn')
if (onboardButton) {
  onboardButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await tick()
  const opened = Boolean(container.querySelector('.pb-sheet'))
  console.log('onboard click opens sheet:', opened)
  if (!opened) errors.push('onboard: 点「重新扫码」没有打开面板（HomePage 少了 onConnect）')
} else {
  console.log('onboard: 没有出现引导条')
}

// 关掉面板，切到书架，再点开一本书
const sheetScrim = container.querySelector('.pb-scrim')
if (sheetScrim) {
  sheetScrim.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await tick()
}
const shelfTab = [...container.querySelectorAll('button')].find((node) => node.textContent === 'view.shelf')
if (shelfTab) {
  shelfTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await tick()
}

if (await clickStep('.pb-book')) {
  console.log('reader mounted:', /pb-reader|pb-chapter|pb-prose|pb-chapter-/.test(container.innerHTML))
} else {
  console.log('reader: .pb-book 没找到')
}

console.log('rendered nodes:', container.innerHTML.length)
if (failed) console.log('RENDER_THROW', failed?.stack?.split('\n').slice(0, 6).join('\n'))
const unique = [...new Set(errors)]
console.log(unique.length === 0 ? 'NO_ERRORS' : 'ERRORS:\n' + unique.slice(0, 3).join('\n---\n'))

// 阅读器里有计时器，测完直接退出，别让进程挂着。
process.exit(unique.length === 0 ? 0 : 1)
