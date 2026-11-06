/**
 * PDF：两条路，跟桌面阅读器一致。
 *
 *  - 有文字层 → 抽文本，进沉浸排版（能划词、能调字号、能搜索）
 *  - 没有文字层（扫描件 / 纯图片）→ **不硬抽**，标记成 `pdf-scan`，
 *    阅读器用页面渲染（浏览器内置 PDF 阅读器）显示原始页面。
 *
 * `lib/pdf-text.js` 只负责「判断有没有文字层 + 抽出来」，本文件负责决策。
 */
import { extractPdfText } from './pdf-text.js'
import { parsePlainText } from './txt.js'

/** PDF 里常出现 CJK 兼容表意字（U+2F00–U+2FDF / U+F900–U+FAFF），统一成常用字。 */
function normalizeIdeographs(text) {
  return String(text).replace(/[\u2e80-\u2fdf\uf900-\ufaff]/g, (char) => char.normalize('NFKC'))
}

/**
 * @param {Uint8Array} buffer
 * @param {{fallbackTitle?: string}} options
 */
export function analyzePdf(buffer, options = {}) {
  let extracted
  try {
    extracted = extractPdfText(buffer)
  } catch (error) {
    if (String(error?.message ?? '').includes('not a pdf')) {
      const failure = new Error('这不是一个 PDF 文件。')
      failure.code = 'FORMAT'
      throw failure
    }
    throw error
  }

  const pageCount = Number(extracted?.pageCount) || (Array.isArray(extracted?.pages) ? extracted.pages.length : 0) || 1
  const text = normalizeIdeographs(String(extracted?.text ?? ''))
  const perPage = text.trim().length / Math.max(pageCount, 1)
  const hasTextLayer = typeof extracted?.hasTextLayer === 'boolean' ? extracted.hasTextLayer : perPage >= 25

  if (!hasTextLayer) {
    return {
      mode: 'scan',
      pageCount,
      textDensity: Number(extracted?.textDensity ?? Number(perPage.toFixed(1))),
      warnings: extracted?.warnings ?? ['no-text-layer'],
      chapters: [],
      title: options.fallbackTitle ?? '',
      author: '',
    }
  }

  const parsed = parsePlainText(text, { fallbackTitle: options.fallbackTitle, maxChars: 9000 })
  return {
    mode: 'text',
    pageCount,
    textDensity: Number(extracted?.textDensity ?? Number(perPage.toFixed(1))),
    warnings: extracted?.warnings ?? [],
    chapters: parsed.chapters,
    title: parsed.title,
    author: '',
  }
}
