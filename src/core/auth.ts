import Taro from '@tarojs/taro'
import { fetchCloudRecords, mergeRecords, syncRecordToCloud, type TrainRecord } from './cloud'
import { pushLocalFavoritesToCloud, syncCloudFavoritesToLocal } from './favorite-service'
import { syncCloudMatchesToLocal } from './match-service'

/**
 * 微信小程序登录与用户信息管理
 * - 静默登录：wx.login() → 云函数获取 openid
 * - 头像：open-type="chooseAvatar" → 云存储上传
 * - 昵称：Input type="nickname"
 */

export { getCachedUser, type UserInfo } from './table-identity-service'
import { cacheUser, getCachedUser, type UserInfo } from './table-identity-service'

export function isLoggedIn(): boolean { return !!getCachedUser()?.openid }
let loginRequest: Promise<UserInfo | null> | undefined

/**
 * 静默登录：调用 loginUser 云函数
 * 自动获取 openid，创建/查询用户记录
 * 登录成功后自动从云端恢复训练记录
 */
export function ensureLogin(): Promise<UserInfo | null> {
  if (loginRequest) return loginRequest
  const previous = getCachedUser()
  loginRequest = (async () => {
    try {
      const res = await Taro.cloud.callFunction({ name: 'loginUser', data: {} })
      const result = res?.result as { ok: boolean; user?: UserInfo; error?: string }
      if (!result?.ok || !result.user) return getCachedUser()
      const latest = getCachedUser()
      // 认领/解绑已在登录请求途中完成时，旧登录快照不能覆盖新身份。
      if (latest?.openid === result.user.openid && latest.identity?.bindingId !== previous?.identity?.bindingId) return latest
      cacheUser(result.user)
      if (previous?.openid !== result.user.openid) {
        void syncCloudRecordsToLocal()
        pushLocalRecordsToCloud()
        void syncCloudFavoritesToLocal()
        pushLocalFavoritesToCloud()
      }
      void syncCloudMatchesToLocal()
      return result.user
    } catch {
      // 网络失败可读已绑定缓存；明确的解绑由云端身份响应处理。
      return getCachedUser()
    }
  })().finally(() => { loginRequest = undefined })
  return loginRequest
}

/**
 * 从云端拉取训练记录并合并到本地
 * 登录成功后、或手动触发时调用
 */
export async function syncCloudRecordsToLocal(): Promise<number> {
  try {
    const cloudRecords = await fetchCloudRecords()
    if (!cloudRecords || cloudRecords.length === 0) return 0

    const localRecords: TrainRecord[] = Taro.getStorageSync('train_records') || []
    const merged = mergeRecords(localRecords, cloudRecords)
    Taro.setStorageSync('train_records', merged.slice(0, 500))
    return merged.length - localRecords.length
  } catch (e: any) {
    console.warn('[auth] sync cloud records error:', e?.message)
    return 0
  }
}

/**
 * 将本地记录批量上传到云端（去重，云函数端按 id 判重）
 * 登录成功后调用，确保之前本地-only 的记录也能上云
 */
export function pushLocalRecordsToCloud() {
  try {
    const records: TrainRecord[] = Taro.getStorageSync('train_records') || []
    // 最多同步最近 100 条，避免一次性调用太多云函数
    records.slice(0, 100).forEach((r) => {
      if (r && r.id) syncRecordToCloud(r)
    })
  } catch {
    /* ignore */
  }
}

/**
 * 上传头像到云存储
 * @param tempFilePath chooseAvatar 返回的临时文件路径
 * @returns 云存储 fileID
 */
export async function uploadAvatar(tempFilePath: string): Promise<string | null> {
  try {
    const openid = getCachedUser()?.openid || 'unknown'
    const cloudPath = `avatars/${openid}_${Date.now()}.jpg`
    const res = await Taro.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath,
    })
    return res.fileID || null
  } catch (e: any) {
    console.warn('[auth] upload avatar error:', e?.message)
    return null
  }
}

/**
 * 更新用户资料（头像 + 昵称）到云端
 */
export async function updateUserProfile(input: {
  avatarUrl?: string
  nickname?: string
}): Promise<UserInfo | null> {
  try {
    const res = await Taro.cloud.callFunction({
      name: 'updateProfile',
      data: input,
    })
    const result = res?.result as { ok: boolean; user?: UserInfo; error?: string }
    if (!result?.ok || !result.user) {
      console.warn('[auth] updateProfile failed:', result?.error)
      return null
    }
    // 合并更新缓存
    const cached = getCachedUser()
    const merged = { ...cached, ...result.user } as UserInfo
    cacheUser(merged)
    return merged
  } catch (e: any) {
    console.warn('[auth] update error:', e?.message)
    return null
  }
}

/**
 * 获取用户头像临时链接（云存储 fileID → 可显示的 URL）
 * 对于云存储 fileID，Image 组件可直接使用 fileID 显示
 * 此函数仅在需要 URL 的场景下使用
 */
export async function getAvatarTempUrl(fileID: string): Promise<string> {
  if (!fileID.startsWith('cloud://')) return fileID
  try {
    const res = await Taro.cloud.getTempFileURL({ fileList: [fileID] })
    return res.fileList?.[0]?.tempFileURL || fileID
  } catch {
    return fileID
  }
}
