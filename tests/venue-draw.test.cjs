const assert = require('node:assert/strict')
const { test } = require('node:test')
const { server, client, clone } = require('./helpers/table-harness.cjs')
const setup = async (cloud, names = ['青竹棋牌室', '东风棋牌室', '听雨茶舍']) => {
  const result = await cloud.request({ action: 'saveVenues', version: 0, venues: names.map((name) => ({ name, enabled: true })) })
  assert.equal(result.ok, true)
  return result.config
}
const withTime = async (iso, work) => {
  const original = Date.now
  Date.now = () => Date.parse(iso)
  try { return await work((next) => { Date.now = () => Date.parse(next) }) }
  finally { Date.now = original }
}

test('无名单不消耗机会；只有一家时允许抽取并保存快照', async () => {
  const cloud = server()
  const status = await cloud.request({ action: 'venueStatus' })
  assert.equal(status.draw, null); assert.equal(status.config.version, 0)
  assert.equal((await cloud.request({ action: 'drawVenue' })).code, 'NO_VENUES')
  assert.equal(cloud.collections.get('table_venue_draws').size, 0)
  const config = await setup(cloud, [' 家庭棋牌室 '])
  const result = await cloud.request({ action: 'drawVenue' })
  assert.equal(result.draw.venue.name, '家庭棋牌室')
  assert.deepEqual(result.draw.candidates, config.venues.map(({ id, name }) => ({ id, name })))
  assert.equal(result.draw.configVersion, 1)
  assert.equal(result.draw.drawnBy, 'HENING')
  assert.equal(cloud.collections.get('table_venue_draws').size, 1)
})

test('并发点击与重试只保存一次，四人查询同一份结果', async () => {
  const cloud = server(); await setup(cloud)
  const results = await Promise.all(Array.from({ length: 24 }, () => cloud.request({ action: 'drawVenue' })))
  assert.ok(results.every((r) => r.ok))
  for (const result of results) assert.deepEqual(result.draw, results[0].draw)
  assert.equal(cloud.writes.filter((w) => w.collection === 'table_venue_draws').length, 1)
  for (const name of ['WUYU', 'TANGXIANG', 'DUHAN']) {
    cloud.bind(name); cloud.setOwner(name.toLowerCase())
    assert.deepEqual((await cloud.request({ action: 'drawVenue' }, name)).draw, results[0].draw)
    assert.deepEqual((await cloud.request({ action: 'venueStatus' }, name)).draw, results[0].draw)
  }
  cloud.tables.get('fixed-four').members.DUHAN.bindingId = 'rebound'
  assert.deepEqual((await cloud.main({ action: 'drawVenue', schemaVersion: 2, bindingId: 'rebound' })).draw, results[0].draw)
})

test('按云端北京时间跨天，忽略客户端传入的日期、结果、操作人', async () => withTime('2026-10-25T15:59:59.999Z', async (advance) => {
  const cloud = server(); await setup(cloud)
  const first = await cloud.request({ action: 'drawVenue', date: '2099-01-01', venue: { name: '作弊店' }, drawnBy: 'DUHAN', tableId: 'other' })
  assert.equal(first.draw.date, '2026-10-25')
  assert.equal(first.draw.drawnBy, 'HENING'); assert.notEqual(first.draw.venue.name, '作弊店')
  assert.equal(first.draw.drawnAt, Date.parse('2026-10-25T15:59:59.999Z'))
  advance('2026-10-25T16:00:00.000Z')
  const status = await cloud.request({ action: 'venueStatus' })
  assert.equal(status.date, '2026-10-26'); assert.equal(status.draw, null)
  const second = await cloud.request({ action: 'drawVenue', date: first.date })
  assert.equal(second.date, '2026-10-26')
  assert.equal(cloud.collections.get('table_venue_draws').size, 2)
}))

test('抽取后改名、停用、调整顺序不改旧结果，次日使用新名单', async () => withTime('2026-10-25T04:00:00Z', async (advance) => {
  const cloud = server(); const config = await setup(cloud)
  const first = (await cloud.request({ action: 'drawVenue' })).draw
  const venues = config.venues.slice().reverse().map((v, index) => ({ ...v, name: `新名称${index}`, enabled: index === 0 }))
  assert.equal((await cloud.request({ action: 'saveVenues', version: config.version, venues })).ok, true)
  assert.deepEqual((await cloud.request({ action: 'drawVenue' })).draw, first)
  advance('2026-10-26T04:00:00Z')
  const next = await cloud.request({ action: 'drawVenue' })
  assert.equal(next.draw.venue.name, '新名称0'); assert.equal(next.draw.configVersion, 2)
  assert.equal(next.draw.candidates.length, 1)
}))

