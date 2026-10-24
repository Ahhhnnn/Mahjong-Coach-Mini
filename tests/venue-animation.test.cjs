const assert = require('node:assert/strict')
const { test } = require('node:test')
const { load } = require('./helpers/table-harness.cjs')

const pool = [{ id: 'a', name: '青竹棋牌室' }, { id: 'b', name: '听雨茶舍' }, { id: 'c', name: '东风棋牌室' }]
const winner = { date: '2026-10-31', venue: { id: 'server', name: '云端确定的地点' }, candidates: pool, configVersion: 1, drawnBy: 'HENING', drawnAt: 1 }
const flush = () => new Promise((resolve) => setImmediate(resolve))
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
function harness() {
  let cursor = 0, scope = 'owner:binding', targetDate = '2026-10-31', hide, show, result
  const state = [], effects = []
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
  const hooks = load('src/hooks/use-venue-draw-animation', {
    react, '@tarojs/taro': { useDidHide: (fn) => { hide = fn }, useDidShow: (fn) => { show = fn } },
  })
  const render = (commit = true) => {
    cursor = 0; result = hooks.useVenueDrawAnimation(scope, targetDate)
    if (commit) {
      effects.forEach((e) => { if (e.pending) { e.pending = false; e.cleanup = e.callback() } })
      render(false)
    }
    return result
  }
  return { render, hide: () => hide(), show: () => show(),
    scope: (value) => { scope = value }, date: (value) => { targetDate = value },
    unmount: () => effects.forEach((e) => e.cleanup?.()) }
}
async function withClock(work) {
  const originalSet = global.setTimeout, originalClear = global.clearTimeout
  let now = 0, sequence = 0
  const timers = new Map(), delays = []
  global.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, { callback, due: now + delay }); delays.push(delay); return id }
  global.clearTimeout = (id) => timers.delete(id)
  const advance = (ms) => {
    const end = now + ms
    while (true) {
      const next = [...timers.entries()].filter(([, item]) => item.due <= end).sort((a, b) => a[1].due - b[1].due)[0]
      if (!next) break
      timers.delete(next[0]); now = next[1].due; next[1].callback()
    }
    now = end
  }
  try { await work({ advance, pending: () => timers.size, delays }) }
  finally { global.setTimeout = originalSet; global.clearTimeout = originalClear }
}

test('先轮换再减速，最快也等待展示结束，只揭晓云端结果，重复点击不重复请求', async () => withClock(async (clock) => {
  const page = harness(); page.render()
  let requests = 0
  const request = async () => { requests++; return winner }
  const finished = page.render().play(winner.date, pool, request)
  assert.equal(page.render().frame.phase, 'rolling'); assert.equal(page.render().result, undefined)
  assert.equal(await page.render().play(winner.date, pool, request), null)
  await flush(); assert.equal(requests, 1)
  clock.advance(2000)
  assert.equal(page.render().frame.phase, 'slowing'); assert.equal(page.render().result, undefined)
  clock.advance(500); assert.equal(page.render().result, undefined)
  clock.advance(600)
  assert.deepEqual(await finished, winner)
  assert.deepEqual(page.render().result, winner); assert.equal(page.render().frame, undefined)
  assert.ok(Math.max(...clock.delays) > clock.delays[0])
  assert.equal(clock.pending(), 0); assert.equal(requests, 1)
  page.unmount()
}))

test('慢网络超过动效时长仍等待云端确认，不自行产生最终地点', async () => withClock(async (clock) => {
  const page = harness(); page.render(); const cloud = deferred()
  const finished = page.render().play(winner.date, pool, () => cloud.promise)
  await flush(); clock.advance(5000)
  assert.equal(page.render().frame.phase, 'waiting'); assert.equal(page.render().result, undefined)
  cloud.resolve(winner); await flush(); clock.advance(400)
  assert.deepEqual(await finished, winner); assert.equal(clock.pending(), 0)
  page.unmount()
}))

