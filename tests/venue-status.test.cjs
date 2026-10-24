const assert = require('node:assert/strict')
const { test } = require('node:test')
const { load } = require('./helpers/table-harness.cjs')

function harness() {
  let scope = 'identity-A', targetDate, cursor = 0, shown, result
  const state = [], effects = [], requests = [], listeners = new Set()
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial
      return [state[i], (value) => { state[i] = typeof value === 'function' ? value(state[i]) : value }]
    },
    useRef(initial) { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i] },
    useCallback(callback, deps) {
      const i = cursor++
      if (!state[i] || deps.some((d, j) => d !== state[i].deps[j])) state[i] = { deps, callback }
      return state[i].callback
    },
    useEffect(callback, deps) {
      const i = cursor++
      if (!effects[i] || deps.some((d, j) => d !== effects[i].deps[j])) {
        effects[i]?.cleanup?.(); effects[i] = { callback, deps, pending: true }
      }
    },
  }
  const hooks = load('src/hooks/use-venue-status', {
    react,
    '@tarojs/taro': { __esModule: true, default: { eventCenter: { on: (_, fn) => listeners.add(fn), off: (_, fn) => listeners.delete(fn) } }, useDidShow: (fn) => { shown = fn } },
    '../core/table-identity-service': { identityScope: () => scope },
    '../core/venue-service': { VENUES_CHANGED: 'changed', fetchVenueStatus: (date) => new Promise((resolve, reject) => requests.push({ date, resolve, reject })) },
  })
  const render = (commit = true) => {
    cursor = 0; result = hooks.useVenueStatus(scope, targetDate)
    if (commit) {
      effects.forEach((e) => { if (e.pending) { e.pending = false; e.cleanup = e.callback() } })
      render(false)
    }
    return result
  }
  return { render, requests, show: () => shown(), event: () => listeners.forEach((fn) => fn()),
    selectDate: (date) => { targetDate = date },
    switch: (next) => { scope = next }, unmount: () => effects.forEach((e) => e.cleanup?.()), listeners }
}
const flush = () => new Promise((resolve) => setImmediate(resolve))
const status = (date, name = '青竹棋牌室') => ({ date, today: '2026-10-25', maxDate: '2026-11-24', serverTime: 1,
  dailyDraw: null, canDraw: false, unavailableReason: '', config: { version: 1, venues: [] }, draw: { date, venue: { id: 'a', name } } })

test('抽取完成事件刷新今日结果，重新显示页面时使用云端跨天状态', async () => {
  const page = harness(); page.render()
  page.requests[0].resolve(status('2026-10-25')); await flush()
  assert.equal(page.render().status.draw.venue.name, '青竹棋牌室')
  page.event(); page.requests[1].resolve(status('2026-10-25', '东风棋牌室')); await flush()
  assert.equal(page.render().status.draw.venue.name, '东风棋牌室')
  page.show(); page.requests[2].resolve({ ...status('2026-10-26'), draw: null }); await flush()
  assert.equal(page.render().status.date, '2026-10-26'); assert.equal(page.render().status.draw, null)
  page.unmount(); assert.equal(page.listeners.size, 0)
})

test('乱序响应不覆盖最新结果，刷新失败可重试，始终不本地生成抽取结果', async () => {
  const page = harness(); page.render(); page.event()
  page.requests[1].resolve(status('2026-10-26')); await flush()
  page.requests[0].resolve(status('2026-10-25')); await flush()
  assert.equal(page.render().status.date, '2026-10-26')
  page.event(); page.requests[2].reject(new Error('网络失败')); await flush()
  assert.equal(page.render().error, '网络失败')
  assert.equal(page.render().status.date, '2026-10-26')
  page.event(); page.requests[3].resolve(status('2026-10-27')); await flush()
  assert.equal(page.render().error, ''); assert.equal(page.render().status.date, '2026-10-27')
  page.unmount()
})

test('切换或解除身份立即隐藏旧结果，忽略旧请求和卸载后的响应', async () => {
  const page = harness(); page.render()
  page.requests[0].resolve(status('2026-10-25')); await flush()
  page.event()
  page.switch('identity-B')
  assert.equal(page.render(false).status, undefined)
  page.render()
  page.requests[1].resolve(status('old')); page.requests[2].resolve(status('2026-10-26')); await flush()
  assert.equal(page.render().status.date, '2026-10-26')
  page.event(); page.unmount()
  page.requests[3].resolve(status('late')); await flush()
  assert.equal(page.render(false).status.date, '2026-10-26')
  page.switch(''); assert.equal(page.render().status, undefined)
})

test('切换牌局日期立即隐藏旧签，保留服务器日历边界，并丢弃旧日期的迟到响应', async () => {
  const page = harness(); page.render()
  page.requests[0].resolve(status('2026-10-25')); await flush()
  assert.equal(page.render().status.date, '2026-10-25')
  page.selectDate('2026-10-31')
  assert.equal(page.render(false).status, undefined)
  assert.equal(page.render(false).calendar.maxDate, '2026-11-24')
  page.render()
  assert.equal(page.requests[1].date, '2026-10-31')
  page.selectDate('2026-11-01'); page.render()
  assert.equal(page.requests[2].date, '2026-11-01')
  page.requests[2].resolve(status('2026-11-01', '新签')); await flush()
  page.requests[1].resolve(status('2026-10-31', '旧签')); await flush()
  assert.equal(page.render().status.date, '2026-11-01')
  assert.equal(page.render().status.draw.venue.name, '新签')
  page.unmount()
})

test('已明确选择的未来日期在页面重新显示时保持不变，选今天后恢复云端默认日期', async () => {
  const page = harness(); page.selectDate('2026-10-31'); page.render()
  page.requests[0].resolve(status('2026-10-31')); await flush()
  page.show()
  assert.equal(page.requests[1].date, '2026-10-31')
  page.requests[1].resolve(status('2026-10-31')); await flush()
  page.selectDate(undefined); page.render()
  assert.equal(page.requests[2].date, undefined)
  page.requests[2].resolve(status('2026-10-26')); await flush()
  assert.equal(page.render().status.date, '2026-10-26')
  page.unmount()
})
