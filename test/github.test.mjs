/** GitHub 书库：规格解析、目录过滤、LFS 识别（全部离线，不打网络）。 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { isLfsPointer, listFiles, parseSpec, specOf } from '../lib/sources/github.js'

test('spec 解析：owner/repo、#子目录、github URL 都能吃', () => {
  assert.deepEqual(parseSpec('mozilla/pdf.js'), { owner: 'mozilla', repo: 'pdf.js', path: '' })
  assert.deepEqual(parseSpec('owner/repo#books/2020'), { owner: 'owner', repo: 'repo', path: 'books/2020' })
  assert.deepEqual(parseSpec('https://github.com/lysforge/dsh-lamplit.git'), { owner: 'lysforge', repo: 'dsh-lamplit', path: '' })
  assert.throws(() => parseSpec('nope'), /owner\/repo/)
  assert.equal(specOf({ owner: 'a', repo: 'b', path: 'c' }), 'a/b#c')
})

test('LFS 指针能被认出来', () => {
  const pointer = Buffer.from('version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 123\n')
  assert.equal(isLfsPointer(pointer), true)
  assert.equal(isLfsPointer(Buffer.from('%PDF-1.4')), false)
})

test('列目录：只留 md/txt/epub/pdf，按子目录过滤，超大文件跳过', async () => {
  const tree = {
    truncated: false,
    tree: [
      { path: 'README.md', type: 'blob', size: 900 },
      { path: 'books/a.epub', type: 'blob', size: 200 },
      { path: 'books/deep/b.pdf', type: 'blob', size: 300 },
      { path: 'books/huge.pdf', type: 'blob', size: 200 * 1024 * 1024 },
      { path: 'cover.png', type: 'blob', size: 100 },
      { path: 'books', type: 'tree' },
      { path: 'books/c.txt', type: 'blob', size: 50 },
      { path: 'books/d.mobi', type: 'blob', size: 50 },
    ],
  }
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (String(url).endsWith('/repos/o/r')) {
      return new Response(JSON.stringify({ default_branch: 'trunk' }), { status: 200 })
    }
    return new Response(JSON.stringify(tree), { status: 200 })
  }
  try {
    const listed = await listFiles({ owner: 'o', repo: 'r', path: 'books', token: '' })
    assert.equal(listed.branch, 'trunk')
    assert.deepEqual(listed.files.map((file) => file.path), ['books/a.epub', 'books/c.txt', 'books/deep/b.pdf'])
    assert.deepEqual(listed.files.map((file) => file.kind), ['epub', 'txt', 'pdf'])
    assert.ok(calls.some((url) => url.includes('/git/trees/HEAD')))
  } finally {
    globalThis.fetch = original
  }
})
