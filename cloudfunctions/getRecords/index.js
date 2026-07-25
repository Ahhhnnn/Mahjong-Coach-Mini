const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 拉取当前用户全部训练记录（最多 1000 条，按时间倒序）
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const res = await db.collection('records')
    .where({ _openid: OPENID })
    .orderBy('time', 'desc')
    .limit(1000)
    .get()
  return { ok: true, records: res.data }
}
