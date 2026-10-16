const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 只读取当前账号已存在的牌局，绝不创建默认记录。
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, msg: 'missing identity' }
  const records = new Map()
  for (let skip = 0; ; skip += 100) {
    const page = await db.collection('matches').where({ _openid: OPENID })
      .orderBy('playedAt', 'asc').orderBy('id', 'asc').skip(skip).limit(100).get()
    for (const record of page.data) {
      const previous = records.get(record.id)
      if (!previous || record._deleted || (!previous._deleted && (record.updatedAt || 0) > (previous.updatedAt || 0))) records.set(record.id, record)
    }
    if (page.data.length < 100) break
  }
  return {
    ok: true,
    matches: [...records.values()].filter((record) => !record._deleted)
      .sort((a, b) => a.playedAt - b.playedAt || a.id.localeCompare(b.id)),
    deletedIds: [...records.values()].filter((record) => record._deleted).map((record) => record.id),
  }
}
