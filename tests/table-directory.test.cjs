const assert = require('node:assert/strict')
const { test } = require('node:test')
const { server } = require('./helpers/table-harness.cjs')

const players = (scores) => ['甲', '乙', '丙', '丁'].map((name, index) => ({ name, scoreDelta: scores[index] }))

test('新建桌子、邀请码入座，四人分数仍然必须合计为零', async () => {
  const cloud = server()
  const created = await cloud.main({ schemaVersion: 2, action: 'createTable', name: '周五局', seats: ['甲', '乙', '丙', '丁'], mySeat: '甲' })
  assert.equal(created.ok, true)
  assert.equal(created.table.inviteCode.length, 6)
  assert.equal(created.table.mySeat, '甲')
  cloud.setOwner('friend')
  const preview = await cloud.main({ schemaVersion: 2, action: 'previewTable', inviteCode: created.table.inviteCode })
  assert.equal(preview.ok, true)
  assert.equal(preview.table.name, '周五局')
  assert.equal(JSON.stringify(preview).includes('scoreDelta'), false)
  assert.equal(preview.table.players.find((player) => player.name === '甲').claimed, true)
  const joined = await cloud.main({ schemaVersion: 2, action: 'claimSeat', tableId: created.table.id, playerName: '乙' })
  assert.equal(joined.ok, true)
  const again = await cloud.main({ schemaVersion: 2, action: 'claimSeat', tableId: created.table.id, playerName: '丙' })
  assert.equal(again.code, 'ALREADY_BOUND')
  const bad = await cloud.main({
    schemaVersion: 2, action: 'save', tableId: created.table.id, bindingId: joined.table.bindingId,
    id: 'g1', revision: 0, mutationId: 'bad', playedAt: Date.now(), settleUnit: 'score', players: players([1, 1, 1, 1]),
  })
  assert.equal(bad.code, 'INVALID')
  const saved = await cloud.main({
    schemaVersion: 2, action: 'save', tableId: created.table.id, bindingId: joined.table.bindingId,
    id: 'g1', revision: 0, mutationId: 'good', playedAt: Date.now(), settleUnit: 'score', players: players([3, -1, -1, -1]),
  })
  assert.equal(saved.ok, true)
  const list = await cloud.main({ schemaVersion: 2, action: 'list', tableId: created.table.id, bindingId: joined.table.bindingId })
  assert.equal(list.matches.length, 1)
  assert.equal(list.matches[0].players.find((player) => player.name === '乙').scoreDelta, -1)
  const mine = await cloud.main({ schemaVersion: 2, action: 'listTables' })
  assert.equal(mine.tables.length, 1)
  assert.equal(mine.tables[0].id, created.table.id)
})

test('常聚牌桌不受新桌子影响，空桌子才能解散', async () => {
  const cloud = server(); cloud.seed()
  const status = await cloud.request({ action: 'status' })
  assert.equal(status.identity.playerName, 'HENING')
  const created = await cloud.main({ schemaVersion: 2, action: 'createTable', name: '空桌', seats: ['甲', '乙', '丙', '丁'], mySeat: '甲' })
  assert.equal((await cloud.request({ action: 'list' })).matches.length, 21)
  assert.equal((await cloud.main({ schemaVersion: 2, action: 'dissolveTable', tableId: 'fixed-four' })).code, 'INVALID')
  const played = await cloud.main({
    schemaVersion: 2, action: 'save', tableId: created.table.id, bindingId: created.table.bindingId,
    id: 'played', revision: 0, mutationId: 'played', playedAt: Date.now(), settleUnit: 'score', players: players([3, -1, -1, -1]),
  })
  assert.equal(played.ok, true)
  assert.equal((await cloud.main({ schemaVersion: 2, action: 'dissolveTable', tableId: created.table.id })).code, 'INVALID')
  const empty = await cloud.main({ schemaVersion: 2, action: 'createTable', name: '另一桌', seats: ['东', '南', '西', '北'], mySeat: '东' })
  assert.equal((await cloud.main({ schemaVersion: 2, action: 'dissolveTable', tableId: empty.table.id })).ok, true)
  assert.equal((await cloud.main({ schemaVersion: 2, action: 'previewTable', inviteCode: empty.table.inviteCode })).code, 'INVALID')
})

test('重复座位和缺少自己的座位会被拒绝', async () => {
  const cloud = server()
  assert.equal((await cloud.main({ schemaVersion: 2, action: 'createTable', name: '周五局', seats: ['甲', '甲', '丙', '丁'], mySeat: '甲' })).code, 'INVALID')
  assert.equal((await cloud.main({ schemaVersion: 2, action: 'createTable', name: '周五局', seats: ['甲', '乙', '丙', '丁'], mySeat: '戊' })).code, 'INVALID')
})
