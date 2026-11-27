import Taro from '@tarojs/taro'
import { cacheUser, getCachedUser } from './table-identity-service'
import { FIXED_MATCH_PLAYERS, type PlayerName, type TablePlayContext } from './match-types'

export interface TableSummary {
  id: string
  name: string
  seats: string[]
  mySeat: string
  role: 'admin' | 'member'
  bindingId: string
  inviteCode?: string
  players: { name: string; claimed: boolean }[]
}

export interface TablePreview {
  id: string
  name: string
  inviteCode: string
  players: { name: string; claimed: boolean }[]
}

export const TABLES_CHANGED = 'table-directory-changed'
const cacheKey = () => {
  const openid = getCachedUser()?.openid
  return openid ? `table_directory_v1:${openid}` : ''
}

export function listCachedTables(): TableSummary[] {
  const key = cacheKey()
  if (!key) return []
  const raw = Taro.getStorageSync(key)
  return Array.isArray(raw) ? raw : []
}

function store(tables: TableSummary[]) {
  const key = cacheKey()
  if (!key) return
  Taro.setStorageSync(key, tables)
  const fixed = tables.find((table) => table.id === 'fixed-four')
  const user = getCachedUser()
  if (user && fixed && FIXED_MATCH_PLAYERS.includes(fixed.mySeat as PlayerName) && user.identity?.bindingId !== fixed.bindingId) {
    cacheUser({ ...user, identity: { playerName: fixed.mySeat as PlayerName, bindingId: fixed.bindingId, tableId: 'fixed-four', role: fixed.role } })
  }
  Taro.eventCenter?.trigger(TABLES_CHANGED)
}

export function forgetCachedTable(tableId: string) {
  store(listCachedTables().filter((table) => table.id !== tableId))
}

export function tableContext(table: TableSummary): TablePlayContext {
  return { tableId: table.id, playerName: table.mySeat, bindingId: table.bindingId, seats: table.seats, role: table.role }
}

async function call(action: string, data: Record<string, unknown> = {}) {
  const response = await Taro.cloud.callFunction({ name: 'matchTable', data: { ...data, action, schemaVersion: 2 } })
  const result = response?.result as any
  if (!result?.ok) throw new Error(result?.msg || '暂时无法连接牌桌，请稍后重试')
  return result
}

export async function listMyTables(): Promise<TableSummary[]> {
  if (!getCachedUser()?.openid) throw new Error('请先微信登录')
  const result = await call('listTables')
  const tables = Array.isArray(result.tables) ? result.tables : []
  store(tables)
  return tables
}

export async function createTable(input: { name: string; seats: string[]; mySeat: string }): Promise<TableSummary> {
  const result = await call('createTable', input)
  const tables = listCachedTables().filter((table) => table.id !== result.table.id)
  store([...tables, result.table])
  return result.table
}

export async function previewTable(inviteCode: string): Promise<TablePreview> {
  const result = await call('previewTable', { inviteCode })
  return result.table
}

export async function claimSeat(tableId: string, playerName: string): Promise<TableSummary> {
  const result = await call('claimSeat', { tableId, playerName })
  const tables = listCachedTables().filter((table) => table.id !== result.table.id)
  store([...tables, result.table])
  return result.table
}

export async function releaseSeat(tableId: string, playerName: string): Promise<TableSummary> {
  const result = await call('releaseSeat', { tableId, playerName })
  store(listCachedTables().map((table) => table.id === result.table.id ? result.table : table))
  return result.table
}

export async function dissolveTable(tableId: string) {
  await call('dissolveTable', { tableId })
  forgetCachedTable(tableId)
}
