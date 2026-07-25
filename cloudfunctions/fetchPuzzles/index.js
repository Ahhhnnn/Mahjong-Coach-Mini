const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 获取题目列表（按 order 升序）
// 入参：{ page?, pageSize?, difficulty? }
// 返回：{ ok, puzzles, total }
exports.main = async (event) => {
  const { page = 1, pageSize = 100, difficulty } = event || {}

  let query = db.collection('puzzles')

  if (difficulty) {
    query = query.where({ difficulty })
  }

  const countRes = await query.count()
  const total = countRes.total

  const res = await query
    .orderBy('order', 'asc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return { ok: true, puzzles: res.data, total }
}
