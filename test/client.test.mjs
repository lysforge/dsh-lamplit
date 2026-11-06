/**
 * client.js 的静态契约检查。
 *
 * 存在的理由很具体：重写侧栏图标时误删了一整块 `const IconX = ...` 定义，
 * 语法检查过得去，一渲染就 `ReferenceError: IconNote is not defined`，
 * 整个面板黑屏。这条测试专门盯这类「用了没定义」。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const file = path.join(import.meta.dirname, '..', 'client.js')
const code = fs.readFileSync(file, 'utf8')

test('模块以正确的 id 注册，且只 require react', () => {
  assert.match(code, /window\.__ModuleLoader__\.load\(/)
  assert.match(code, /id:\s*'dsh-lamplit'/)
  const requires = [...code.matchAll(/require\(([^)]*)\)/g)].map((match) => match[1].trim())
  for (const target of requires) {
    assert.equal(target, "'react'", `client.js 只能 require('react')，发现了 ${target}`)
  }
})

test('注册了两个 slot：侧栏入口与主面板', () => {
  assert.match(code, /name:\s*'sidebar\.panellist'/)
  assert.match(code, /id:\s*'lamplit'/)
  assert.match(code, /name:\s*'main'/)
  assert.match(code, /key:\s*'lamplit'/)
})

test('每个用到的 IconX 都有定义（防黑屏）', () => {
  const used = new Set([...code.matchAll(/\bh\((Icon[A-Z][A-Za-z]*)/g)].map((match) => match[1]))
  // 也覆盖 { icon: IconX } 这类引用
  for (const match of code.matchAll(/icon:\s*(Icon[A-Z][A-Za-z]*)/g)) used.add(match[1])
  const defined = new Set([...code.matchAll(/const (Icon[A-Z][A-Za-z]*) =/g)].map((match) => match[1]))
  const missing = [...used].filter((name) => !defined.has(name))
  assert.deepEqual(missing, [], `这些图标被用了但没有定义：${missing.join(', ')}`)
  assert.ok(used.size > 10, `图标引用数看起来不对：${used.size}`)
})

test('样式只用 pb- 前缀的 class，且不碰宿主 DOM', () => {
  const classes = new Set()
  for (const match of code.matchAll(/className:\s*'([^']+)'/g)) {
    for (const token of match[1].split(/\s+/)) if (token !== '') classes.add(token)
  }
  for (const token of classes) {
    assert.ok(token.startsWith('pb-'), `class 没有 pb- 前缀：${token}`)
  }
  const documentUses = [...code.matchAll(/document\.([a-zA-Z]+)/g)].map((match) => match[1])
  for (const use of documentUses) {
    assert.ok(['createElement', 'body'].includes(use), `client.js 不应操作 document.${use}`)
  }
})

test('文案键在 zh / en 两套词典里都存在', () => {
  const ns = code.indexOf("ctx.locale.register(NS, 'zh'")
  const en = code.indexOf("ctx.locale.register(NS, 'en'")
  assert.ok(ns > 0 && en > 0, '没有找到中英词典注册')
  const used = new Set([...code.matchAll(/\bt\('([a-z]+\.[A-Za-z0-9.]+)'/g)].map((match) => match[1]))
  for (const key of used) {
    assert.ok(code.includes(`'${key}':`), `文案键没有定义：${key}`)
  }
})
