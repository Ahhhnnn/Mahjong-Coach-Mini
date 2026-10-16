const cloud = require('wx-server-sdk')
const { createHash } = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 保留删除标记，防止离线设备的旧页面编辑重新上传已删除的牌局。
exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const { id } = event
  if (!OPENID || typeof id !== 'string' || !id || id.length > 128) return { ok: false, msg: 'missing identity or id' }
  const matches = db.collection('matches')
  const existing = await matches.where({ _openid: OPENID, id }).limit(1).get()
  const payload = { id, _deleted: true, updatedAt: Date.now(), updatedAtServer: db.serverDate() }
  if (!existing.data.length) {
    const _id = createHash('sha256').update(`${OPENID}:${id}`).digest('hex')
    try {
      await matches.add({ data: { ...payload, _id, _openid: OPENID, playedAt: Date.now(), createdAtServer: db.serverDate() } })
      return { ok: true }
    } catch (error) {
      const result = await matches.doc(_id).get()
      if (!(Array.isArray(result.data) ? result.data[0] : result.data)) throw error
    }
  }
  await matches.where({ _openid: OPENID, id }).update({ data: payload })
  return { ok: true }
}
