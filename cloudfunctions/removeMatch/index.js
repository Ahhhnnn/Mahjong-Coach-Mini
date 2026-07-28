const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 删除单条牌局
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { id } = event
  if (!id) return { ok: false, msg: 'missing id' }

  const exist = await db.collection('matches').where({ _openid: OPENID, id }).limit(20).get()
  const tasks = (exist.data || []).map((doc) => db.collection('matches').doc(doc._id).remove())
  await Promise.all(tasks)
  return { ok: true, removed: tasks.length }
}
