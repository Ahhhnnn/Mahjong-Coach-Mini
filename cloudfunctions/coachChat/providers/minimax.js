/**
 * MiniMax Provider 适配器
 *
 * 协议：OpenAI 兼容 Chat Completions
 * 端点：POST https://api.minimaxi.com/v1/chat/completions
 * 鉴权：Authorization: Bearer <MINIMAX_API_KEY>
 *
 * 默认模型：MiniMax-M3（Coding/Agentic SOTA、1M 上下文、多模态）
 * 文档：https://platform.minimaxi.com/docs/api-reference/text-chat-openai
 *
 * 关键点：
 *   - 上限参数使用 max_completion_tokens（M3 推荐 131072，上限 524288）
 *   - thinking:disabled 让 M3 跳过思维链，直接返回最终文本，避免泄露
 *   - 错误响应除了 error.message，还会携带 base_resp.{status_code, status_msg}
 */

module.exports = {
  id: 'minimax',
  name: 'MiniMax',
  envKeyName: 'MINIMAX_API_KEY',
  defaultBaseUrl: 'https://api.minimaxi.com/v1',
  defaultModel: 'MiniMax-M3',

  buildRequest({ apiKey, baseUrl, model, messages, temperature, maxCompletionTokens }) {
    return {
      url: baseUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? 0.6,
        max_completion_tokens: maxCompletionTokens ?? 1024,
        stream: false,
        thinking: { type: 'disabled' },
      }),
    }
  },

  parseResponse(json) {
    if (json?.base_resp?.status_code && json.base_resp.status_code !== 0) {
      throw new Error(json.base_resp.status_msg || '模型返回异常')
    }
    const content = String(json?.choices?.[0]?.message?.content ?? '').trim()
    if (!content) return null
    return content
  },
}