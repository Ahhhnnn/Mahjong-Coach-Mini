const assert = require('node:assert/strict')
const { test } = require('node:test')
const { load, seeds, server, client, clone, hash } = require('./helpers/table-harness.cjs')
const manual = (id = 'manual') => ({ ...clone(seeds[0]), id, revision: 0, mutationId: `create-${id}` })
const bridge = (cloud) => async ({ name, data }) => { assert.equal(name, 'matchTable'); return { result: await cloud.main(data) } }
const connect = async (cloud, name = 'HENING') => { const local = client(bridge(cloud), {}, name); await local.service.syncCloudMatchesToLocal(); return local }

test('归档 21 场与来源一致，读取不补齐或写回默认历史', async () => {
  const cloud = server(); cloud.seed()
  cloud.documents.delete(hash(`fixed-four:${seeds[0].id}`))
  const local = await connect(cloud)
  await local.service.syncCloudMatchesToLocal()
  assert.equal(seeds.length, 21)
  assert.equal(local.service.listMatches().length, 20)
  assert.equal(cloud.writes.length, 0)
})
test('未认领账号看不到旧版或共享缓存，也不能读写云端', async () => {
  const cloud = server(); cloud.seed(); cloud.setOwner('stranger')
  for (const action of ['list', 'save', 'remove']) assert.equal((await cloud.request({ action, ...manual() })).code, 'UNBOUND')
  const local = client(bridge(cloud), { user_info: JSON.stringify({ openid: 'stranger' }), match_records: seeds })
  assert.equal(local.service.listMatches().length, 0)
  assert.throws(() => local.service.upsertMatch(manual()), /认领/)
})
test('四人读取同一份公共牌局，本人积分和胜负随身份变化', async () => {
  const cloud = server(); cloud.seed()
  for (const [name, total] of [['HENING', -297], ['WUYU', 4], ['TANGXIANG', -249], ['DUHAN', 542]]) {
    if (name !== 'HENING') { cloud.bind(name); cloud.setOwner(name.toLowerCase()) }
    const local = await connect(cloud, name)
    const stats = local.load('src/core/match-stats-service').computeMatchStats(local.service.listMatches(), { playerName: name })
    assert.equal(stats.total, 21); assert.equal(stats.cumulative, total)
    assert.equal(stats.ranking.find((r) => r.isSelf).name, name)
    assert.equal(stats.trend.series.find((r) => r.id === '__self__').total, total)
    assert.ok(local.service.listMatches().every((r) => r.players.filter((p) => p.isSelf).length === 1))
  }
  assert.equal(cloud.documents.size, 21)
})
test('四人都能新增编辑删除，旧版接口与伪造身份被拒绝', async () => {
  const cloud = server(); cloud.seed(); cloud.bind('WUYU'); cloud.setOwner('wuyu')
  const record = manual()
  assert.equal((await cloud.request({ action: 'save', ...record }, 'WUYU')).ok, true)
  assert.equal((await cloud.request({ action: 'save', ...record }, 'HENING')).code, 'UNBOUND')
  assert.equal((await cloud.request({ action: 'remove', id: record.id, revision: 1, mutationId: 'delete' }, 'WUYU')).ok, true)
  for (const name of ['saveMatch', 'getMatches', 'removeMatch']) assert.equal((await load(`cloudfunctions/${name}/index.js`).main(record)).code, 'UPGRADE_REQUIRED')
  assert.equal((await cloud.main({ action: 'save', ...record })).code, 'UPGRADE_REQUIRED')
})
test('保存请求重试不重复插入，过期版本不覆盖新编辑', async () => {
  const cloud = server(), record = manual()
  const results = await Promise.all([cloud.request({ action: 'save', ...record }), cloud.request({ action: 'save', ...record })])
  assert.ok(results.every((r) => r.ok)); assert.equal(cloud.documents.size, 1)
  assert.equal((await cloud.request({ action: 'save', ...record, revision: 1, note: 'new', mutationId: 'edit' })).revision, 2)
  assert.equal((await cloud.request({ action: 'save', ...record, note: 'stale', mutationId: 'old' })).code, 'CONFLICT')
  assert.equal((await cloud.request({ action: 'list' })).matches[0].note, 'new')
})
test('云端验证完整四人、有限积分、零和，客户端 isSelf 和 result 不影响归属', async () => {
  const cloud = server()
  const bad = manual(); bad.players[0].scoreDelta++
  assert.equal((await cloud.request({ action: 'save', ...bad })).code, 'INVALID')
  const record = manual(); record.players.forEach((p) => { p.isSelf = true }); record.result = 'win'
  assert.equal((await cloud.request({ action: 'save', ...record })).ok, true)
  const stored = [...cloud.documents.values()][0]
  assert.equal(stored.result, undefined)
  assert.ok(stored.players.every((p) => !('isSelf' in p)))
})
test('个人复盘只返回当前玩家的内容，另一人编辑公共字段不会覆盖它', async () => {
  const cloud = server(), record = manual()
  await cloud.request({ action: 'save', ...record, performance: 'mistake', reasons: ['defense'] })
  cloud.bind('WUYU'); cloud.setOwner('wuyu')
  assert.equal((await cloud.request({ action: 'list' }, 'WUYU')).matches[0].performance, undefined)
  await cloud.request({ action: 'save', ...record, revision: 1, mutationId: 'wuyu-edit', performance: 'good', reasons: ['luck'] }, 'WUYU')
  assert.equal((await cloud.request({ action: 'list' }, 'WUYU')).matches[0].performance, 'good')
  cloud.setOwner('owner')
  const mine = (await cloud.request({ action: 'list' })).matches[0]
  assert.equal(mine.performance, 'mistake'); assert.deepEqual(mine.reasons, ['defense'])
  assert.ok(!JSON.stringify(mine).includes('binding-HENING'))
})
test('删除标记阻止旧保存请求恢复牌局，删除重试幂等', async () => {
  const cloud = server(), record = manual()
  await cloud.request({ action: 'save', ...record })
  const remove = { action: 'remove', id: record.id, revision: 1, mutationId: 'remove' }
  assert.equal((await cloud.request(remove)).ok, true)
  assert.equal((await cloud.request(remove)).ok, true)
  assert.equal((await cloud.request({ action: 'save', ...record, revision: 2, mutationId: 'resurrect' })).code, 'DELETED')
  const list = await cloud.request({ action: 'list' })
  assert.deepEqual(list.matches, []); assert.deepEqual(list.deletedIds, [record.id])
})
test('离线新增编辑只排队明确操作，恢复后按对局时间排序', async () => {
  const cloud = server(); cloud.seed()
  let offline = false
  const local = client(async (request) => { if (offline) throw new Error('offline'); return bridge(cloud)(request) })
  await local.service.syncCloudMatchesToLocal(); offline = true
  const record = local.service.upsertMatch({ ...seeds[0], id: undefined, playedAt: seeds[0].playedAt - 1000 })
  await local.service.syncCloudMatchesToLocal()
  assert.equal(local.service.getMatchSyncState().pending, 1)
  offline = false; await local.service.syncCloudMatchesToLocal()
  assert.equal(local.service.getMatchSyncState().pending, 0)
  assert.equal((await cloud.request({ action: 'list' })).matches[0].id, record.id)
})
test('多人编辑冲突保留草稿并恢复云端记录，不静默覆盖', async () => {
  const cloud = server(); cloud.seed()
  const local = await connect(cloud), original = local.service.listMatches()[0]
  await cloud.request({ action: 'save', ...original, revision: 1, mutationId: 'other-device', note: 'remote wins' })
  local.service.upsertMatch({ ...original, note: 'my draft' })
  await local.service.syncCloudMatchesToLocal()
  assert.equal(local.service.getMatch(original.id).note, 'remote wins')
  assert.equal(local.service.getMatchConflict(original.id).draft.note, 'my draft')
  assert.equal(local.service.getMatchSyncState().pending, 0)
})
test('编辑表单使用加载时版本，刷新后的旧表单不能覆盖新版本', async () => {
  const cloud = server(); cloud.seed()
  const local = await connect(cloud), original = local.service.listMatches()[0]
  await cloud.request({ action: 'save', ...original, mutationId: 'remote' })
  await local.service.syncCloudMatchesToLocal()
  assert.throws(() => local.service.upsertMatch({ ...original, note: 'stale form' }), /已更新/)
})
test('保存请求中继续编辑，回执只更新版本，不丢掉较新的输入', async () => {
  const cloud = server(); cloud.seed()
  let release, saved = false
  const local = client(async (request) => {
    const result = await bridge(cloud)(request)
    if (request.data.action === 'save' && !saved) { saved = true; await new Promise((resolve) => { release = resolve }) }
    return result
  })
  await local.service.syncCloudMatchesToLocal()
  const original = local.service.listMatches()[0]
  local.service.upsertMatch({ ...original, note: 'first' })
  while (!release) await new Promise((r) => setImmediate(r))
  local.service.upsertMatch({ ...local.service.getMatch(original.id), note: 'second' })
  release(); await local.service.syncCloudMatchesToLocal()
  assert.equal(local.service.getMatch(original.id).note, 'second')
  assert.equal(local.service.getMatch(original.id).revision, 3)
  assert.equal((await cloud.request({ action: 'list' })).matches[0].note, 'second')
})
test('请求中删除新建牌局，回执后正确提交删除', async () => {
  const cloud = server()
  let release
  const local = client(async (request) => {
    const result = await bridge(cloud)(request)
    if (request.data.action === 'save') await new Promise((resolve) => { release = resolve })
    return result
  })
  const record = local.service.upsertMatch({ ...seeds[0], id: undefined })
  while (!release) await new Promise((r) => setImmediate(r))
  local.service.removeMatch(record.id)
  release(); await local.service.syncCloudMatchesToLocal()
  assert.equal(local.service.listMatches().length, 0)
  assert.equal(local.service.getMatchSyncState().pending, 0)
  assert.deepEqual((await cloud.request({ action: 'list' })).deletedIds, [record.id])
})
test('解绑明确清除身份与缓存，网络故障保留离线数据', async () => {
  const cloud = server(); cloud.seed(); cloud.bind('WUYU'); cloud.setOwner('wuyu')
  let offline = false
  const local = client(async (req) => { if (offline) throw new Error('offline'); return bridge(cloud)(req) }, {}, 'WUYU')
  await local.service.syncCloudMatchesToLocal(); offline = true
  await local.service.syncCloudMatchesToLocal(); assert.equal(local.service.listMatches().length, 21)
  cloud.tables.get('fixed-four').members.WUYU = {}; offline = false
  await local.service.syncCloudMatchesToLocal()
  assert.equal(local.identity.getTableIdentity(), null)
  assert.equal(local.service.listMatches().length, 0)
  assert.ok(![...local.storage.keys()].some((key) => key.includes('binding-WUYU')))
})
test('切换账号后旧请求不能写回新缓存或撤销新身份', async () => {
  const cloud = server(); cloud.seed()
  let release
  const local = client(async (request) => {
    const result = await bridge(cloud)(request)
    await new Promise((resolve) => { release = resolve }); return result
  })
  const pending = local.service.syncCloudMatchesToLocal()
  while (!release) await new Promise((r) => setImmediate(r))
  local.identity.cacheUser({ openid: 'someone', identity: null })
  release(); await pending
  assert.equal(local.service.listMatches().length, 0)
  assert.equal(local.identity.getCachedUser().openid, 'someone')
  assert.ok(![...local.storage.keys()].some((key) => key.startsWith('match_table_v2:')))
})
test('旧版离线待上传只保留为草稿，旧默认历史绝不自动上传', async () => {
  const cloud = server(); cloud.seed()
  const draft = { ...seeds[0], id: 'm_offline', note: 'legacy offline' }
  const local = client(bridge(cloud), { match_records: [...seeds, draft], match_pending_saves: [draft.id] })
  await local.service.syncCloudMatchesToLocal()
  assert.equal(local.service.listMatches().length, 21)
  assert.equal(local.service.getMatchConflict(draft.id).draft.note, draft.note)
  assert.equal(cloud.writes.length, 0)
})
