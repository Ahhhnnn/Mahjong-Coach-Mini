const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 保存/更新单条牌局（按 id 去重；已存在则更新）
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const {
    id,
    playedAt,
    variant,
    location,
    settleUnit,
    result,
    players,
    performance,
    reasons,
    note,
    createdAt,
    updatedAt,
  } = event

  if (!id) return { ok: false, msg: 'missing id' }
  if (!Array.isArray(players) || players.length === 0) {
    return { ok: false, msg: 'missing players' }
  }

  const payload = {
    id,
    playedAt: playedAt || Date.now(),
    variant: variant || 'xuezhan',
    location: location || '',
    settleUnit: settleUnit || 'score',
    result: result || 'draw',
    players,
    performance: performance || null,
    reasons: Array.isArray(reasons) ? reasons : [],
    note: note || '',
    createdAt: createdAt || Date.now(),
    updatedAt: updatedAt || Date.now(),
  }

  const exist = await db.collection('matches').where({ _openid: OPENID, id }).limit(1).get()
  if (exist.data && exist.data.length > 0) {
    const docId = exist.data[0]._id
    await db.collection('matches').doc(docId).update({
      data: {
        ...payload,
        updatedAtServer: db.serverDate(),
      },
    })
    return { ok: true, updated: true }
  }

  await db.collection('matches').add({
    data: {
      _openid: OPENID,
      ...payload,
      createdAtServer: db.serverDate(),
      updatedAtServer: db.serverDate(),
    },
  })
  return { ok: true }
}