test('单候选也播放定签效果，多候选轮换不会连续显示同一店', async () => withClock(async (clock) => {
  const page = harness(); page.render(); const cloud = deferred()
  const first = page.render().play(winner.date, [pool[0]], () => cloud.promise)
  clock.advance(1500)
  assert.equal(page.render().frame.candidate.id, 'a'); assert.equal(page.render().result, undefined)
  cloud.resolve(winner); await flush(); clock.advance(2000); await first
  page.render().reset()
  const secondCloud = deferred()
  const second = page.render().play(winner.date, pool, () => secondCloud.promise)
  let previous = page.render().frame.candidate.id
  for (let i = 0; i < 8; i++) {
    const delay = clock.delays[clock.delays.length - 1]
    clock.advance(delay)
    const current = page.render().frame.candidate.id
    assert.notEqual(current, previous); previous = current
  }
  page.hide(); assert.equal(await second, null)
  secondCloud.resolve(winner); await flush(); page.unmount()
}))

test('云端失败立即停止动效，清除定时器并允许重试，不展示假结果', async () => withClock(async (clock) => {
  const page = harness(); page.render(); const cloud = deferred()
  const failed = page.render().play(winner.date, pool, () => cloud.promise)
  const rejection = assert.rejects(failed, /网络失败/)
  cloud.reject(new Error('网络失败')); await rejection
  assert.equal(page.render().frame, undefined); assert.equal(page.render().result, undefined)
  assert.equal(clock.pending(), 0)
  const retry = page.render().play(winner.date, pool, async () => winner)
  await flush(); clock.advance(3100)
  assert.deepEqual(await retry, winner); page.unmount()
}))

test('切后台停止动画，不在隐藏时发起新请求，迟到响应不再触发揭晓', async () => withClock(async (clock) => {
  const page = harness(); page.render(); const cloud = deferred()
  const finished = page.render().play(winner.date, pool, () => cloud.promise)
  await flush(); page.hide()
  assert.equal(await finished, null); assert.equal(clock.pending(), 0)
  let hiddenRequests = 0
  assert.equal(await page.render().play(winner.date, pool, async () => { hiddenRequests++; return winner }), null)
  cloud.resolve(winner); await flush(); clock.advance(5000)
  assert.equal(page.render().result, undefined); assert.equal(page.render().frame, undefined)
  assert.equal(hiddenRequests, 0)
  page.show(); const next = page.render().play(winner.date, pool, async () => winner)
  await flush(); clock.advance(3100); assert.deepEqual(await next, winner)
  page.unmount()
}))

test('切换日期或身份取消旧播放，旧请求不能覆盖或取消新日期的动画', async () => withClock(async (clock) => {
  const page = harness(); page.render(); const oldCloud = deferred()
  const first = page.render().play(winner.date, pool, () => oldCloud.promise)
  await flush(); page.date('2026-11-01'); page.render()
  assert.equal(await first, null); assert.equal(clock.pending(), 0)
  const secondWinner = { ...winner, date: '2026-11-01' }
  const second = page.render().play(secondWinner.date, pool, async () => secondWinner)
  oldCloud.resolve(winner); await flush(); clock.advance(3100)
  assert.deepEqual(await second, secondWinner)
  assert.equal(page.render().result.date, '2026-11-01')
  page.scope('another-user'); assert.equal(page.render(false).result, undefined)
  page.render(); assert.equal(page.render().result, undefined)
  page.unmount()
}))

test('卸载页面后清理所有定时器，空候选名单不发起请求', async () => withClock(async (clock) => {
  const page = harness(); page.render(); let requests = 0
  assert.equal(await page.render().play(winner.date, [], async () => { requests++; return winner }), null)
  assert.equal(requests, 0)
  const cloud = deferred()
  const finished = page.render().play(winner.date, pool, () => cloud.promise)
  await flush(); page.unmount()
  assert.equal(await finished, null); assert.equal(clock.pending(), 0)
  cloud.resolve(winner); await flush(); assert.equal(clock.pending(), 0)
}))

test('确认后立即离开或切换身份，尚未发出的抽取请求不会继续执行', async () => withClock(async (clock) => {
  const page = harness(); page.render(); let requests = 0
  const finished = page.render().play(winner.date, pool, async () => { requests++; return winner })
  page.hide()
  assert.equal(await finished, null); await flush()
  assert.equal(requests, 0); assert.equal(clock.pending(), 0)
  page.unmount()
}))

