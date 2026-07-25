const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 保存单条训练记录（按 id 去重）
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { id, puzzleId, tile, hit, reasonable, time } = event
  if (!id) return { ok: false, msg: 'missing id' }

  const exist = await db.collection('records').where({ _openid: OPENID, id }).count()
  if (exist.total > 0) return { ok: true, duplicated: true }

  await db.collection('records').add({
    data: {
      _openid: OPENID,
      id,
      puzzleId,
      tile,
      hit: !!hit,
      reasonable: !!reasonable,
      time: time || Date.now(),
      createdAt: db.serverDate(),
    },
  })
  return { ok: true }
}