test('服务端随机索引覆盖每个候选，只包含启用项', async () => {
  const { load } = require('./helpers/table-harness.cjs')
  for (const index of [0, 1, 2]) {
    const cloud = server(); const config = await setup(cloud)
    const run = load('cloudfunctions/matchTable/venue-actions.js', { crypto: { ...require('crypto'), randomInt: (limit) => { assert.equal(limit, 3); return index } } })
    const result = await run({ event: { action: 'drawVenue', bindingId: 'binding-HENING' }, db: cloud.db, tableId: 'fixed-four', openid: 'owner',
      readDoc: async (ref) => (await ref.get()).data,
      memberOf: (table, openid) => table?.members.HENING.openid === openid ? { bindingId: 'binding-HENING', playerName: 'HENING' } : null })
    assert.equal(result.draw.venue.id, config.venues[index].id)
  }
})

test('普通成员、未绑定用户、伪造绑定不能维护或越权；不提供重抽删除接口', async () => {
  const cloud = server(); const config = await setup(cloud)
  const first = (await cloud.request({ action: 'drawVenue' })).draw
  cloud.bind('WUYU'); cloud.setOwner('wuyu')
  assert.equal((await cloud.request({ action: 'saveVenues', version: 1, venues: config.venues, role: 'admin', playerName: 'HENING' }, 'WUYU')).code, 'FORBIDDEN')
  assert.equal((await cloud.request({ action: 'drawVenue' }, 'HENING')).code, 'UNBOUND')
  for (const action of ['resetVenue', 'removeVenueDraw', 'redrawVenue']) assert.equal((await cloud.request({ action }, 'WUYU')).code, 'INVALID')
  cloud.setOwner('stranger')
  for (const action of ['venueStatus', 'drawVenue', 'venueHistory', 'saveVenues']) assert.equal((await cloud.request({ action })).code, 'UNBOUND')
  cloud.setOwner('owner')
  assert.deepEqual((await cloud.request({ action: 'drawVenue' })).draw, first)
})

test('权限在事务中重新校验，已撤销身份不能留下结果或改名单', async () => {
  const cloud = server(); const config = await setup(cloud)
  const run = cloud.db.runTransaction
  cloud.db.runTransaction = (callback) => {
    cloud.tables.get('fixed-four').members.HENING.bindingId = 'revoked'
    return run(callback)
  }
  assert.equal((await cloud.request({ action: 'drawVenue' })).code, 'UNBOUND')
  assert.equal(cloud.collections.get('table_venue_draws')?.size || 0, 0)
  assert.equal(config.version, 1)
})

test('名单版本冲突不会覆盖，名称规范化、唯一、数量与稳定ID校验', async () => {
  const cloud = server(); const config = await setup(cloud)
  const changed = { action: 'saveVenues', version: 1, venues: config.venues.map((v) => ({ ...v, enabled: false })) }
  const results = await Promise.all([cloud.request(changed), cloud.request(changed)])
  assert.equal(results.filter((r) => r.ok).length, 1)
  assert.equal(results.find((r) => !r.ok).code, 'CONFLICT')
  for (const venues of [[], [{ name: '', enabled: true }], [{ name: 'A', enabled: true }, { name: ' A ', enabled: true }],
    [{ name: 'A'.repeat(101), enabled: true }], [{ id: 'forged', name: 'A', enabled: true }], [{ name: 'A', enabled: 'true' }],
    Array.from({ length: 51 }, (_, i) => ({ name: `店${i}`, enabled: true })), [...config.venues, config.venues[0]]]) {
    assert.equal((await cloud.request({ action: 'saveVenues', version: 2, venues })).code, 'INVALID')
  }
  assert.equal((await cloud.request({ action: 'drawVenue' })).code, 'NO_VENUES')
  assert.equal((await cloud.request({ action: 'venueStatus' })).config.version, 2)
})

