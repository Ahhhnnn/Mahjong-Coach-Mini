const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 更新用户头像和昵称
 * 接收: { avatarUrl, nickname }
 * avatarUrl 可以是云存储 fileID 或临时路径已上传后的 fileID
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { ok: false, error: '无法获取用户身份' }
  }

  const { avatarUrl, nickname } = event

  try {
    const updateData = { updatedAt: db.serverDate() }
    if (typeof avatarUrl === 'string' && avatarUrl) {
      updateData.avatarUrl = avatarUrl
    }
    if (typeof nickname === 'string' && nickname.trim()) {
      updateData.nickname = nickname.trim().slice(0, 20)
    }

    // 更新 users 集合中当前用户的记录
    const result = await db
      .collection('users')
      .where({ _openid: OPENID })
      .update({ data: updateData })

    if (result.stats.updated === 0) {
      // 用户记录不存在，创建一条
      await db.collection('users').add({
        data: {
          _openid: OPENID,
          nickname: (nickname || '').trim().slice(0, 20) || '',
          avatarUrl: avatarUrl || '',
          createdAt: db.serverDate(),
          ...updateData,
        },
      })
    }

    return {
      ok: true,
      user: {
        openid: OPENID,
        nickname: updateData.nickname || '',
        avatarUrl: updateData.avatarUrl || '',
      },
    }
  } catch (e) {
    return { ok: false, error: e.message || '更新失败' }
  }
}
