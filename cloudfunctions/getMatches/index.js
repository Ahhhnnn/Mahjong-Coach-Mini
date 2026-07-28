const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 拉取当前用户全部牌局（最多 500 条，按 playedAt 倒序）
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const res = await db
    .collection('matches')
    .where({ _openid: OPENID })
    .orderBy('playedAt', 'desc')
    .limit(500)
    .get()
  return { ok: true, matches: res.data }
}