test('历史按日期倒序分页，无重复、只返回本牌桌公开信息', async () => withTime('2026-01-01T04:00:00Z', async (advance) => {
  const cloud = server(); await setup(cloud, ['常聚棋牌室'])
  for (let i = 0; i < 42; i++) {
    advance(new Date(Date.parse('2026-01-01T04:00:00Z') + i * 86400000).toISOString())
    await cloud.request({ action: 'drawVenue' })
  }
  const docs = cloud.collections.get('table_venue_draws')
  docs.set('other', { ...clone([...docs.values()][0]), tableId: 'other', date: '2099-01-01' })
  const all = []
  let before
  do {
    const page = await cloud.request({ action: 'venueHistory', before })
    assert.equal(page.ok, true); assert.ok(page.items.length <= 20)
    all.push(...page.items); before = page.nextCursor
  } while (before)
  assert.equal(all.length, 42); assert.equal(new Set(all.map((d) => d.date)).size, 42)
  assert.deepEqual(all.map((d) => d.date), all.map((d) => d.date).sort().reverse())
  assert.ok(all.every((d) => !d._id && !d.tableId))
  assert.equal((await cloud.request({ action: 'venueHistory', before: {} })).code, 'INVALID')
}))

test('客户端使用云端日期；断网不本地抽取，响应丢失后重试恢复同一结果', async () => {
  const cloud = server(); await setup(cloud)
  let loseResponse = true
  const local = client(async ({ data }) => {
    const result = await cloud.main(data)
    if (data.action === 'drawVenue' && loseResponse) { loseResponse = false; throw new Error('response lost') }
    return { result }
  })
  const service = local.load('src/core/venue-service')
  await assert.rejects(service.drawVenue(), /联网/)
  const stored = clone([...cloud.collections.get('table_venue_draws').values()][0])
  const retry = await service.drawVenue()
  assert.equal(retry.draw.venue.id, stored.venue.id); assert.equal(retry.draw.drawnAt, stored.drawnAt)
  assert.equal(cloud.writes.filter((w) => w.collection === 'table_venue_draws').length, 1)
  const offline = client(async () => { throw new Error('offline') }).load('src/core/venue-service')
  await assert.rejects(offline.drawVenue(), /联网/)
  await assert.rejects(offline.fetchVenueStatus(), /联网/)
})

test('客户端丢弃旧身份响应，服务端解除绑定后清理本地身份', async () => {
  const cloud = server(); await setup(cloud)
  let respond
  const local = client(() => new Promise((resolve) => { respond = resolve }))
  const service = local.load('src/core/venue-service')
  const pending = service.fetchVenueStatus()
  local.identity.cacheUser({ openid: 'new-account' })
  respond({ result: await cloud.request({ action: 'venueStatus' }) })
  await assert.rejects(pending, /身份已变化/)
  const unbound = client(async () => ({ result: { ok: false, code: 'UNBOUND', msg: '身份已解除' } }))
  await assert.rejects(unbound.load('src/core/venue-service').fetchVenueStatus(), /身份已解除/)
  assert.equal(unbound.identity.getTableIdentity(), null)
})

test('事务因并发冲突重试时读取已提交结果，不覆盖其他人的签', async () => {
  const cloud = server(); const config = await setup(cloud)
  const original = cloud.db.runTransaction
  let attemptedDraw
  cloud.db.runTransaction = (callback) => original(async (transaction) => {
    // 第一轮写入暂存后被冲突回滚；模拟另一成员已经抢先提交。
    await callback({ collection: (name) => ({ doc: (id) => {
      const ref = transaction.collection(name).doc(id)
      return { get: ref.get, set: async ({ data }) => { attemptedDraw = clone(data) }, update: async () => {} }
    } }) })
    const winner = { ...attemptedDraw, drawnBy: 'WUYU', venue: { id: config.venues[0].id, name: config.venues[0].name } }
    await transaction.collection('table_venue_draws').doc(`fixed-four_${winner.date}`).set({ data: winner })
    return callback(transaction)
  })
  const result = await cloud.request({ action: 'drawVenue' })
  assert.equal(result.draw.drawnBy, 'WUYU')
  assert.equal(cloud.writes.filter((w) => w.collection === 'table_venue_draws').length, 1)
  assert.equal(cloud.collections.get('table_venue_draws').size, 1)
})

