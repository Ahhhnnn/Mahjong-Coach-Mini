import Taro from '@tarojs/taro'
import { fetchCloudRecords, mergeRecords, syncRecordToCloud, type TrainRecord } from './cloud'
import { pushLocalFavoritesToCloud, syncCloudFavoritesToLocal } from './favorite-service'
import { pushLocalMatchesToCloud, syncCloudMatchesToLocal } from './match-service'

/**
 * 微信小程序登录与用户信息管理
 * - 静默登录：wx.login() → 云函数获取 openid
 * - 头像：open-type="chooseAvatar" → 云存储上传
 * - 昵称：Input type="nickname"
 */

export type UserInfo = {
  openid: string
  nickname: string
  avatarUrl: string
}

const STORAGE_KEY = 'user_info'

/** 从 localStorage 读取缓存的用户信息 */
export function getCachedUser(): UserInfo | null {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as UserInfo
  } catch {
    return null
  }
}

/** 判断当前是否已登录（有 openid） */
export function isLoggedIn(): boolean {
  return !!getCachedUser()?.openid
}

/** 缓存用户信息到 localStorage */
function cacheUser(user: UserInfo) {
  try {
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify(user))
  } catch {
    /* ignore */
  }
}

/**
 * 静默登录：调用 loginUser 云函数
 * 自动获取 openid，创建/查询用户记录
 * 登录成功后自动从云端恢复训练记录
 */
export async function ensureLogin(): Promise<UserInfo | null> {
  // 先检查缓存
  const cached = getCachedUser()
  if (cached?.openid) return cached

  try {
    const res = await Taro.cloud.callFunction({ name: 'loginUser', data: {} })
    const result = res?.result as { ok: boolean; user?: UserInfo; error?: string }
    if (!result?.ok || !result.user) {
      console.warn('[auth] loginUser failed:', result?.error)
      return null
    }
    cacheUser(result.user)
    // 登录成功后双向同步：拉取云端记录 + 推送本地记录
    syncCloudRecordsToLocal()
    pushLocalRecordsToCloud()
    syncCloudFavoritesToLocal()
    pushLocalFavoritesToCloud()
    syncCloudMatchesToLocal()
    pushLocalMatchesToCloud()
    return result.user
  } catch (e: any) {
    console.warn('[auth] login error:', e?.message)
    return null
  }
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
