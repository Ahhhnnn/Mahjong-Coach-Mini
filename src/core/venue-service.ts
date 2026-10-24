import Taro from '@tarojs/taro'
import { clearTableIdentity, getTableIdentity, identityScope } from './table-identity-service'
import type { PlayerName } from './match-types'

export interface Venue { id: string; name: string; enabled: boolean }
export interface VenueConfig { venues: Venue[]; version: number }
export interface VenueDraw {
  date: string
  venue: Pick<Venue, 'id' | 'name'>
  candidates: Pick<Venue, 'id' | 'name'>[]
  configVersion: number
  drawnBy: PlayerName
  drawnAt: number
}
export interface VenueStatus {
  date: string
  today: string
  maxDate: string
  serverTime: number
  config: VenueConfig
  draw: VenueDraw | null
  dailyDraw: { date: string; targetDate: string; drawnBy: PlayerName; drawnAt: number } | null
  canDraw: boolean
  unavailableReason: string
}
export interface VenueHistory { items: VenueDraw[]; nextCursor: string | null }
export const VENUES_CHANGED = 'table-venues-changed'

async function request<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  const identity = getTableIdentity()
  const scope = identityScope()
  if (!identity || !scope) throw new Error('请先认领自己的身份')
  let result: any
  try {
    result = (await Taro.cloud.callFunction({ name: 'matchTable', data: { ...data, action, schemaVersion: 2, bindingId: identity.bindingId } }))?.result
  } catch { throw new Error('暂时无法连接牌桌，请联网后重试；已抽取的结果不会丢失') }
  if (identityScope() !== scope) throw new Error('身份已变化，请重新打开')
  if (!result?.ok) {
    if (result?.code === 'UNBOUND') clearTableIdentity(scope)
    throw new Error(result?.msg || '暂时无法连接牌桌，请稍后重试')
  }
  return result as T
}
export const fetchVenueStatus = (targetDate?: string) => request<VenueStatus>('venueStatus', targetDate ? { targetDate } : {})
export const fetchVenueHistory = (before?: string) => request<VenueHistory>('venueHistory', before ? { before } : {})
export async function drawVenue(targetDate?: string) {
  const result = await request<Pick<VenueStatus, 'date' | 'serverTime'> & { draw: VenueDraw }>('drawVenue', targetDate ? { targetDate } : {})
  Taro.eventCenter.trigger(VENUES_CHANGED)
  return result
}
export function formatVenueDrawTime(time: number) {
  return new Date(time + 8 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ')
}
export async function saveVenues(config: VenueConfig) {
  const result = await request<{ config: VenueConfig }>('saveVenues', { venues: config.venues, version: config.version })
  Taro.eventCenter.trigger(VENUES_CHANGED)
  return result.config
}
