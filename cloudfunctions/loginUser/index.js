const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 静默登录云函数
 * 1. 通过 cloud.getWXContext() 获取 openid
 * 2. 在 users 集合中查找/创建用户记录
 * 3. 返回用户信息（openid, nickname, avatarUrl, createdAt）
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { ok: false, error: '无法获取用户身份' }
  }

  try {
    // 查找已有用户
    const exist = await db.collection('users').where({ _openid: OPENID }).get()
    if (exist.data.length > 0) {
      const user = exist.data[0]
      return {
        ok: true,
        user: {
          openid: OPENID,
          nickname: user.nickname || '',
          avatarUrl: user.avatarUrl || '',
          createdAt: user.createdAt,
        },
      }
    }

    // 创建新用户
    const now = db.serverDate()
    await db.collection('users').add({
      data: {
        _openid: OPENID,
        nickname: '',
        avatarUrl: '',
        createdAt: now,
        updatedAt: now,
      },
    })

    return {
      ok: true,
      user: {
        openid: OPENID,
        nickname: '',
        avatarUrl: '',
        createdAt: new Date().toISOString(),
      },
    }
  } catch (e) {
    return { ok: false, error: e.message || '登录失败' }
  }
}
