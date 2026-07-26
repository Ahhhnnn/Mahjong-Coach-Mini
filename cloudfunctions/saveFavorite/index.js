const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 保存收藏（按 puzzleId 去重）
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { puzzleId, createdAt } = event
  if (!puzzleId) return { ok: false, msg: 'missing puzzleId' }

  const exist = await db.collection('favorites').where({ _openid: OPENID, puzzleId }).count()
  if (exist.total > 0) return { ok: true, duplicated: true }

  await db.collection('favorites').add({
    data: {
      _openid: OPENID,
      puzzleId,
      createdAt: createdAt || Date.now(),
      createdAtServer: db.serverDate(),
    },
  })
  return { ok: true }
}
