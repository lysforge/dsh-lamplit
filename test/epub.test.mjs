/** EPUB 解析：不依赖外部库，测试里自己拼一个 stored(zip) 容器。 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { parseEpub } from '../lib/epub.js'

const TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function zipStore(files) {
  const chunks = []
  const central = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content)
    const nameBuffer = Buffer.from(name)
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuffer.length, 26)
    chunks.push(local, nameBuffer, data)

    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(data.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(nameBuffer.length, 28)
    entry.writeUInt32LE(offset, 42)
    central.push(entry, nameBuffer)
    offset += local.length + nameBuffer.length + data.length
  }
  const centralBuffer = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  const count = Object.keys(files).length
  eocd.writeUInt16LE(count, 8)
  eocd.writeUInt16LE(count, 10)
  eocd.writeUInt32LE(centralBuffer.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...chunks, centralBuffer, eocd])
}

function fixtureEpub() {
  return zipStore({
    mimetype: 'application/epub+zip',
    'META-INF/container.xml': `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
    'OEBPS/content.opf': `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>山中的书</dc:title>
    <dc:creator>某位作者</dc:creator>
  </metadata>
  <manifest>
    <item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="c1"/><itemref idref="c2"/></spine>
</package>`,
    'OEBPS/ch1.xhtml': `<html><body><h1>第一章 石阶</h1><p>石阶湿得很，我数到第七十三级。</p><p>钟声从雾里来。</p></body></html>`,
    'OEBPS/ch2.xhtml': `<html><body><h1>第二章 下山</h1><p>下山时天已经黑了。</p></body></html>`,
  })
}

test('EPUB：书名、作者、spine 顺序、段落都正确', () => {
  const buf = fixtureEpub()
  const parsed = parseEpub(buf)
  assert.equal(parsed.title, '山中的书')
  assert.equal(parsed.author, '某位作者')
  assert.equal(parsed.chapters.length, 2)
  assert.equal(parsed.chapters[0].title, '第一章 石阶')
  assert.equal(parsed.chapters[0].blocks.length, 2)
  assert.match(parsed.chapters[0].blocks[0].x, /第七十三级/)
  assert.equal(parsed.chapters[1].title, '第二章 下山')
})

test('EPUB：不是 zip 时明确失败', () => {
  assert.throws(() => parseEpub(Buffer.from('not a zip at all')))
})
