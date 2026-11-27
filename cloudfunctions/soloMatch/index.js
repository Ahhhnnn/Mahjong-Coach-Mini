const cloud = require('wx-server-sdk')
const { createHash } = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const REASONS = ['greedy', 'aggressive', 'defense', 'discard', 'riichi_choice', 'luck']
const SEATS = ['east', 'south', 'west', 'north']
const hash = (value) => createHash('sha256').update(value).digest('hex')
const fail = (code, msg) => ({ ok: false, code, msg })
const dataOf = (result) => Array.isArray(result.data) ? result.data[0] : result.data
async function readDoc(ref) {
  try { return dataOf(await ref.get()) }
  catch (error) {
    if (/document.*(?:not exist|not found)|DOCUMENT_NOT_EXIST/i.test(error.message || error.errMsg || '')) return undefined
    throw error
  }
}
async function pages(openid) {
  const items = []
  for (let skip = 0; ; skip += 100) {
    const result = await db.collection('solo_matches').where({ ownerOpenid: openid }).skip(skip).limit(100).get()
    items.push(...result.data)
    if (result.data.length < 100) return items
  }
}
function publicRecord(record) {
  const { id, playedAt, variant, settleUnit, scoreDelta, location, seat, note, performance, reasons, createdAt, updatedAt, revision, source, sourceTableId } = record
  return {
    id, playedAt, variant, settleUnit, scoreDelta, location, seat: SEATS.includes(seat) ? seat : '', note, performance, reasons, createdAt, updatedAt, revision,
    source: source === 'table' ? 'table' : '', sourceTableId: typeof sourceTableId === 'string' ? sourceTableId : '',
  }
}

// 单人分数只属于当前 openid。本地缓存可以丢，云端文档是这份账本的正文。
exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return fail('UNAUTHORIZED', '请先微信登录')
  try {
    if (event.action === 'list') {
      const records = await pages(OPENID)
      return {
        ok: true,
        matches: records.filter((record) => !record._deleted).map(publicRecord)
          .sort((a, b) => a.playedAt - b.playedAt || a.id.localeCompare(b.id)),
        deletedIds: records.filter((record) => record._deleted).map((record) => record.id),
      }
    }
    if (!['save', 'remove'].includes(event.action)) return fail('INVALID', '未知操作')
    if (typeof event.id !== 'string' || !event.id || event.id.length > 128
      || !Number.isInteger(event.revision) || event.revision < 0
      || typeof event.mutationId !== 'string' || !event.mutationId || event.mutationId.length > 160) {
      return fail('INVALID', '记录版本信息无效，请刷新后重试')
    }
    if (event.id.startsWith('tm:')) return fail('INVALID', '四人牌局的分数请在牌桌里修改')
    if (event.action === 'save' && (!Number.isFinite(event.playedAt) || event.playedAt <= 0
      || event.settleUnit !== 'score' || !Number.isFinite(event.scoreDelta))) {
      return fail('INVALID', '请输入有效的单人分数')
    }
    return await db.runTransaction(async (transaction) => {
      const ref = transaction.collection('solo_matches').doc(hash(`${OPENID}:${event.id}`))
      const previous = await readDoc(ref)
      if (previous && previous.ownerOpenid !== OPENID) return fail('FORBIDDEN', '不能修改别人的单人记录')
      if (previous?.lastMutationId === event.mutationId) return { ok: true, revision: previous.revision, deleted: !!previous._deleted }
      if (previous?._deleted) return fail('DELETED', '这场记录已经被删除')
      if ((previous?.revision || 0) !== event.revision || (event.action === 'remove' && !previous)) {
        return fail('CONFLICT', '记录已在其他设备更新，请刷新后重新编辑')
      }
      const now = Date.now()
      const revision = (previous?.revision || 0) + 1
      const metadata = { revision, lastMutationId: event.mutationId, updatedAt: now, updatedAtServer: db.serverDate() }
      if (event.action === 'remove') {
        await ref.update({ data: { ...metadata, _deleted: true } })
        return { ok: true, revision, deleted: true }
      }
      await ref.set({ data: {
        id: event.id, ownerOpenid: OPENID, variant: 'xuezhan', settleUnit: 'score',
        playedAt: event.playedAt, scoreDelta: event.scoreDelta,
        location: typeof event.location === 'string' ? event.location.trim().slice(0, 100) : '',
        seat: SEATS.includes(event.seat) ? event.seat : '',
        note: typeof event.note === 'string' ? event.note.trim().slice(0, 500) : '',
        performance: ['good', 'normal', 'mistake'].includes(event.performance) ? event.performance : null,
        reasons: Array.isArray(event.reasons) ? [...new Set(event.reasons.filter((reason) => REASONS.includes(reason)))] : [],
        createdAt: previous?.createdAt || now,
        ...metadata,
      } })
      return { ok: true, revision, updatedAt: now }
    })
  } catch (error) {
    console.error('[soloMatch]', error)
    return fail('SERVER_ERROR', '暂时无法保存单人分数，请稍后重试')
  }
}
