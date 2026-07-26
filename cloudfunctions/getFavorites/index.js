const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 拉取当前用户全部收藏
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const res = await db.collection('favorites')
    .where({ _openid: OPENID })
    .orderBy('createdAt', 'desc')
    .limit(500)
    .get()
  return { ok: true, favorites: res.data }
}
