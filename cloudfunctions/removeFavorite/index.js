const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 取消收藏
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { puzzleId } = event
  if (!puzzleId) return { ok: false, msg: 'missing puzzleId' }

  const res = await db.collection('favorites')
    .where({ _openid: OPENID, puzzleId })
    .get()

  for (const doc of res.data) {
    await db.collection('favorites').doc(doc._id).remove()
  }
  return { ok: true, removed: res.data.length }
}
