/**
 * AI Provider 注册表
 *
 * 新增模型只需两步：
 *   1. 在 ./ 下新建 <id>.js，按统一契约导出 { id, name, envKeyName, defaultBaseUrl, defaultModel, buildRequest, parseResponse }
 *   2. 在下方 REGISTRY 中注册
 */

const deepseek = require('./deepseek')
const minimax = require('./minimax')

const REGISTRY = {
  [deepseek.id]: deepseek,
  [minimax.id]: minimax,
}

function getProvider(id) {
  const p = REGISTRY[id]
  if (!p) {
    const available = Object.keys(REGISTRY).join(', ')
    throw new Error(`不支持的 AI_PROVIDER="${id}"，可选：${available}`)
  }
  return p
}

function listProviders() {
  return Object.values(REGISTRY).map((p) => ({ id: p.id, name: p.name }))
}

module.exports = { getProvider, listProviders }