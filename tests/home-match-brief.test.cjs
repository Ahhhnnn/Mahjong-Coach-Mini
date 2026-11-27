const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { client, tableIdentity } = require('./helpers/table-harness.cjs')

const solo = (score, playedAt = Date.now(), id = 'current') => ({
  id, playedAt, variant: 'xuezhan', settleUnit: 'score', scoreDelta: score,
  result: score > 0 ? 'win' : score < 0 ? 'loss' : 'draw', createdAt: playedAt, updatedAt: playedAt, revision: 1,
})
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/pages/index/index.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function home(name) {
  const local = client(async () => { throw new Error('offline') }, {}, name)
  const soloKey = () => `solo_matches_v1:${JSON.parse(local.storage.get('user_info')).openid}`
  const setSolo = (records) => local.storage.set(soloKey(), { records, pending: {}, conflicts: [] })
  setSolo([])
  const state = [], effects = []
  let cursor = 0, tree
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial
      return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
    },
    useEffect(callback, deps) {
      const index = cursor++
      if (!effects[index] || deps.some((dep, i) => dep !== effects[index].deps[i])) {
        effects[index]?.cleanup?.()
        effects[index] = { callback, deps, pending: true }
      }
    },
  }
  const jsx = (type, props) => ({ type, props })
  const imports = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    '@tarojs/components': {}, '@taroify/core': { Grid: { Item: 'GridItem' } }, '@taroify/icons': {},
    '@tarojs/taro': { __esModule: true, default: local.taro, useDidShow() {} },
    '../../core/puzzle-service': { getCachedPuzzles: () => [], loadPuzzles: async () => [] },
    '../../core/auth': { isLoggedIn: () => false, getCachedUser: () => JSON.parse(local.storage.get('user_info')), syncCloudRecordsToLocal: async () => 0 },
    '../../core/solo-match-service': local.load('src/core/solo-match-service'),
    '../../core/train-stats-service': { computeTrainStats: () => ({}) },
    '../../core/mistake-service': { loadMistakes: () => [] }, '../../core/favorite-service': { listFavorites: () => [] },
    '../../core/match-stats-service': local.load('src/core/match-stats-service'),
    '../../core/match-types': local.load('src/core/match-types'),
  }
  const module = { exports: {} }
  vm.runInNewContext(source, { module, exports: module.exports, require: (key) => {
    if (key in imports) return imports[key]
    if (/\.(jpg|scss)$/.test(key)) return ''
    throw new Error(`Unexpected import: ${key}`)
  } })
  const render = (commit = true) => {
    cursor = 0
    tree = module.exports.default()
    if (commit) {
      effects.forEach((effect) => {
        if (effect.pending) { effect.pending = false; effect.cleanup = effect.callback() }
      })
      render(false)
    }
    return tree
  }
  const description = (node) => {
    if (!node || typeof node !== 'object') return undefined
    if (Array.isArray(node)) return node.map(description).find((value) => value !== undefined)
    return node.props?.className === 'match-banner-desc' ? node.props.children : description(node.props?.children)
  }
  return { local, setSolo, render, description: () => description(tree),
    unmount: () => effects.forEach((effect) => effect.cleanup?.()) }
}

test('首页按当前账号的单人分数显示本月场次、胜率和积分', () => {
  const page = home('HENING')
  const previousMonth = new Date(); previousMonth.setDate(0)
  page.setSolo([solo(10), solo(-4, previousMonth.getTime(), 'previous')])
  page.render()
  assert.equal(page.description(), '本月 1 场 · 胜率 100% · +10分')
  page.unmount()
})

test('首页收到单人同步事件后刷新摘要，卸载后解除监听', () => {
  const page = home('HENING')
  const soloService = page.local.load('src/core/solo-match-service')
  page.render()
  page.setSolo([solo(10), solo(12, Date.now(), 'synced')])
  page.local.taro.eventCenter.trigger(soloService.SOLO_CHANGED)
  page.render()
  assert.equal(page.description(), '本月 2 场 · 胜率 100% · +22分')
  page.unmount()
  page.setSolo([])
  page.local.taro.eventCenter.trigger(soloService.SOLO_CHANGED)
  page.render(false)
  assert.equal(page.description(), '本月 2 场 · 胜率 100% · +22分')
})

test('换账号不展示上一份单人分数，解除牌桌身份不会清掉单人云端缓存', () => {
  const page = home('HENING')
  page.setSolo([solo(10)])
  page.render()
  assert.equal(page.description(), '本月 1 场 · 胜率 100% · +10分')
  page.local.identity.cacheUser({ openid: 'wuyu', identity: null })
  page.render(false)
  assert.equal(page.description(), '记下每一桌，看清你的胜率与趋势')
  page.local.storage.set('solo_matches_v1:wuyu', { records: [solo(8)], pending: {}, conflicts: [] })
  page.render()
  assert.equal(page.description(), '本月 1 场 · 胜率 100% · +8分')
  page.local.identity.cacheUser({ openid: 'owner', identity: tableIdentity('HENING') })
  page.render()
  assert.equal(page.description(), '本月 1 场 · 胜率 100% · +10分')
  page.local.identity.clearTableIdentity(page.local.identity.identityScope())
  page.render()
  assert.equal(page.description(), '本月 1 场 · 胜率 100% · +10分')
  page.unmount()
})
