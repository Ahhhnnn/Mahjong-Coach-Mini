const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { client, tableIdentity } = require('./helpers/table-harness.cjs')

const names = ['HENING', 'WUYU', 'TANGXIANG', 'DUHAN']
const scores = [10, 20, -10, -20]
const match = (id = 'current', playedAt = Date.now()) => ({ id, playedAt, variant: 'xuezhan', settleUnit: 'score',
  players: names.map((name, i) => ({ name, scoreDelta: scores[i], isSelf: i === 0 })),
  createdAt: playedAt, updatedAt: playedAt, revision: 1 })
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/pages/index/index.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function home(name) {
  const local = client(async () => { throw new Error('offline') }, {}, name)
  const setRecords = (records) => local.storage.set(local.identity.identityScope(), { records, pending: {}, conflicts: [] })
  setRecords([match()])
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
    '../../core/auth': { isLoggedIn: () => false },
    '../../core/train-stats-service': { computeTrainStats: () => ({}) },
    '../../core/mistake-service': { loadMistakes: () => [] }, '../../core/favorite-service': { listFavorites: () => [] },
    '../../core/match-service': local.service,
    '../../core/match-stats-service': local.load('src/core/match-stats-service'),
    '../../core/match-types': local.load('src/core/match-types'),
    '../../core/table-identity-service': local.identity,
    '../../hooks/use-table-identity': { useTableIdentity: () => ({ scope: local.identity.identityScope() }) },
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
  return { local, setRecords, render, description: () => description(tree),
    unmount: () => effects.forEach((effect) => effect.cleanup?.()) }
}

test('首页按四人的认领身份分别显示本月分数、胜率和场次', () => {
  for (const [i, name] of names.entries()) {
    const page = home(name)
    const previousMonth = new Date(); previousMonth.setDate(0)
    page.setRecords([match(), match('previous', previousMonth.getTime())])
    page.render()
    assert.equal(page.description(), `本月 1 场 · 胜率 ${scores[i] > 0 ? 100 : 0}% · ${scores[i] > 0 ? '+' : ''}${scores[i]}分`)
    page.unmount()
  }
})

test('首页收到牌局同步事件后刷新摘要，卸载后解除监听', () => {
  const page = home('WUYU')
  page.render()
  page.setRecords([match(), match('synced')])
  page.local.taro.eventCenter.trigger(page.local.service.MATCHES_CHANGED)
  page.render()
  assert.equal(page.description(), '本月 2 场 · 胜率 100% · +40分')
  page.unmount()
  page.setRecords([])
  page.local.taro.eventCenter.trigger(page.local.service.MATCHES_CHANGED)
  page.render(false)
  assert.equal(page.description(), '本月 2 场 · 胜率 100% · +40分')
})

test('切换身份时不展示前一人的摘要，解绑后清空战绩', () => {
  const page = home('HENING')
  page.render()
  page.local.identity.cacheUser({ openid: 'wuyu', identity: tableIdentity('WUYU') })
  page.setRecords([match()])
  page.render(false)
  assert.equal(page.description(), '记下每一桌，看清你的胜率与趋势')
  page.render()
  assert.equal(page.description(), '本月 1 场 · 胜率 100% · +20分')
  page.local.identity.clearTableIdentity(page.local.identity.identityScope())
  page.render()
  assert.equal(page.description(), '记下每一桌，看清你的胜率与趋势')
  page.unmount()
})
