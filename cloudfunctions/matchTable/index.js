const cloud = require('wx-server-sdk')
const { createHash, randomBytes } = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const TABLE_ID = 'fixed-four'
const NAMES = ['HENING', 'WUYU', 'TANGXIANG', 'DUHAN']
const REASONS = ['greedy', 'aggressive', 'defense', 'discard', 'riichi_choice', 'luck']
const hash = (value) => createHash('sha256').update(value).digest('hex')
const matchKey = (id) => hash(`${TABLE_ID}:${id}`)
const fail = (code, msg) => ({ ok: false, code, msg })
const dataOf = (result) => Array.isArray(result.data) ? result.data[0] : result.data
async function readDoc(ref) {
  try { return dataOf(await ref.get()) }
  catch (error) {
    if (/document.*(?:not exist|not found)|DOCUMENT_NOT_EXIST/i.test(error.message || error.errMsg || '')) return undefined
    throw error
  }
}
function memberOf(table, openid) {
  const playerName = NAMES.find((name) => table?.members?.[name]?.openid === openid)
  if (!playerName) return null
  return { playerName, bindingId: table.members[playerName].bindingId,
    role: table.adminOpenid === openid ? 'admin' : 'member', tableId: TABLE_ID }
}
function statusOf(table, openid) {
  return { ok: true, identity: memberOf(table, openid),
    players: NAMES.map((name) => ({ name, claimed: !!table.members[name]?.openid })) }
}
async function pages(collection, fields) {
  const items = []
  for (let skip = 0; ; skip += 100) {
    const result = await db.collection(collection).where(fields).skip(skip).limit(100).get()
    items.push(...result.data)
    if (result.data.length < 100) return items
  }
}
function publicRecord(record, review) {
  const { id, playedAt, variant, settleUnit, location, note, createdAt, updatedAt, revision } = record
  return { id, playedAt, variant, settleUnit, location, note, createdAt, updatedAt, revision,
    players: record.players.map(({ name, scoreDelta }) => ({ name, scoreDelta })),
    ...(review ? { performance: review.performance, reasons: review.reasons } : {}) }
}

