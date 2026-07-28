const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const puzzles = require('./puzzles-data')

// 一次性导入脚本：将 puzzles-data.js 写入云数据库 puzzles 集合
// 部署后在云开发控制台手动触发一次即可（会覆盖同 _id 文档）
exports.main = async () => {
  const results = []

  for (let i = 0; i < puzzles.length; i++) {
    const p = puzzles[i]
    const doc = {
      _id: p.id,
      mode: p.mode,
      variant: p.variant || 'basic',
      title: p.title || '',
      difficulty: p.difficulty,
      hand: p.hand,
      melds: p.melds || [],
      recommendedDiscards: p.recommendedDiscards,
      discussableDiscards: p.discussableDiscards || [],
      analysis: p.analysis,
      rewards: p.rewards || { xp: 10, score: 5 },
      order: i + 1,
    }

    try {
      // 先尝试更新，不存在则新增（幂等）
      await db.collection('puzzles').doc(doc._id).update({ data: doc })
      results.push({ id: doc._id, action: 'updated' })
    } catch {
      try {
        await db.collection('puzzles').add({ data: doc })
        results.push({ id: doc._id, action: 'added' })
      } catch (e) {
        results.push({ id: doc._id, action: 'error', msg: e.message })
      }
    }
  }

  return { ok: true, total: puzzles.length, results }
}
