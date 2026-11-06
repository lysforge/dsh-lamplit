/**
 * Host 半边的最小冒烟：直接喂 Request 给路由，不经过 webServer。
 * 跑法：node --test test/api.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { createApi } from '../lib/api.js'

const MARKDOWN = `---
title: 山中一日
author: 测试作者
---

# 第一章 上山

清晨的雾还没散，石阶上**湿得很**，我数到第七十三级时听见了钟声。

> 山不来就我，我便去就山。

## 第一节 松林

松针铺了满地，踩上去像踩着一层旧棉被。

- 溪水是凉的
- 石头是干的
- 时间是慢的

\`\`\`js
const mountain = 'quiet'
\`\`\`

## 第二章 下山

下山时天已经黑了，回头看不见山顶，只看见一片墨色的轮廓。
`

const TXT = `第一章　起风

风从北边来，带着一点铁锈味。

他把窗关上，又打开。

第二章　落雨

雨下了三天，院子里的水缸满了。
`

async function tempHome() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'lamplit-test-'))
  return dir
}

function request(pathname, { method = 'GET', body } = {}) {
  const url = `http://127.0.0.1:1234${pathname}`
  return new Request(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function readJson(response) {
  return JSON.parse(await response.text())
}

test('state 一开始是空的，且带默认设置', async () => {
  const home = await tempHome()
  const api = createApi({ config: { root: home } })
  const data = await readJson(await api.handle(request('/lamplit/api/state')))
  assert.equal(data.ok, true)
  assert.equal(data.shelf.length, 0)
  assert.equal(data.settings.fontSize, 19)
  assert.equal(data.settings.theme, 'paper')
  assert.equal(data.providers.length, 1)
  assert.equal(data.providers[0].id, 'weread')
  assert.equal(data.providers[0].connected, false)
})

test('导入 Markdown：切章、保留引用与代码块、去掉行内标记', async () => {
  const home = await tempHome()
  const api = createApi({ config: { root: home } })
  const imported = await readJson(
    await api.handle(
      request('/lamplit/api/import', {
        method: 'POST',
        body: { name: '山中一日.md', dataBase64: Buffer.from(MARKDOWN).toString('base64') },
      }),
    ),
  )
  assert.equal(imported.ok, true)
  assert.equal(imported.book.title, '山中一日')
  assert.equal(imported.book.author, '测试作者')
  assert.equal(imported.toc.length, 2)
  assert.equal(imported.toc[0].title, '第一章 上山')
  assert.ok(imported.book.chars > 60)

  const chapter = await readJson(
    await api.handle(request(`/lamplit/api/book/${imported.book.id}/chapter/0`)),
  )
  assert.equal(chapter.ok, true)
  const kinds = chapter.chapter.blocks.map((block) => block.t)
  assert.ok(kinds.includes('p'))
  assert.ok(kinds.includes('q'), '引用块应该保留')
  assert.ok(kinds.includes('li'), '列表项应该保留')
  assert.ok(kinds.includes('code'), '代码块应该保留')
  const joined = chapter.chapter.blocks.map((block) => block.x ?? '').join('\n')
  assert.ok(!joined.includes('**'), '行内加粗标记应该被去掉')
  assert.ok(joined.includes('湿得很'))
  assert.equal(chapter.next, 1)
  assert.equal(chapter.prev, null)
})

test('导入 TXT：按「第 X 章」切章', async () => {
  const home = await tempHome()
  const api = createApi({ config: { root: home } })
  const imported = await readJson(
    await api.handle(
      request('/lamplit/api/import', {
        method: 'POST',
        body: { name: '风.txt', dataBase64: Buffer.from(TXT).toString('base64') },
      }),
    ),
  )
  assert.equal(imported.ok, true)
  assert.equal(imported.toc.length, 2)
  assert.match(imported.toc[0].title, /起风/)
})

test('进度写入后能在 state 里读回来', async () => {
  const home = await tempHome()
  const api = createApi({ config: { root: home } })
  const imported = await readJson(
    await api.handle(
      request('/lamplit/api/import', {
        method: 'POST',
        body: { name: '风.txt', dataBase64: Buffer.from(TXT).toString('base64') },
      }),
    ),
  )
  const updated = await readJson(
    await api.handle(
      request('/lamplit/api/progress', {
        method: 'POST',
        body: { bookId: imported.book.id, chapterIndex: 1, percent: 0.5, seconds: 90 },
      }),
    ),
  )
  assert.equal(updated.ok, true)
  assert.equal(updated.book.progress.chapterIndex, 1)
  assert.equal(updated.book.progress.percent, 0.5)

  const state = await readJson(await api.handle(request('/lamplit/api/state')))
  assert.equal(state.shelf.length, 1)
  assert.equal(state.shelf[0].progress.chapterIndex, 1)
  assert.ok(state.stats.seconds >= 90)
})

test('设置越界值会被收敛', async () => {
  const home = await tempHome()
  const api = createApi({ config: { root: home } })
  const data = await readJson(
    await api.handle(
      request('/lamplit/api/settings', {
        method: 'POST',
        body: { patch: { fontSize: 99, lineHeight: 0.2, theme: 'neon', mode: 'paged' } },
      }),
    ),
  )
  assert.equal(data.settings.fontSize, 32)
  assert.equal(data.settings.lineHeight, 1.4)
  assert.equal(data.settings.theme, 'paper')
  assert.equal(data.settings.mode, 'paged')
})

test('不支持的扩展名与空文件都给出明确失败', async () => {
  const home = await tempHome()
  const api = createApi({ config: { root: home } })
  const bad = await readJson(
    await api.handle(
      request('/lamplit/api/import', {
        method: 'POST',
        body: { name: 'a.epub', dataBase64: Buffer.from('x').toString('base64') },
      }),
    ),
  )
  assert.equal(bad.ok, false)
  assert.equal(bad.code, 'FORMAT')

  const empty = await readJson(
    await api.handle(request('/lamplit/api/import', { method: 'POST', body: { name: 'a.md', dataBase64: '' } })),
  )
  assert.equal(empty.ok, false)
})

test('未登录时来源接口给出 AUTH，删除书后书架为空', async () => {
  const home = await tempHome()
  const api = createApi({ config: { root: home } })
  const sync = await readJson(await api.handle(request('/lamplit/api/provider/weread/sync', { method: 'POST' })))
  assert.equal(sync.ok, false)
  assert.equal(sync.code, 'AUTH')

  const imported = await readJson(
    await api.handle(
      request('/lamplit/api/import', {
        method: 'POST',
        body: { name: '风.txt', dataBase64: Buffer.from(TXT).toString('base64') },
      }),
    ),
  )
  const removed = await readJson(
    await api.handle(request(`/lamplit/api/book/${imported.book.id}`, { method: 'DELETE' })),
  )
  assert.equal(removed.ok, true)
  const state = await readJson(await api.handle(request('/lamplit/api/state')))
  assert.equal(state.shelf.length, 0)
})

test('粘贴正文可以直接变成一本书', async () => {
  const home = await tempHome()
  const api = createApi({ config: { root: home } })
  const created = await readJson(
    await api.handle(
      request('/lamplit/api/import-text', {
        method: 'POST',
        body: { title: '第十章 空屋', author: '某人', text: '旧钨丝灯的黑线悬在屋子中央。\n\n静谧的气氛像墨汁。' },
      }),
    ),
  )
  assert.equal(created.ok, true)
  assert.equal(created.book.title, '第十章 空屋')
  assert.equal(created.toc.length, 1)
  const chapter = await readJson(await api.handle(request(`/lamplit/api/book/${created.book.id}/chapter/0`)))
  assert.equal(chapter.chapter.blocks.length, 2)
})

test('笔记：写入、按书列出、删除', async () => {
  const home = await tempHome()
  const api = createApi({ config: { root: home } })
  const imported = await readJson(
    await api.handle(
      request('/lamplit/api/import', {
        method: 'POST',
        body: { name: '风.txt', dataBase64: Buffer.from(TXT).toString('base64') },
      }),
    ),
  )
  const created = await readJson(
    await api.handle(
      request('/lamplit/api/notes', {
        method: 'POST',
        body: {
          bookId: imported.book.id,
          chapterIndex: 0,
          chapterTitle: '第一章　起风',
          quote: '风从北边来，带着一点铁锈味。',
          note: '这里的铁锈味指血。',
          mode: 'note',
        },
      }),
    ),
  )
  assert.equal(created.ok, true)
  assert.match(created.note.id, /^nt_/)

  const listed = await readJson(
    await api.handle(request(`/lamplit/api/notes?bookId=${imported.book.id}`)),
  )
  assert.equal(listed.notes.length, 1)
  assert.equal(listed.notes[0].bookTitle, imported.book.title)

  const chapter = await readJson(await api.handle(request(`/lamplit/api/book/${imported.book.id}/chapter/0`)))
  assert.equal(chapter.notes.length, 1, '章节响应里应该带上该章笔记')

  const state = await readJson(await api.handle(request('/lamplit/api/state')))
  assert.equal(state.shelf[0].notes, 1)

  const removed = await readJson(
    await api.handle(request(`/lamplit/api/notes/${created.note.id}`, { method: 'DELETE' })),
  )
  assert.equal(removed.ok, true)
  const after = await readJson(await api.handle(request(`/lamplit/api/notes?bookId=${imported.book.id}`)))
  assert.equal(after.notes.length, 0)
})

test('划词 AI：走宿主 llm 服务，拼好上下文', async () => {
  const home = await tempHome()
  const seen = []
  const fakeCtx = {
    logger: { warn: () => {}, info: () => {} },
    get: (name) => {
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'demo', model: 'demo-1' }) }
      if (name === 'llm') {
        return {
          stream(options) {
            seen.push(options)
            return (async function* () {
              yield { type: 'text-delta', index: 0, text: '这段在说' }
              yield { type: 'text-delta', index: 0, text: '风向的变化。' }
              yield { type: 'finish', reason: { kind: 'stop' } }
            })()
          },
        }
      }
      return undefined
    },
  }
  const api = createApi({ ctx: fakeCtx, config: { root: home } })
  const answer = await readJson(
    await api.handle(
      request('/lamplit/api/ai/ask', {
        method: 'POST',
        body: {
          text: '风从北边来，带着一点铁锈味。',
          mode: 'explain',
          bookTitle: '风',
          contextTitle: '第一章　起风',
        },
      }),
    ),
  )
  assert.equal(answer.ok, true)
  assert.equal(answer.answer, '这段在说风向的变化。')
  assert.equal(answer.provider, 'demo')
  const prompt = seen[0].messages[0].content[0].text
  assert.match(prompt, /书名：风/)
  assert.match(prompt, /章节：第一章/)
  assert.match(prompt, /解释/)
})

test('没有默认模型时，划词 AI 给出明确失败', async () => {
  const home = await tempHome()
  const api = createApi({
    ctx: {
      logger: { warn: () => {} },
      get: (name) => (name === 'agentDefaultModel' ? { currentSelection: () => null } : undefined),
    },
    config: { root: home },
  })
  const answer = await readJson(
    await api.handle(request('/lamplit/api/ai/ask', { method: 'POST', body: { text: '一句', mode: 'explain' } })),
  )
  assert.equal(answer.ok, false)
  assert.equal(answer.code, 'AI')
})

test('影印 PDF：原始文件可下载，支持 Range', async () => {
  const home = await tempHome()
  await fsp.mkdir(path.join(home, 'books'), { recursive: true })
  await fsp.mkdir(path.join(home, 'files'), { recursive: true })
  const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'utf8')
  await fsp.writeFile(path.join(home, 'files', 'bk_scan0001.pdf'), pdfBytes)
  await fsp.writeFile(
    path.join(home, 'state.json'),
    JSON.stringify({
      version: 1,
      settings: {},
      providers: {},
      books: [
        {
          id: 'bk_scan0001',
          title: '影印样张',
          author: '',
          source: 'local',
          sourceId: null,
          format: 'pdf-scan',
          chapterCount: 0,
          chars: 0,
          pages: 3,
          addedAt: 1,
          lastOpenedAt: 0,
          finished: false,
          progress: { chapterIndex: 0, percent: 0, charsRead: 0, updatedAt: 0 },
        },
      ],
      stats: { seconds: 0, opened: 0 },
    }),
  )
  await fsp.writeFile(path.join(home, 'books', 'bk_scan0001.json'), JSON.stringify({ book: {}, chapters: [] }))

  const api = createApi({ config: { root: home } })
  const full = await api.handle(request('/lamplit/api/book/bk_scan0001/file'))
  assert.equal(full.status, 200)
  assert.equal(full.headers.get('content-type'), 'application/pdf')
  assert.equal((await full.arrayBuffer()).byteLength, pdfBytes.byteLength)

  const partial = await api.handle(
    new Request('http://127.0.0.1:1234/lamplit/api/book/bk_scan0001/file', { headers: { range: 'bytes=0-9' } }),
  )
  assert.equal(partial.status, 206)
  assert.equal(partial.headers.get('content-range'), `bytes 0-9/${pdfBytes.byteLength}`)

  const state = await readJson(await api.handle(request('/lamplit/api/state')))
  assert.equal(state.shelf[0].format, 'pdf-scan')
  assert.equal(state.shelf[0].pages, 3)
})

test('导出：书单与笔记都是可直接保存的 Markdown', async () => {
  const home = await tempHome()
  const api = createApi({ config: { root: home } })
  const imported = await readJson(
    await api.handle(
      request('/lamplit/api/import', {
        method: 'POST',
        body: { name: '风.txt', dataBase64: Buffer.from(TXT).toString('base64') },
      }),
    ),
  )
  await api.handle(
    request('/lamplit/api/notes', {
      method: 'POST',
      body: { bookId: imported.book.id, chapterIndex: 0, chapterTitle: '第一章　起风', quote: '风从北边来。', note: '风声是警告。', mode: 'explain' },
    }),
  )
  await api.handle(
    request('/lamplit/api/progress', { method: 'POST', body: { bookId: imported.book.id, chapterIndex: 1, percent: 0.5, seconds: 600 } }),
  )

  const shelf = await readJson(await api.handle(request('/lamplit/api/shelf/export')))
  assert.equal(shelf.ok, true)
  assert.match(shelf.filename, /书单-\d{4}-\d{2}-\d{2}\.md$/)
  assert.match(shelf.markdown, /# 我的书架 · /)
  assert.match(shelf.markdown, /风/)

  const notesExport = await readJson(await api.handle(request(`/lamplit/api/notes/export?bookId=${imported.book.id}`)))
  assert.equal(notesExport.ok, true)
  assert.equal(notesExport.count, 1)
  assert.match(notesExport.markdown, /# .* · 读书笔记/)
  assert.match(notesExport.markdown, /> 风从北边来。/)
  assert.match(notesExport.markdown, /\*\*解释\*\*/)

  const state = await readJson(await api.handle(request('/lamplit/api/state')))
  assert.equal(state.stats.today, 600)
  assert.equal(state.stats.week, 600)
  assert.ok(state.stats.streak >= 1)
  assert.equal(Object.keys(state.stats.days).length, 1)
})

test('今日一句取自书架里的正文，不是写死的句子', async () => {
  const home = await tempHome()
  const api = createApi({ config: { root: home } })
  const empty = await readJson(await api.handle(request('/lamplit/api/quote')))
  assert.equal(empty.ok, true)
  assert.equal(empty.quote, null)

  await api.handle(
    request('/lamplit/api/import', {
      method: 'POST',
      body: { name: '风.txt', dataBase64: Buffer.from(TXT).toString('base64') },
    }),
  )
  const quote = await readJson(await api.handle(request('/lamplit/api/quote')))
  assert.equal(quote.ok, true)
  assert.ok(typeof quote.quote.text === 'string' && quote.quote.text.length > 0)
  assert.match(quote.quote.bookTitle, /风/)
})