// 所有身份和共享牌局操作集中在这里；客户端传入的姓名、角色不用于授权。
exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return fail('UNAUTHORIZED', '请先微信登录')
  if (event.schemaVersion !== 2) return fail('UPGRADE_REQUIRED', '请更新小程序后重试')
  try {
    const tableRef = db.collection('match_tables').doc(TABLE_ID)
    const table = await readDoc(tableRef)
    if (!table?.ready) return fail('NOT_READY', '牌桌正在升级，请稍后再试')
    const identity = memberOf(table, OPENID)
    if (event.action === 'status') return statusOf(table, OPENID)
    if (event.action === 'claim' || event.action === 'release') {
      if (!NAMES.includes(event.playerName)) return fail('INVALID', '请选择固定四人中的一位')
      return await db.runTransaction(async (transaction) => {
        const ref = transaction.collection('match_tables').doc(TABLE_ID)
        const current = await readDoc(ref)
        if (!current?.ready) return fail('NOT_READY', '牌桌正在升级')
        const mine = memberOf(current, OPENID)
        if (event.action === 'claim') {
          if (mine) return mine.playerName === event.playerName ? statusOf(current, OPENID)
            : fail('ALREADY_BOUND', '你已经认领了其他身份')
          if (current.members[event.playerName]?.openid) return fail('TAKEN', '这个身份已被认领，请重新选择')
          current.members[event.playerName] = { openid: OPENID, bindingId: randomBytes(16).toString('hex'), claimedAt: Date.now() }
        } else {
          if (mine?.role !== 'admin') return fail('FORBIDDEN', '仅管理员可以解除绑定')
          if (event.playerName === mine.playerName) return fail('INVALID', '不能解除管理员本人的绑定')
          current.members[event.playerName] = { openid: null, bindingId: null }
        }
        await ref.update({ data: { members: current.members, updatedAt: db.serverDate() } })
        return statusOf(current, OPENID)
      })
    }
    if (!identity || event.bindingId !== identity.bindingId) return fail('UNBOUND', '请先认领自己的身份')
    if (event.action === 'list') {
      const records = await pages('table_matches', { tableId: TABLE_ID })
      const reviews = await pages('match_reviews', { tableId: TABLE_ID, playerName: identity.playerName })
      const latest = memberOf(await readDoc(tableRef), OPENID)
      if (latest?.bindingId !== identity.bindingId) return fail('UNBOUND', '身份已解除，请重新认领')
      const byId = new Map(reviews.map((review) => [review.matchId, review]))
      return { ok: true, identity, matches: records.filter((r) => !r._deleted)
        .map((r) => publicRecord(r, byId.get(r.id)))
        .sort((a, b) => a.playedAt - b.playedAt || a.id.localeCompare(b.id)),
      deletedIds: records.filter((r) => r._deleted).map((r) => r.id) }
    }
    if (!['save', 'remove'].includes(event.action)) return fail('INVALID', '未知操作')
    if (typeof event.id !== 'string' || !event.id || event.id.length > 128
      || !Number.isInteger(event.revision) || event.revision < 0
      || typeof event.mutationId !== 'string' || !event.mutationId || event.mutationId.length > 160) {
      return fail('INVALID', '牌局版本信息无效，请刷新后重试')
    }
    if (event.action === 'save') {
      const players = event.players
      if (!Number.isFinite(event.playedAt) || event.playedAt <= 0 || event.settleUnit !== 'score'
        || !Array.isArray(players) || players.length !== 4 || new Set(players.map((p) => p?.name)).size !== 4
        || players.some((p) => !p || !NAMES.includes(p.name) || !Number.isFinite(p.scoreDelta))
        || Math.abs(players.reduce((sum, p) => sum + p.scoreDelta, 0)) > 1e-6) return fail('INVALID', '四人积分必须完整且合计为零')
    }
    return await db.runTransaction(async (transaction) => {
      // 与认领/解除共用事务读取，防止权限撤销时写入仍成功。
      const currentTable = await readDoc(transaction.collection('match_tables').doc(TABLE_ID))
      const currentIdentity = memberOf(currentTable, OPENID)
      if (!currentTable?.ready || currentIdentity?.bindingId !== identity.bindingId) return fail('UNBOUND', '身份已解除，请重新认领')
      const ref = transaction.collection('table_matches').doc(matchKey(event.id))
      const previous = await readDoc(ref)
      if (previous?.lastMutationId === event.mutationId && previous?.lastBindingId === identity.bindingId) {
        return { ok: true, revision: previous.revision, deleted: !!previous._deleted }
      }
      if (previous?._deleted) return fail('DELETED', '这场牌局已经被删除')
      if ((previous?.revision || 0) !== event.revision || (event.action === 'remove' && !previous)) {
        return fail('CONFLICT', '牌局已被其他人修改，请刷新后重新编辑')
      }
      const now = Date.now()
      const revision = (previous?.revision || 0) + 1
      const metadata = { revision, lastMutationId: event.mutationId, lastBindingId: identity.bindingId,
        updatedBy: identity.playerName, updatedAt: now, updatedAtServer: db.serverDate() }
      if (event.action === 'remove') {
        await ref.update({ data: { ...metadata, _deleted: true } })
        return { ok: true, revision, deleted: true }
      }
      const record = {
        id: event.id, tableId: TABLE_ID, variant: 'xuezhan', settleUnit: 'score', playedAt: event.playedAt,
        players: NAMES.map((name) => ({ name, scoreDelta: event.players.find((p) => p.name === name).scoreDelta })),
        location: typeof event.location === 'string' ? event.location.trim().slice(0, 100) : '',
        note: typeof event.note === 'string' ? event.note.trim().slice(0, 500) : '',
        createdAt: previous?.createdAt || now, createdBy: previous?.createdBy || identity.playerName,
        ...metadata,
      }
      await ref.set({ data: record })
      const reviewRef = transaction.collection('match_reviews').doc(hash(`${TABLE_ID}:${event.id}:${identity.playerName}`))
      await reviewRef.set({ data: { tableId: TABLE_ID, matchId: event.id, playerName: identity.playerName,
        performance: ['good', 'normal', 'mistake'].includes(event.performance) ? event.performance : null,
        reasons: Array.isArray(event.reasons) ? [...new Set(event.reasons.filter((r) => REASONS.includes(r)))] : [],
        updatedAt: now } })
      return { ok: true, revision, updatedAt: now }
    })
  } catch (error) {
    console.error('[matchTable]', error)
    return fail('SERVER_ERROR', '暂时无法连接牌桌，请稍后重试')
  }
}
