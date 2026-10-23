const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
function canvasHarness({ delayedCommit = false, emptyQueries = 0, zeroQueries = 0, queryThrows = false, version = '3.17.0' } = {}) {
  let definition, committed = false, queryCount = 0, errors = [], commits = [], timers = []
  const ctx = {}, node = { getContext: () => ctx, createImage: () => ({}) }
  const echarts = { registerPreprocessor() {}, setPlatformAPI() {} }
  const wx = {
    getSystemInfoSync: () => ({ SDKVersion: version, pixelRatio: 3 }),
    getAppBaseInfo: () => ({ SDKVersion: version }), getWindowInfo: () => ({ pixelRatio: 3 }),
    createCanvasContext: () => ctx,
    createSelectorQuery: () => {
      let rectCallback
      const q = { boundingClientRect: (callback) => { rectCallback = callback; return q }, in: () => q, select: () => q, fields: () => q,
        exec(callback) {
          queryCount++
          if (queryThrows) throw new Error('render bridge not ready')
          const result = !committed || queryCount <= emptyQueries ? [] : [{ node, width: queryCount <= zeroQueries ? 0 : 330, height: queryCount <= zeroQueries ? 0 : 260 }]
          if (rectCallback) rectCallback(result[0])
          else callback(result)
        } }
      return q
    },
  }
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/ec-canvas/ec-canvas.js'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
  const wrapper = class { constructor(context) { this.context = context } }
  const module = { exports: {} }
  vm.runInNewContext(source, { module, exports: module.exports, Component: (value) => { definition = value }, wx,
    require: (name) => name === './wx-canvas' ? { __esModule: true, default: wrapper } : echarts,
    console: { warn() {}, error() {}, log() {} },
    setTimeout: (callback) => { timers.push(callback); return callback }, clearTimeout: (callback) => { timers = timers.filter((f) => f !== callback) },
  })
  const instance = { ...definition.methods, data: { ...definition.data, ec: { lazyLoad: true }, canvasId: 'test', forceUseOldCanvas: false },
    setData(data, callback) {
      const commit = () => { Object.assign(this.data, data); committed = true; callback?.() }
      if (delayedCommit) commits.push(commit); else commit()
    }, triggerEvent() {},
  }
  const ready = () => definition.ready.call(instance)
  const tick = () => { const queue = timers; timers = []; queue.forEach((callback) => callback()) }
  return { instance, ready, definition, node, errors,
    init(callback) { instance.init(callback, (error) => errors.push(error)) },
    commit() { const queue = commits; commits = []; queue.forEach((callback) => callback()) }, tick,
    flush() { for (let n = 0; n < 80 && (timers.length || commits.length); n++) { this.commit(); tick() } },
    get queryCount() { return queryCount }, get timerCount() { return timers.length } }
}
function chart() { return { disposed: false, isDisposed() { return this.disposed }, dispose() { this.disposed = true }, resize() {} } }

test('首次挂载必须等待原生 ready 和 setData 渲染回调后再查询 Canvas 2D', () => {
  const h = canvasHarness({ delayedCommit: true }); let calls = 0
  h.init(() => { calls++; return chart() })
  assert.equal(h.queryCount, 0)
  h.ready()
  assert.equal(h.queryCount, 0)
  h.commit()
  assert.equal(calls, 1)
  assert.equal(h.instance.chart.isDisposed(), false)
})
test('Canvas 节点暂时为空或尺寸为零时重试，不能初始化空白图表', () => {
  const h = canvasHarness({ emptyQueries: 2, zeroQueries: 4 }); let calls = 0
  h.ready()
  h.init((canvas, width, height, dpr) => { calls++; assert.equal(width, 330); assert.equal(height, 260); assert.equal(dpr, 3); return chart() })
  h.flush()
  assert.equal(calls, 1)
  assert.ok(h.queryCount >= 5)
  assert.equal(h.errors.length, 0)
})
test('初始化失败会通知调用方，重试次数有界且允许再次发起', () => {
  const h = canvasHarness({ emptyQueries: 1000 })
  h.ready(); h.init(() => chart()); h.flush()
  assert.equal(h.errors.length, 1)
  assert.equal(h.timerCount, 0)
  assert.ok(h.queryCount > 1 && h.queryCount <= 40)
  const before = h.queryCount
  h.init(() => chart()); h.flush()
  assert.ok(h.queryCount > before)
  assert.equal(h.errors.length, 2)
})
test('卸载取消查询与重试，不在已销毁的节点上创建图表', () => {
  const h = canvasHarness({ delayedCommit: true }); let calls = 0
  h.ready(); h.init(() => { calls++; return chart() })
  h.definition.detached.call(h.instance)
  h.flush()
  assert.equal(calls, 0)
  assert.equal(h.timerCount, 0)
})
test('初始化和更新异常可见且不留下失效的 ECharts 实例', () => {
  const h = canvasHarness()
  h.ready(); h.init(() => { throw new Error('unsupported canvas color') }); h.flush()
  assert.equal(h.errors.length, 1)
  assert.match(h.errors[0].message, /unsupported canvas color/)
  assert.ok(!h.instance.chart)
  h.init(() => chart()); h.flush()
  assert.ok(h.instance.chart)
})
test('原生查询桥暂时异常会重试，最终明确报告失败', () => {
  const h = canvasHarness({ queryThrows: true })
  h.ready(); h.init(() => chart()); h.flush()
  assert.equal(h.errors.length, 1)
  assert.equal(h.timerCount, 0)
})

test('页面隐藏取消未完成的查询，重新显示后继续初始化', () => {
  const h = canvasHarness({ delayedCommit: true }); let calls = 0
  h.ready(); h.init(() => { calls++; return chart() })
  h.definition.pageLifetimes.hide.call(h.instance)
  h.commit()
  assert.equal(calls, 0)
  h.definition.pageLifetimes.show.call(h.instance)
  h.flush()
  assert.equal(calls, 1)
})
test('重复初始化不会创建多个实例，旧 Canvas 路径使用 DPR 1', () => {
  const h = canvasHarness({ version: '2.8.0' }); let calls = 0
  const initialize = (canvas, width, height, dpr) => { calls++; assert.equal(width, 330); assert.equal(dpr, 1); return chart() }
  h.ready(); h.init(initialize); h.init(initialize); h.flush()
  assert.equal(calls, 1)
})
test('趋势图渐变色使用真机兼容的 rgba，保留四人曲线和全部时间点', () => {
  const { load, seeds } = require('./helpers/table-harness.cjs')
  class LinearGradient { constructor(x, y, x2, y2, colorStops) { this.colorStops = colorStops } }
  const { trendOption } = load('src/components/match-trend-option', { './chart-engine': { graphic: { LinearGradient } } })
  const { computeMatchStats } = load('src/core/match-stats-service')
  const trend = computeMatchStats(seeds).trend, option = trendOption(trend)
  assert.equal(option.series.length, 4)
  for (const series of option.series) {
    assert.equal(series.data.length, 22)
    assert.ok(series.areaStyle.color.colorStops.every((stop) => /^rgba\(\d+,\d+,\d+,(0|0\.14)\)$/.test(stop.color)))
  }
})
