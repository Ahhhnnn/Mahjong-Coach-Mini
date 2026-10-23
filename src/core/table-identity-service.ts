import Taro from '@tarojs/taro'
import { FIXED_MATCH_PLAYERS, type PlayerName } from './match-types'

export interface TableIdentity {
  playerName: PlayerName
  bindingId: string
  tableId: 'fixed-four'
  role: 'admin' | 'member'
}
export interface UserInfo {
  openid: string
  nickname: string
  avatarUrl: string
  identity?: TableIdentity | null
}
export interface TableStatus { identity: TableIdentity | null; players: { name: PlayerName; claimed: boolean }[] }
export const IDENTITY_CHANGED = 'table-identity-changed'
export function getCachedUser(): UserInfo | null {
  try {
    const raw = Taro.getStorageSync('user_info')
    return raw ? typeof raw === 'string' ? JSON.parse(raw) : raw : null
  } catch { return null }
}
export function getTableIdentity(): TableIdentity | null {
  const identity = getCachedUser()?.identity
  return identity?.bindingId && FIXED_MATCH_PLAYERS.includes(identity.playerName) && identity.tableId === 'fixed-four'
    ? identity : null
}
export function identityScope(): string {
  const user = getCachedUser()
  const identity = getTableIdentity()
  return user?.openid && identity ? `match_table_v2:${user.openid}:${identity.bindingId}` : ''
}
export function cacheUser(user: UserInfo) {
  const before = identityScope()
  Taro.setStorageSync('user_info', JSON.stringify(user))
  const after = identityScope()
  if (before !== after) {
    if (before) for (const suffix of ['', ':badges']) Taro.removeStorageSync(`${before}${suffix}`)
    Taro.eventCenter?.trigger(IDENTITY_CHANGED)
  }
}
export function clearTableIdentity(expectedScope: string) {
  if (identityScope() !== expectedScope) return
  const user = getCachedUser()
  if (user) cacheUser({ ...user, identity: null })
}
export async function tableIdentityAction(action: 'status' | 'claim' | 'release', playerName?: PlayerName): Promise<TableStatus> {
  const user = getCachedUser()
  const beforeScope = identityScope()
  if (!user?.openid) throw new Error('请先微信登录')
  const result = (await Taro.cloud.callFunction({ name: 'matchTable', data: { action, playerName, schemaVersion: 2 } }))?.result as any
  if (!result?.ok) throw new Error(result?.msg || '暂时无法连接牌桌，请稍后重试')
  if (getCachedUser()?.openid !== user.openid) throw new Error('登录账号已变化，请重新打开')
  if (action === 'status' && identityScope() !== beforeScope) return { ...result, identity: getTableIdentity() }
  cacheUser({ ...getCachedUser()!, identity: result.identity })
  return result
}
