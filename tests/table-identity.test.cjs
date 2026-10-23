const assert = require('node:assert/strict')
const { test } = require('node:test')
const { server, client, seeds, tableIdentity } = require('./helpers/table-harness.cjs')
test('直接认领立即绑定，不需要审核，不暴露其他账号的 openid', async () => {
  const cloud = server(); cloud.setOwner('new-user')
  const status = await cloud.request({ action: 'status' })
  assert.equal(status.identity, null); assert.equal(status.players.filter((p) => p.claimed).length, 1)
  const result = await cloud.request({ action: 'claim', playerName: 'WUYU' })
  assert.equal(result.ok, true); assert.equal(result.identity.playerName, 'WUYU')
  assert.equal(result.identity.role, 'member'); assert.ok(result.identity.bindingId)
  assert.ok(!JSON.stringify(result).includes('owner'))
  assert.equal((await cloud.request({ action: 'claim', playerName: 'WUYU' })).identity.bindingId, result.identity.bindingId)
  assert.equal((await cloud.request({ action: 'claim', playerName: 'DUHAN' })).code, 'ALREADY_BOUND')
})
test('两个微信账号同时认领一个身份，只能成功一个', async () => {
  const cloud = server(); cloud.setOwner('one')
  const one = cloud.request({ action: 'claim', playerName: 'DUHAN' })
  cloud.setOwner('two')
  const two = cloud.request({ action: 'claim', playerName: 'DUHAN' })
  const results = await Promise.all([one, two])
  assert.equal(results.filter((r) => r.ok).length, 1)
  assert.equal(results.find((r) => !r.ok).code, 'TAKEN')
})
test('同一账号同时认领两个身份，只能绑定一个', async () => {
  const cloud = server(); cloud.setOwner('one')
  const results = await Promise.all([cloud.request({ action: 'claim', playerName: 'DUHAN' }), cloud.request({ action: 'claim', playerName: 'WUYU' })])
  assert.equal(results.filter((r) => r.ok).length, 1)
  assert.equal(results.find((r) => !r.ok).code, 'ALREADY_BOUND')
})
test('仅管理员可解除他人，重新认领产生新绑定，旧离线操作失效', async () => {
  const cloud = server(); cloud.bind('WUYU'); cloud.setOwner('wuyu')
  assert.equal((await cloud.request({ action: 'release', playerName: 'WUYU' }, 'WUYU')).code, 'FORBIDDEN')
  cloud.setOwner('owner')
  assert.equal((await cloud.request({ action: 'release', playerName: 'HENING' })).code, 'INVALID')
  assert.equal((await cloud.request({ action: 'release', playerName: 'WUYU' })).ok, true)
  cloud.setOwner('wuyu')
  const result = await cloud.request({ action: 'claim', playerName: 'WUYU' })
  assert.notEqual(result.identity.bindingId, tableIdentity('WUYU').bindingId)
  assert.equal((await cloud.request({ action: 'list' }, 'WUYU')).code, 'UNBOUND')
})
test('伪造昵称、角色、openid 都不能授权，固定四人以外不可认领', async () => {
  const cloud = server(); cloud.setOwner('stranger')
  assert.equal((await cloud.request({ action: 'claim', playerName: 'OTHER' })).code, 'INVALID')
  assert.equal((await cloud.request({ action: 'release', playerName: 'HENING', role: 'admin', openid: 'owner' })).code, 'FORBIDDEN')
  assert.equal((await cloud.request({ action: 'list', playerName: 'HENING', role: 'admin', openid: 'owner' })).code, 'UNBOUND')
})
test('登录每次返回云端最新绑定，解绑后不沿用旧身份', async () => {
  const cloud = server()
  const owner = await cloud.login({})
  assert.equal(owner.user.identity.playerName, 'HENING')
  cloud.bind('WUYU'); cloud.setOwner('wuyu')
  assert.equal((await cloud.login({})).user.identity.playerName, 'WUYU')
  cloud.tables.get('fixed-four').members.WUYU = {}
  assert.equal((await cloud.login({})).user.identity, null)
})
test('四人徽章和玄学按本人计算，缓存不复用其他人的已读状态', () => {
  const local = client(async () => { throw new Error('offline') })
  const mystic = local.load('src/core/match-mystic-service')
  for (const name of ['HENING', 'WUYU', 'TANGXIANG', 'DUHAN']) {
    local.identity.cacheUser({ openid: name.toLowerCase(), identity: tableIdentity(name) })
    const badges = local.badges.updateMatchBadges(seeds, false, name)
    const expectedBest = Math.max(...seeds.map((r) => r.players.find((p) => p.name === name).scoreDelta))
    assert.equal(badges.find((b) => b.id === 'century').current, expectedBest)
    assert.equal(!!badges.find((b) => b.id === 'century').unlockedAt, expectedBest >= 100)
    const stats = mystic.computeMatchMystic(seeds, undefined, name)
    assert.equal(stats.opponents.length, 3); assert.ok(!stats.opponents.some((p) => p.name === name))
    assert.equal(stats.locations.reduce((sum, p) => sum + p.total, 0), seeds.reduce((sum, r) => sum + r.players.find((p) => p.name === name).scoreDelta, 0))
    assert.ok(local.badges.getPendingBadgeIds(name).includes('regular_10'))
    local.badges.markBadgesSeen(['regular_10'], name)
  }
})
test('较早的登录响应不能覆盖请求途中完成的认领或解绑', async () => {
  let finish
  const local = client(async ({ name }) => {
    if (name !== 'loginUser') return { result: { ok: true, matches: [], deletedIds: [] } }
    return await new Promise((resolve) => { finish = resolve })
  }, { user_info: JSON.stringify({ openid: 'new-user', identity: null }) })
  const auth = local.load('src/core/auth')
  const request = auth.ensureLogin()
  local.identity.cacheUser({ openid: 'new-user', identity: tableIdentity('WUYU') })
  finish({ result: { ok: true, user: { openid: 'new-user', identity: null } } })
  await request
  assert.equal(local.identity.getTableIdentity().playerName, 'WUYU')
  const pending = auth.ensureLogin()
  local.identity.clearTableIdentity(local.identity.identityScope())
  finish({ result: { ok: true, user: { openid: 'new-user', identity: tableIdentity('WUYU') } } })
  await pending
  assert.equal(local.identity.getTableIdentity(), null)
})
test('较早的状态查询不会撤销刚刚成功的认领', async () => {
  let finish
  const local = client(async () => await new Promise((resolve) => { finish = resolve }), { user_info: JSON.stringify({ openid: 'new-user', identity: null }) })
  const pending = local.identity.tableIdentityAction('status')
  local.identity.cacheUser({ openid: 'new-user', identity: tableIdentity('WUYU') })
  finish({ result: { ok: true, identity: null, players: [] } })
  const result = await pending
  assert.equal(result.identity.playerName, 'WUYU')
  assert.equal(local.identity.getTableIdentity().playerName, 'WUYU')
})
