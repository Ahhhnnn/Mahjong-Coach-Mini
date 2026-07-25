/**
 * DeepSeek Provider 适配器
 *
 * 协议：OpenAI 兼容 Chat Completions
 * 端点：POST {baseUrl}/chat/completions
 * 鉴权：Authorization: Bearer <DEEPSEEK_API_KEY>
 *
 * 历史行为原样保留，从原 index.js 中剥离，逻辑零改动。
 */

module.exports = {
  id: 'deepseek',
  name: 'DeepSeek',
  envKeyName: 'DEEPSEEK_API_KEY',
  defaultBaseUrl: 'https://api.deepseek.com',
  defaultModel: 'deepseek-v4-flash',

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
        stream: false,
        thinking: { type: 'disabled' },
      }),
    }
  },

  parseResponse(json) {
    const content = String(json?.choices?.[0]?.message?.content ?? '').trim()
    if (!content) return null
    return content
  },
}