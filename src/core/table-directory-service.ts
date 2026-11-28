import Taro from '@tarojs/taro'
import { cacheUser, getCachedUser, getTableIdentity } from './table-identity-service'
import {
  FIXED_MATCH_PLAYERS, FIXED_PLAYER_GENDERS, resolveSeatGender,
  type PlayerName, type SeatGender, type TablePlayContext,
} from './match-types'

export interface TablePlayerSummary {
  name: string
  claimed: boolean
  gender?: SeatGender
}

export interface TableSummary {
  id: string
  name: string
  seats: string[]
  mySeat: string
  role: 'admin' | 'member'
  bindingId: string
  inviteCode?: string
  players: TablePlayerSummary[]
}

export interface TablePreview {
  id: string
  name: string
  inviteCode: string
  players: TablePlayerSummary[]
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

export const DEFAULT_FIXED_TABLE_NAME = '四个敌人'

function normalizeTableSummary(table: TableSummary): TableSummary {
  const isFixed = table.id === 'fixed-four'
  const selfProfileGender = getCachedUser()?.gender
  const existingMap = new Map((table.players || []).map((player) => [player.name, player]))
  const players: TablePlayerSummary[] = table.seats.map((name) => {
    const existing = existingMap.get(name)
    return {
      name,
      claimed: !!existing?.claimed,
      gender: resolveSeatGender({
        name,
        isSelf: name === table.mySeat,
        selfProfileGender,
        seatGender: existing?.gender,
        isFixedTable: isFixed,
      }),
    }
  })
  return {
    ...table,
    name: isFixed ? DEFAULT_FIXED_TABLE_NAME : table.name,
    players,
  }
}

/** 云端桌子名单还没回来时，已认领的默认牌桌也要先显示出来。 */
export function listVisibleTables(): TableSummary[] {
  const cached = listCachedTables().map(normalizeTableSummary)
  const identity = getTableIdentity()
  const tables = identity && !cached.some((table) => table.id === 'fixed-four')
    ? [normalizeTableSummary({
      id: 'fixed-four', name: DEFAULT_FIXED_TABLE_NAME, seats: [...FIXED_MATCH_PLAYERS], mySeat: identity.playerName,
      role: identity.role, bindingId: identity.bindingId,
      players: FIXED_MATCH_PLAYERS.map((name) => ({
        name,
        claimed: name === identity.playerName,
        gender: FIXED_PLAYER_GENDERS[name],
      })),
    }), ...cached]
    : cached
  return [...tables].sort((a, b) => Number(b.id === 'fixed-four') - Number(a.id === 'fixed-four'))
}

export function findVisibleTable(id: string): TableSummary | undefined {
  return listVisibleTables().find((table) => table.id === id)
}

export async function seedPersonalScores() {
  if (!getCachedUser()?.openid) return
  await call('seedSolo')
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

export async function createTable(input: {
  name: string
  seats: string[]
  mySeat: string
  seatGenders?: Record<string, SeatGender>
}): Promise<TableSummary> {
  const result = await call('createTable', input)
  const tables = listCachedTables().filter((table) => table.id !== result.table.id)
  store([...tables, result.table])
  return result.table
}

export async function updateTableSeatGenders(tableId: string, seatGenders: Record<string, SeatGender>): Promise<TableSummary> {
  const result = await call('updateSeatGenders', { tableId, seatGenders })
  store(listCachedTables().map((table) => table.id === result.table.id ? result.table : table))
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
