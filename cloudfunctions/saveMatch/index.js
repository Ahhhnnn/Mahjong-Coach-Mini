const cloud = require('wx-server-sdk')
const { createHash } = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const matches = () => db.collection('matches')
const validTime = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0

// 仅保存页面明确录入的一场牌局，不包含默认历史初始化逻辑。
exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, msg: 'missing identity' }
  const { id, playedAt, settleUnit, players, updatedAt } = event
  const names = ['HENING', 'WUYU', 'TANGXIANG', 'DUHAN']
  if (typeof id !== 'string' || !id || id.length > 128 || !validTime(playedAt) || !validTime(updatedAt)
    || settleUnit !== 'score' || !Array.isArray(players) || players.length !== 4) {
    return { ok: false, msg: 'invalid match' }
  }
  const field = 'scoreDelta'
  if (new Set(players.map((player) => player?.name)).size !== 4
    || players.some((player) => !player || !names.includes(player.name) || !Number.isFinite(player[field]))) {
    return { ok: false, msg: 'invalid players' }
  }
  const delta = players.find((player) => player.name === 'HENING')[field]
  const payload = {
    id, playedAt, variant: 'xuezhan', settleUnit,
    location: typeof event.location === 'string' ? event.location : '',
    result: delta > 0 ? 'win' : delta < 0 ? 'loss' : 'draw',
    players: players.map((player) => ({ name: player.name, isSelf: player.name === 'HENING', [field]: player[field] })),
    performance: event.performance || null,
    reasons: Array.isArray(event.reasons) ? event.reasons : [],
    note: typeof event.note === 'string' ? event.note : '',
    createdAt: validTime(event.createdAt) ? event.createdAt : updatedAt,
    updatedAt, updatedAtServer: db.serverDate(),
  }
  const existing = await matches().where({ _openid: OPENID, id }).limit(100).get()
  if (existing.data.some((record) => record._deleted)) return { ok: true, deleted: true }
  let previous = existing.data.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]
  if (!previous) {
    const _id = createHash('sha256').update(`${OPENID}:${id}`).digest('hex')
    try {
      await matches().add({ data: { ...payload, _id, _openid: OPENID, createdAtServer: db.serverDate() } })
      return { ok: true }
    } catch (error) {
      const result = await matches().doc(_id).get()
      previous = Array.isArray(result.data) ? result.data[0] : result.data
      if (!previous) throw error
    }
  }
  if (previous._deleted) return { ok: true, deleted: true }
  if ((previous.updatedAt || 0) >= updatedAt) return { ok: true }
  await matches().where({
    _id: previous._id, _openid: OPENID,
    updatedAt: db.command.lte(updatedAt), _deleted: db.command.neq(true),
  }).update({ data: { ...payload, createdAt: previous.createdAt || payload.createdAt } })
  return { ok: true }
}
