const assert = require('node:assert/strict')
const { test } = require('node:test')
const { server, seeds, clone, hash } = require('./helpers/table-harness.cjs')
const { createMigration } = require('../scripts/migrate-shared-table.cjs')
function fixture() {
  const cloud = server()
  cloud.tables.delete('fixed-four')
  const old = new Map(seeds.map((r, i) => [`legacy-${i}`, { ...clone(r), _id: `legacy-${i}`, _openid: 'owner' }]))
  old.set('other-account', { ...clone(seeds[0]), _openid: 'other', id: 'private-other' })
  cloud.collections.set('matches', old)
  const migrate = createMigration({ db: cloud.db, ownerOpenid: 'owner' })
  return { ...cloud, migrate, old }
}
test('迁移预检只导出已有记录，不修改数据', async () => {
  const cloud = fixture(), before = clone([...cloud.old])
  const result = await cloud.migrate()
  assert.equal(result.active, 21); assert.equal(result.backup.length, 21)
  assert.deepEqual(result.totals, { HENING: -297, WUYU: 4, TANGXIANG: -249, DUHAN: 542 })
  assert.deepEqual([...cloud.old], before); assert.equal(cloud.documents.size, 0)
})
test('迁移保留全部业务字段和私人复盘，建立管理员绑定，重复执行无副本', async () => {
  const cloud = fixture(), before = clone([...cloud.old])
  const later = { ...clone(seeds[0]), id: 'm_later', note: 'later manual', performance: 'mistake', reasons: ['defense'] }
  cloud.old.set('manual', { ...later, _openid: 'owner', _id: 'manual' })
  const first = await cloud.migrate({ apply: true })
  assert.equal(first.ok, true); assert.equal(first.active, 22); assert.deepEqual(first.differences, [])
  assert.equal(cloud.tables.get('fixed-four').members.HENING.openid, 'owner')
  assert.equal(cloud.tables.get('fixed-four').ready, true)
  assert.equal(cloud.reviews.get(hash('fixed-four:m_later:HENING')).performance, 'mistake')
  const writes = cloud.writes.length
  const second = await cloud.migrate({ apply: true })
  assert.equal(second.alreadyMigrated, true); assert.equal(cloud.documents.size, 22); assert.equal(cloud.writes.length, writes)
  assert.deepEqual([...cloud.old].slice(0, before.length), before)
})
test('重复旧 ID 以删除标记为准，匿名存档排除，他人数据不进入牌桌', async () => {
  const cloud = fixture()
  const deleted = { _id: 'deleted', _openid: 'owner', id: seeds[0].id, _deleted: true, updatedAt: Date.now() }
  cloud.old.set('deleted', deleted)
  const invalid = clone(seeds[1]); invalid.id = 'anonymous'; invalid.players[1].name = '玩家2'
  cloud.old.set('anonymous', { ...invalid, _openid: 'owner' })
  const result = await cloud.migrate({ apply: true })
  assert.equal(result.active, 20); assert.equal(result.deleted, 1)
  assert.equal(cloud.documents.get(hash(`fixed-four:${seeds[0].id}`))._deleted, true)
  assert.ok(![...cloud.documents.values()].some((r) => ['private-other', 'anonymous'].includes(r.id)))
})
test('迁移后再核验发现差异时不重写线上修改', async () => {
  const cloud = fixture()
  await cloud.migrate({ apply: true })
  const record = cloud.documents.get(hash(`fixed-four:${seeds[0].id}`)); record.note = 'edited after migration'
  const writes = cloud.writes.length, result = await cloud.migrate({ apply: true })
  assert.equal(result.ok, false); assert.equal(result.differences.length, 1)
  assert.equal(record.note, 'edited after migration'); assert.equal(cloud.writes.length, writes)
})
