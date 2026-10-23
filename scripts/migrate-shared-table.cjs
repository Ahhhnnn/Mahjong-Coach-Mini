/**
 * 运维迁移模块，不是小程序云函数入口。
 * 仅由临时、限定原账号 OPENID 的运维函数加载；执行完删除临时函数。
 * 先冻结旧写接口，dryRun 导出完整备份，再 apply，最后部署正式登录/牌桌接口。
 */
const { createHash, randomBytes } = require('node:crypto')
const TABLE_ID = 'fixed-four'
const NAMES = ['HENING', 'WUYU', 'TANGXIANG', 'DUHAN']
const hash = (value) => createHash('sha256').update(value).digest('hex')
const dataOf = (r) => Array.isArray(r.data) ? r.data[0] : r.data
async function readDoc(ref) {
  try { return dataOf(await ref.get()) }
  catch (error) {
    if (/document.*(?:not exist|not found)|DOCUMENT_NOT_EXIST/i.test(error.message || error.errMsg || '')) return undefined
    throw error
  }
}
async function pages(db, name, fields) {
  const docs = []
  for (let skip = 0; ; skip += 100) {
    const result = await db.collection(name).where(fields).skip(skip).limit(100).get()
    docs.push(...result.data)
    if (result.data.length < 100) return docs
  }
}
function canonical(record) {
  return { id: record.id, playedAt: record.playedAt, variant: record.variant || 'xuezhan', settleUnit: 'score',
    location: record.location || '', note: record.note || '', createdAt: record.createdAt, updatedAt: record.updatedAt,
    players: NAMES.map((name) => ({ name, scoreDelta: record.players.find((p) => p.name === name).scoreDelta })) }
}
function valid(record) {
  return record.settleUnit === 'score' && typeof record.id === 'string' && record.id.length > 0
    && Number.isFinite(record.playedAt) && Array.isArray(record.players) && record.players.length === 4
    && new Set(record.players.map((p) => p.name)).size === 4
    && record.players.every((p) => NAMES.includes(p.name) && Number.isFinite(p.scoreDelta))
    && Math.abs(record.players.reduce((sum, p) => sum + p.scoreDelta, 0)) < 1e-6
}
function selectLegacy(documents) {
  const byId = new Map()
  for (const record of documents) {
    if (!record.id) continue
    const previous = byId.get(record.id)
    if (!previous || record._deleted || (!previous._deleted && record.updatedAt > previous.updatedAt)) byId.set(record.id, record)
  }
  return [...byId.values()].filter((record) => record._deleted || valid(record))
}
function verify(expected, actual) {
  const differences = []
  const map = new Map(actual.map((r) => [r.id, r]))
  for (const record of expected) {
    const current = map.get(record.id)
    if (!current || !!record._deleted !== !!current._deleted) { differences.push({ id: record.id, reason: 'missing or deletion mismatch' }); continue }
    if (!record._deleted && JSON.stringify(canonical(record)) !== JSON.stringify(canonical(current))) differences.push({ id: record.id, reason: 'business fields mismatch' })
    map.delete(record.id)
  }
  for (const id of map.keys()) differences.push({ id, reason: 'unexpected record' })
  return differences
}
exports.createMigration = ({ db, ownerOpenid }) => async (event = {}) => {
  if (!ownerOpenid) throw new Error('Explicit verified ownerOpenid required')
  const legacy = await pages(db, 'matches', { _openid: ownerOpenid })
  const expected = selectLegacy(legacy)
  const totals = Object.fromEntries(NAMES.map((name) => [name, expected.filter((r) => !r._deleted).reduce((sum, r) => sum + r.players.find((p) => p.name === name).scoreDelta, 0)]))
  const summary = { sourceDocuments: legacy.length, active: expected.filter((r) => !r._deleted).length,
    deleted: expected.filter((r) => r._deleted).length, excluded: legacy.length - expected.length, totals }
  if (!event.apply) return { ok: true, dryRun: true, ...summary, backup: legacy }
  for (const name of ['match_tables', 'table_matches', 'match_reviews', 'table_migration_backups']) {
    try { await db.createCollection(name) }
    catch (error) { if (!/exist|already/i.test(error.message || error.errMsg || '')) throw error }
  }
  const tableRef = db.collection('match_tables').doc(TABLE_ID)
  let table = await readDoc(tableRef)
  if (table && table.adminOpenid !== ownerOpenid) throw new Error('Unexpected table owner')
  if (table?.ready) {
    const differences = verify(expected, await pages(db, 'table_matches', { tableId: TABLE_ID }))
    return { ok: differences.length === 0, alreadyMigrated: true, ...summary, differences }
  }
  const backupRef = db.collection('table_migration_backups').doc(TABLE_ID)
  const originalBackup = await readDoc(backupRef)
  if (!originalBackup) await backupRef.set({ data: { legacy, ownerOpenid, backedUpAt: db.serverDate() } })
  // 中途失败时使用冻结的原始快照恢复；拒绝静默覆盖发生变化的旧数据。
  const savedBackup = originalBackup?.legacy || legacy
  if (JSON.stringify(selectLegacy(savedBackup)) !== JSON.stringify(expected)) throw new Error('Legacy data changed since backup')
  if (!table) {
    table = { ready: false, tableId: TABLE_ID, adminOpenid: ownerOpenid,
      members: Object.fromEntries(NAMES.map((name) => [name, name === 'HENING'
        ? { openid: ownerOpenid, bindingId: randomBytes(16).toString('hex'), claimedAt: Date.now() }
        : { openid: null, bindingId: null }])) }
    await tableRef.set({ data: table })
  }
  for (const record of expected) {
    const ref = db.collection('table_matches').doc(hash(`${TABLE_ID}:${record.id}`))
    const payload = record._deleted ? { id: record.id, tableId: TABLE_ID, _deleted: true, playedAt: record.playedAt || record.updatedAt, updatedAt: record.updatedAt, revision: 1 }
      : { ...canonical(record), tableId: TABLE_ID, revision: 1, createdBy: 'HENING', updatedBy: 'HENING', legacyDocumentId: record._id }
    await ref.set({ data: payload })
    if (!record._deleted && (record.performance || record.reasons?.length)) {
      await db.collection('match_reviews').doc(hash(`${TABLE_ID}:${record.id}:HENING`)).set({ data: {
        tableId: TABLE_ID, matchId: record.id, playerName: 'HENING', performance: record.performance || null,
        reasons: record.reasons || [], updatedAt: record.updatedAt,
      } })
    }
  }
  const actual = await pages(db, 'table_matches', { tableId: TABLE_ID })
  const differences = verify(expected, actual)
  if (differences.length) return { ok: false, ...summary, differences }
  await tableRef.update({ data: { ready: true, migratedAt: db.serverDate() } })
  return { ok: true, ...summary, differences, backupSaved: true }
}
exports.selectLegacy = selectLegacy
exports.verify = verify
