/** 纯文本（TXT / 粘贴正文）→ 章节 / blocks。 */
import { paragraphsToBlocks, splitPlainChapters } from './text-util.js'

/**
 * @param {string} text
 * @param {{fallbackTitle?: string, author?: string, maxChars?: number}} options
 */
export function parsePlainText(text, options = {}) {
  const fallbackTitle = (options.fallbackTitle ?? '').trim()
  const groups = splitPlainChapters(text, { maxChars: options.maxChars ?? 12000 })
  const chapters = groups.map((group, index) => {
    const blocks = paragraphsToBlocks(group.paragraphs)
    return {
      title: group.title || (index === 0 ? fallbackTitle || '正文' : `第 ${index + 1} 段`),
      blocks,
      chars: blocks.reduce((sum, block) => sum + (block.x?.length ?? 0), 0),
    }
  })
  return {
    title: chapters[0]?.title && chapters[0].title !== '正文' ? chapters[0].title : fallbackTitle || '未命名',
    author: options.author ?? '',
    chapters,
  }
}
