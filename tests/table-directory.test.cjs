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

test('全系统性别模型：固定桌预设正确、自定义桌可自由设性别、用户个人资料性别优先级最高', async () => {
  const { load } = require('./helpers/table-harness.cjs')
  const cloud = server()
  // 1. 固定桌「四个敌人」默认性别：HENING/WUYU=男，TANGXIANG/DUHAN=女
  const fixedList = await cloud.main({ schemaVersion: 2, action: 'listTables' })
  assert.equal(fixedList.ok, true)
  const fixedTable = fixedList.tables.find((t) => t.id === 'fixed-four')
  assert.equal(fixedTable.name, '四个敌人')
  assert.deepEqual(
    Object.fromEntries(fixedTable.players.map((p) => [p.name, p.gender])),
    { HENING: 'male', WUYU: 'male', TANGXIANG: 'female', DUHAN: 'female' },
  )

  // 2. 自定义桌支持任意男女比例（如 3 女 1 男），管理员可修改座位性别
  const created = await cloud.main({
    schemaVersion: 2,
    action: 'createTable',
    name: '姐妹局',
    seats: ['阿强', '小红', '小美', '小丽'],
    mySeat: '阿强',
    seatGenders: { 阿强: 'male', 小红: 'female', 小美: 'female', 小丽: 'female' },
  })
  assert.equal(created.ok, true)
  assert.deepEqual(
    Object.fromEntries(created.table.players.map((p) => [p.name, p.gender])),
    { 阿强: 'male', 小红: 'female', 小美: 'female', 小丽: 'female' },
  )

  // 管理员将「小美」改成男
  const updated = await cloud.main({
    schemaVersion: 2,
    action: 'updateSeatGenders',
    tableId: created.table.id,
    seatGenders: { 小美: 'male' },
  })
  assert.equal(updated.ok, true)
  assert.equal(updated.table.players.find((p) => p.name === '小美').gender, 'male')

  // 3. 好友入座后，其 users.gender（个人资料性别）优先于建桌预设
  cloud.setOwner('friend-xiaomei')
  await cloud.db.collection('users').add({ data: { _openid: 'friend-xiaomei', nickname: '小美', gender: 'female' } })
  const preview = await cloud.main({ schemaVersion: 2, action: 'previewTable', inviteCode: created.table.inviteCode })
  assert.equal(preview.table.players.find((p) => p.name === '小美').gender, 'male')
  const joined = await cloud.main({ schemaVersion: 2, action: 'claimSeat', tableId: created.table.id, playerName: '小美' })
  assert.equal(joined.ok, true)
  assert.equal(joined.table.players.find((p) => p.name === '小美').gender, 'female')

  // 4. 前端旋转槽位构建：任何角色登录，正下方永远是自己与自己的性别，其余三人名字/性别/分数严格一一对应
  const { buildTableSeatSlots } = load('src/core/table-seat-layout')
  const ranking = [
    { name: 'HENING', isSelf: false, total: 120, games: 5 },
    { name: 'WUYU', isSelf: false, total: 40, games: 5 },
    { name: 'TANGXIANG', isSelf: false, total: -60, games: 5 },
    { name: 'DUHAN', isSelf: false, total: -100, games: 5 },
  ]
  const heningSlots = buildTableSeatSlots({ table: { ...fixedTable, mySeat: 'HENING' }, ranking })
  assert.deepEqual(
    heningSlots.map((s) => [s.position, s.name, s.gender, s.score, s.isSelf]),
    [
      ['bottom', 'HENING', 'male', 120, true],
      ['left', 'WUYU', 'male', 40, false],
      ['top', 'TANGXIANG', 'female', -60, false],
      ['right', 'DUHAN', 'female', -100, false],
    ],
  )
  const tangxiangSlots = buildTableSeatSlots({ table: { ...fixedTable, mySeat: 'TANGXIANG' }, ranking })
  assert.deepEqual(
    tangxiangSlots.map((s) => [s.position, s.name, s.gender, s.score, s.isSelf]),
    [
      ['bottom', 'TANGXIANG', 'female', -60, true],
      ['left', 'DUHAN', 'female', -100, false],
      ['top', 'HENING', 'male', 120, false],
      ['right', 'WUYU', 'male', 40, false],
    ],
  )
})
