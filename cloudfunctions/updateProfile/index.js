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

  const { avatarUrl, nickname, gender } = event
  const validGender = gender === 'male' || gender === 'female' ? gender : undefined

  try {
    const updateData = { updatedAt: db.serverDate() }
    if (typeof avatarUrl === 'string' && avatarUrl) {
      updateData.avatarUrl = avatarUrl
    }
    if (typeof nickname === 'string' && nickname.trim()) {
      updateData.nickname = nickname.trim().slice(0, 20)
    }
    if (validGender) {
      updateData.gender = validGender
    }

    // 读取已有记录，确保返回完整资料且不覆盖未传入字段
    const exist = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    const current = exist.data[0]
    if (current) {
      await db.collection('users').where({ _openid: OPENID }).update({ data: updateData })
    } else {
      await db.collection('users').add({
        data: {
          _openid: OPENID,
          nickname: (nickname || '').trim().slice(0, 20) || '',
          avatarUrl: avatarUrl || '',
          ...(validGender ? { gender: validGender } : {}),
          createdAt: db.serverDate(),
          ...updateData,
        },
      })
    }

    const finalGender = validGender || (current?.gender === 'male' || current?.gender === 'female' ? current.gender : undefined)
    return {
      ok: true,
      user: {
        openid: OPENID,
        nickname: updateData.nickname ?? current?.nickname ?? '',
        avatarUrl: updateData.avatarUrl ?? current?.avatarUrl ?? '',
        ...(finalGender ? { gender: finalGender } : {}),
      },
    }
  } catch (e) {
    return { ok: false, error: e.message || '更新失败' }
  }
}
