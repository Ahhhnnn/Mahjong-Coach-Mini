const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
function renderer({ late = false } = {}) {
  let created = 0, disposed = 0, available = !late, timers = [], effects = [], statuses = [], definition
  const pages = [{ selectComponent: () => available ? native : null }]
  const native = { init(callback) { callback({ setChart() {} }, 330, 260, 3) }, resizeChart() {} }
  const taro = { getCurrentInstance: () => ({ page: { selectComponent: () => null } }),
    getCurrentPages: () => pages, nextTick: (fn) => fn() }
  const chart = { setOption() {}, isDisposed: () => false, dispose: () => { disposed++ } }
  const react = { useRef: (value) => ({ current: value }), useState: (value) => [typeof value === 'function' ? value() : value, (next) => statuses.push(next)], useEffect: (fn) => effects.push(fn) }
  const engine = { init() { created++; return chart } }
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/match-trend-chart.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  const imports = { react, 'react/jsx-runtime': { jsx: () => ({}), jsxs: () => ({}) }, '@tarojs/components': {},
    '@tarojs/taro': { __esModule: true, default: taro, useDidShow() {} }, './chart-engine': engine,
    './match-trend-option': { trendOption: (trend) => trend }, './match-trend-chart.scss': {} }
  vm.runInNewContext(source, { module, exports: module.exports, require: (name) => imports[name], console: { warn() {} },
    setTimeout: (fn) => { timers.push(fn); return fn }, clearTimeout: (fn) => { timers = timers.filter((f) => f !== fn) } })
  definition = module.exports.default
  definition({ trend: { points: [{ time: 1, label: 'start' }], series: [] } })
  const cleanups = effects.map((effect) => effect()).filter(Boolean)
  return { get created() { return created }, get disposed() { return disposed }, statuses,
    makeAvailable() { available = true }, tick() { const queue = timers; timers = []; queue.forEach((fn) => fn()) },
    unmount() { cleanups.forEach((fn) => fn()) } }
}
test('异步挂载时 Current.page 指向别的页面，也能找到真正拥有图表的页面', () => {
  const r = renderer()
  assert.equal(r.created, 1)
  assert.ok(r.statuses.includes('ready'))
  r.unmount()
  assert.equal(r.disposed, 1)
})
test('原生组件稍晚挂载后会初始化，卸载后的重试不会创建图表', () => {
  const r = renderer({ late: true })
  assert.equal(r.created, 0)
  r.makeAvailable(); r.tick()
  assert.equal(r.created, 1)
  r.unmount()
  const removed = renderer({ late: true })
  removed.unmount(); removed.makeAvailable(); removed.tick()
  assert.equal(removed.created, 0)
})