function renderVenue(animation, current) {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/pages/venue/index.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const jsx = (type, props) => ({ type, props })
  const imports = {
    react: { useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: (value) => ({ current: value }), useEffect() {}, useCallback: (fn) => fn },
    'react/jsx-runtime': { jsx, jsxs: jsx }, '@tarojs/taro': { __esModule: true, default: {}, useDidShow() {} },
    '@tarojs/components': { Input: 'Input', Picker: 'Picker', Text: 'Text', View: 'View' },
    '@taroify/core': { Button: 'Button', Switch: 'Switch' }, '@taroify/icons': { ArrowDown: 'ArrowDown', CalendarOutlined: 'CalendarOutlined' },
    '../../components/table-identity-gate': { __esModule: true, default: 'Gate' },
    '../../hooks/use-table-identity': { useTableIdentity: () => ({ identity: { role: 'member' }, scope: 'scope' }) },
    '../../hooks/use-venue-status': { useVenueStatus: () => ({ status: current, calendar: { today: '2026-10-25', maxDate: '2026-11-24' }, refresh() {} }) },
    '../../hooks/use-venue-draw-animation': { useVenueDrawAnimation: () => animation },
    '../../core/table-identity-service': { identityScope: () => 'scope' },
    '../../core/venue-service': { formatVenueDrawTime: () => '2026-10-25 12:00' }, './index.scss': '',
  }
  const module = { exports: {} }
  vm.runInNewContext(source, { module, exports: module.exports, require: (name) => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`)
    return imports[name]
  } })
  const tree = module.exports.default()
  const nodes = []
  const visit = (node) => {
    if (Array.isArray(node)) node.forEach(visit)
    else if (node && typeof node === 'object') { nodes.push(node); visit(node.props?.children) }
  }
  visit(tree)
  const text = (node) => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : ''
  return { nodes, text: text(tree) }
}

test('云端事件提前返回结果时，页面仍显示轮换，不提前露出最终地点或中奖标记', () => {
  const candidates = pool.slice(0, 2)
  const page = renderVenue({ frame: { date: winner.date, candidates, candidate: candidates[0], turn: 1, phase: 'rolling' } }, {
    date: winner.date, draw: winner, config: { venues: [...pool, winner.venue].map((v) => ({ ...v, enabled: true })) },
    dailyDraw: { targetDate: winner.date }, canDraw: false,
  })
  assert.ok(page.text.includes('抽签中'))
  assert.equal(page.text.includes(winner.venue.name), false)
  assert.equal(page.nodes.some((n) => n.props?.className === 'venue-result-name'), false)
  assert.equal(page.nodes.some((n) => n.props?.className === 'venue-chosen-mark'), false)
  assert.ok(page.nodes.some((n) => n.props?.className === 'venue-reel-name'))
})

test('动效结束后，即使后续刷新失败，页面也展示已被云端确认的结果', () => {
  const page = renderVenue({ result: winner }, { date: '2026-10-25', draw: null, config: { venues: [] }, canDraw: false })
  assert.ok(page.text.includes(winner.venue.name)); assert.ok(page.text.includes(winner.date))
  assert.ok(page.nodes.some((n) => n.props?.className?.includes('just-revealed')))
  assert.equal(page.nodes.some((n) => n.props?.className === 'venue-reel-name'), false)
})

test('再次进入页面清除临时揭晓结果，交由云端刷新，不重播或重新抽取', async () => withClock(async (clock) => {
  const page = harness(); page.render(); let requests = 0
  const finished = page.render().play(winner.date, pool, async () => { requests++; return winner })
  await flush(); clock.advance(3100); await finished
  assert.deepEqual(page.render().result, winner)
  page.hide(); page.show()
  assert.equal(page.render().result, undefined); assert.equal(page.render().frame, undefined)
  assert.equal(requests, 1); assert.equal(clock.pending(), 0)
  page.unmount()
}))

test('手动刷新会清除临时揭晓结果，后台删除测试签后可以正确重新查询', () => {
  let resets = 0
  const page = renderVenue({ result: winner, reset: () => { resets++ } }, { date: winner.date, draw: winner, config: { venues: [] }, canDraw: false })
  const button = page.nodes.find((n) => n.type === 'Button' && n.props.children === '刷新所选日期结果')
  assert.ok(button); button.props.onClick()
  assert.equal(resets, 1)
})
