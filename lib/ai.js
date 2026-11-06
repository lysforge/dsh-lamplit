/**
 * 划词 AI：把选中的一段文字交给当前默认模型，回一段解释或背景补充。
 *
 * 走宿主已有的 `llm` 服务（有适配器、有计费、有重试），不自己造 HTTP 客户端，
 * 所以「用哪个模型」跟着用户在 Harness 里选的默认模型走。
 */
import { ProviderError } from './http.js'

const SYSTEM = [
  '你是「灯下」阅读器里的读书助手。读者正读一本书并选中了一段文字。',
  '用中文回答，直接、具体、有信息量；不要复述原文，不要客套，不要加「这段话主要讲了」这种壳。',
  '不确定的地方就说「不确定」，不要编造出处。',
].join('\n')

function instruction(mode) {
  if (mode === 'expand') {
    return '请补充这段的背景：典故或出处、相关人物与事件、它可能引用的文本、以及值得延伸阅读的方向。300 字以内。'
  }
  return '请解释这段：它在说什么、关键概念指什么、有没有隐含前提或言外之意。300 字以内。'
}

export function createAi({ ctx }) {
  function selection() {
    const service = ctx.get('agentDefaultModel')
    const current = service?.currentSelection?.()
    if (current === null || typeof current !== 'object' || !current.provider || !current.model) {
      throw new ProviderError('AI', '还没有可用的默认模型：先在 Harness 里选一个模型。')
    }
    return current
  }

  return {
    async ask(input) {
      const llm = ctx.get('llm')
      if (llm === undefined) throw new ProviderError('AI', '当前 profile 没有启用模型服务。')
      const text = String(input.text ?? '').trim()
      if (text === '') throw new ProviderError('BADREQ', '没有选中任何文字。')
      const clipped = text.slice(0, 4000)
      const mode = input.mode === 'expand' ? 'expand' : 'explain'
      const { provider, model } = selection()

      const context = [input.bookTitle, input.chapterTitle].filter((item) => typeof item === 'string' && item.trim() !== '')
      const prompt = [
        context.length > 0 ? `书名：${context[0]}` : '',
        context.length > 1 ? `章节：${context[1]}` : '',
        '',
        '原文：',
        clipped,
        '',
        instruction(mode),
      ]
        .filter((line, index) => index > 2 || line !== '')
        .join('\n')

      const messages = [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 120_000)

      let answer = ''
      let failure = null
      try {
        const stream = llm.stream({
          provider,
          model,
          system: SYSTEM,
          messages,
          maxTokens: 1200,
          temperature: 0.4,
          signal: controller.signal,
        })
        for await (const chunk of stream) {
          if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') answer += chunk.text
          if (chunk?.type === 'finish' && chunk.reason?.kind === 'error') {
            failure = chunk.reason.failure?.message ?? '模型调用失败。'
          }
        }
      } catch (error) {
        failure = error?.message ?? String(error)
      } finally {
        clearTimeout(timer)
      }

      if (failure !== null && answer.trim() === '') throw new ProviderError('AI', failure)
      if (answer.trim() === '') throw new ProviderError('AI', '模型没有返回内容。')
      return { answer: answer.trim(), provider, model }
    },
  }
}