test('可提前选牌局日期，但全桌每天只发起一次，同一日期跨天也不能重抽', async () => withTime('2026-10-25T04:00:00Z', async (advance) => {
  const cloud = server(); await setup(cloud)
  const status = await cloud.request({ action: 'venueStatus', targetDate: '2026-10-31' })
  assert.equal(status.date, '2026-10-31'); assert.equal(status.today, '2026-10-25')
  assert.equal(status.maxDate, '2026-11-24'); assert.equal(status.canDraw, true)
  const first = await cloud.request({ action: 'drawVenue', targetDate: '2026-10-31' })
  assert.equal(first.draw.date, '2026-10-31'); assert.equal(first.draw.drawnAt, Date.now())
  assert.equal((await cloud.request({ action: 'drawVenue', targetDate: '2026-11-01' })).code, 'DAILY_LIMIT')
  const unavailable = await cloud.request({ action: 'venueStatus', targetDate: '2026-11-01' })
  assert.equal(unavailable.canDraw, false); assert.equal(unavailable.dailyDraw.targetDate, '2026-10-31')
  assert.match(unavailable.unavailableReason, /2026-10-31/)
  assert.deepEqual((await cloud.request({ action: 'drawVenue', targetDate: '2026-10-31' })).draw, first.draw)
  advance('2026-10-26T04:00:00Z')
  assert.deepEqual((await cloud.request({ action: 'drawVenue', targetDate: '2026-10-31' })).draw, first.draw)
  assert.equal((await cloud.request({ action: 'venueStatus', targetDate: '2026-11-01' })).canDraw, true)
  assert.equal((await cloud.request({ action: 'drawVenue', targetDate: '2026-11-01' })).ok, true)
  assert.equal(cloud.collections.get('table_venue_draws').size, 2)
  assert.equal(cloud.tables.get('fixed-four').venueLastDraw.targetDate, '2026-11-01')
}))

test('四人同时选择不同牌局日期，当天只允许一场成功', async () => withTime('2026-10-25T04:00:00Z', async () => {
  const cloud = server(); await setup(cloud)
  const requests = []
  for (const [index, name] of ['HENING', 'WUYU', 'TANGXIANG', 'DUHAN'].entries()) {
    if (name !== 'HENING') cloud.bind(name)
    cloud.setOwner(name === 'HENING' ? 'owner' : name.toLowerCase())
    requests.push(cloud.request({ action: 'drawVenue', targetDate: `2026-10-${26 + index}` }, name))
  }
  const results = await Promise.all(requests)
  assert.equal(results.filter((r) => r.ok).length, 1)
  assert.equal(results.filter((r) => r.code === 'DAILY_LIMIT').length, 3)
  assert.equal(cloud.collections.get('table_venue_draws').size, 1)
  const winner = results.find((r) => r.ok).draw
  assert.equal(cloud.tables.get('fixed-four').venueLastDraw.targetDate, winner.date)
  assert.equal(cloud.tables.get('fixed-four').venueLastDraw.drawnBy, winner.drawnBy)
}))

test('四人同时选择相同未来日期，共享一个结果和一次每日机会', async () => withTime('2026-10-25T04:00:00Z', async () => {
  const cloud = server(); await setup(cloud)
  const requests = []
  for (const name of ['HENING', 'WUYU', 'TANGXIANG', 'DUHAN']) {
    if (name !== 'HENING') cloud.bind(name)
    cloud.setOwner(name === 'HENING' ? 'owner' : name.toLowerCase())
    requests.push(cloud.request({ action: 'drawVenue', targetDate: '2026-10-31' }, name))
  }
  const results = await Promise.all(requests)
  assert.ok(results.every((r) => r.ok))
  for (const result of results) assert.deepEqual(result.draw, results[0].draw)
  assert.equal(cloud.writes.filter((w) => w.collection === 'table_venue_draws').length, 1)
  assert.equal(cloud.writes.filter((w) => w.collection === 'match_tables' && w.venueLastDraw).length, 1)
}))

test('云端严格校验日期、过去日期不补抽、最多提前30天，客户端不能伪造今天', async () => withTime('2026-10-25T15:59:59Z', async () => {
  const cloud = server(); await setup(cloud)
  for (const targetDate of ['2026-02-30', '2026-13-01', '2026-10-32', '2026-1-1', 'no-date', '', null, 123, {}, [], '2026-10-25T00:00:00Z']) {
    assert.equal((await cloud.request({ action: 'drawVenue', targetDate })).code, 'INVALID_DATE')
    assert.equal((await cloud.request({ action: 'venueStatus', targetDate })).code, 'INVALID_DATE')
  }
  assert.equal((await cloud.request({ action: 'drawVenue', targetDate: '2026-10-24', today: '2026-10-24' })).code, 'PAST_DATE')
  assert.equal((await cloud.request({ action: 'drawVenue', targetDate: '2026-11-25', today: '2026-11-25', maxDate: '2099-01-01' })).code, 'FUTURE_DATE')
  assert.equal((await cloud.request({ action: 'venueStatus', targetDate: '2026-10-24' })).canDraw, false)
  assert.equal((await cloud.request({ action: 'drawVenue', targetDate: '2026-11-24' })).ok, true)
  assert.equal(cloud.collections.get('table_venue_draws').size, 1)
}))

test('部署前已有的当天结果原样保留，并占用当天机会，无需迁移', async () => withTime('2026-10-25T04:00:00Z', async () => {
  const cloud = server(); const config = await setup(cloud)
  // 旧版只有结果，没有 match_tables 上的每日标记。
  const legacy = { tableId: 'fixed-four', date: '2026-10-25', venue: { id: config.venues[0].id, name: config.venues[0].name },
    candidates: config.venues.map(({ id, name }) => ({ id, name })), configVersion: 1, drawnBy: 'HENING', drawnAt: Date.now() }
  await cloud.db.collection('table_venue_draws').doc('fixed-four_2026-10-25').set({ data: legacy })
  const count = cloud.writes.length
  assert.equal((await cloud.request({ action: 'venueStatus' })).draw.drawnAt, legacy.drawnAt)
  assert.equal((await cloud.request({ action: 'drawVenue', targetDate: '2026-10-31' })).code, 'DAILY_LIMIT')
  assert.equal((await cloud.request({ action: 'drawVenue' })).draw.venue.id, legacy.venue.id)
  assert.equal(cloud.writes.length, count)
}))

test('今天的牌局若昨天已提前抽好，今天仍可为另一场抽签；查旧签不消耗机会', async () => withTime('2026-10-24T04:00:00Z', async (advance) => {
  const cloud = server(); await setup(cloud)
  const first = await cloud.request({ action: 'drawVenue', targetDate: '2026-10-25' })
  advance('2026-10-25T04:00:00Z')
  assert.deepEqual((await cloud.request({ action: 'drawVenue', targetDate: '2026-10-25' })).draw, first.draw)
  const next = await cloud.request({ action: 'venueStatus', targetDate: '2026-10-26' })
  assert.equal(next.dailyDraw, null); assert.equal(next.canDraw, true)
  assert.equal((await cloud.request({ action: 'drawVenue', targetDate: '2026-10-26' })).ok, true)
  advance('2026-10-27T04:00:00Z')
  const past = await cloud.request({ action: 'venueStatus', targetDate: '2026-10-25' })
  assert.equal(past.draw.venue.id, first.draw.venue.id); assert.equal(past.canDraw, false)
  assert.deepEqual((await cloud.request({ action: 'drawVenue', targetDate: '2026-10-25' })).draw, first.draw)
}))

test('跨北京时间零点可用新一天机会，但明确选择的过去日期不能偷偷改成今天', async () => withTime('2026-10-25T15:59:59Z', async (advance) => {
  const cloud = server(); await setup(cloud)
  await cloud.request({ action: 'drawVenue', targetDate: '2026-10-31' })
  advance('2026-10-25T16:00:00Z')
  assert.equal((await cloud.request({ action: 'drawVenue', targetDate: '2026-10-25' })).code, 'PAST_DATE')
  const next = await cloud.request({ action: 'drawVenue', targetDate: '2026-11-01' })
  assert.equal(next.ok, true); assert.equal(next.draw.date, '2026-11-01'); assert.equal(next.today, '2026-10-26')
}))

test('客户端明确传递牌局日期，并展示实际抽取日期和时间', async () => {
  const { load } = require('./helpers/table-harness.cjs')
  const requests = []
  const cloud = server(); await setup(cloud)
  const local = client(async ({ data }) => { requests.push(data); return { result: await cloud.main(data) } })
  const service = local.load('src/core/venue-service')
  const targetDate = new Date(Date.now() + 86400000 + 8 * 3600000).toISOString().slice(0, 10)
  assert.equal((await service.fetchVenueStatus(targetDate)).date, targetDate)
  assert.equal((await service.drawVenue(targetDate)).draw.date, targetDate)
  assert.equal(requests[0].targetDate, targetDate); assert.equal(requests[1].targetDate, targetDate)
  assert.equal(service.formatVenueDrawTime(Date.parse('2026-10-25T16:30:00Z')), '2026-10-26 00:30')
})
