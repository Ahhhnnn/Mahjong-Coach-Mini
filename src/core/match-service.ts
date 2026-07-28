import Taro from '@tarojs/taro'
import {
  deriveMatchResult,
  getSelfDelta,
  makeMatchId,
  type MatchRecord,
  type SettleUnit,
} from './match-types'

const STORAGE_KEY = 'match_records'
const PREFER_UNIT_KEY = 'match_prefer_unit'
const PLAYER_NAMES_KEY = 'match_player_names'
const LOCATIONS_KEY = 'match_locations'
const MAX_LOCAL = 300

function isUserLoggedIn(): boolean {
  try {
    const raw = Taro.getStorageSync('user_info')
    if (!raw) return false
    const user = typeof raw === 'string' ? JSON.parse(raw) : raw
    return !!user?.openid
  } catch {
    return false
  }
}

function readLocal(): MatchRecord[] {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    if (!Array.isArray(raw)) return []
    return raw.filter((r: MatchRecord) => r && r.id && Array.isArray(r.players))
  } catch {
    return []
  }
}

function writeLocal(items: MatchRecord[]) {
  try {
    Taro.setStorageSync(STORAGE_KEY, items.slice(0, MAX_LOCAL))
  } catch {
    /* ignore */
  }
}

function syncSaveToCloud(record: MatchRecord) {
  try {
    ;(Taro as any).cloud
      ?.callFunction({ name: 'saveMatch', data: record })
      .catch(() => {})
  } catch {
    /* ignore */
  }
}

function syncRemoveToCloud(id: string) {
  try {
    ;(Taro as any).cloud
      ?.callFunction({ name: 'removeMatch', data: { id } })
      .catch(() => {})
  } catch {
    /* ignore */
  }
}

export function listMatches(): MatchRecord[] {
  return readLocal().sort((a, b) => b.playedAt - a.playedAt)
}

export function getMatch(id: string): MatchRecord | undefined {
  return readLocal().find((r) => r.id === id)
}

export function getPreferUnit(): SettleUnit {
  try {
    const v = Taro.getStorageSync(PREFER_UNIT_KEY)
    return v === 'money' ? 'money' : 'score'
  } catch {
    return 'score'
  }
}

export function setPreferUnit(unit: SettleUnit) {
  try {
    Taro.setStorageSync(PREFER_UNIT_KEY, unit)
  } catch {
    /* ignore */
  }
}

export function listRecentPlayerNames(limit = 12): string[] {
  try {
    const raw = Taro.getStorageSync(PLAYER_NAMES_KEY)
    if (!Array.isArray(raw)) return []
    return raw.filter((n: string) => typeof n === 'string' && n.trim()).slice(0, limit)
  } catch {
    return []
  }
}

export function listRecentLocations(limit = 8): string[] {
  try {
    const raw = Taro.getStorageSync(LOCATIONS_KEY)
    if (!Array.isArray(raw)) return []
    return raw.filter((n: string) => typeof n === 'string' && n.trim()).slice(0, limit)
  } catch {
    return []
  }
}

function rememberName(name: string) {
  const n = name.trim()
  if (!n || n === '我' || n === '我的') return
  const list = listRecentPlayerNames(40).filter((x) => x !== n)
  list.unshift(n)
  try {
    Taro.setStorageSync(PLAYER_NAMES_KEY, list.slice(0, 40))
  } catch {
    /* ignore */
  }
}

function rememberLocation(location?: string) {
  const n = (location || '').trim()
  if (!n) return
  const list = listRecentLocations(20).filter((x) => x !== n)
  list.unshift(n)
  try {
    Taro.setStorageSync(LOCATIONS_KEY, list.slice(0, 20))
  } catch {
    /* ignore */
  }
}

/** 规范化并补全 result / 时间戳后写入 */
export function upsertMatch(
  input: Omit<MatchRecord, 'id' | 'createdAt' | 'updatedAt' | 'result'> & {
    id?: string
    result?: MatchRecord['result']
    createdAt?: number
  }
): MatchRecord {
  const now = Date.now()
  const existing = input.id ? getMatch(input.id) : undefined
  const id = input.id || makeMatchId()
  const result = input.result ?? deriveMatchResult(getSelfDelta({ ...input, id, result: 'draw', createdAt: now, updatedAt: now } as MatchRecord))

  const record: MatchRecord = {
    id,
    playedAt: input.playedAt || now,
    variant: input.variant || 'xuezhan',
    location: input.location?.trim() || undefined,
    settleUnit: input.settleUnit || 'score',
    result,
    players: input.players.map((p, i) => {
      let name = (p.name || '').trim()
      if (p.isSelf) {
        name = name || '我'
      } else if (!name || name === '玩家') {
        // 避免多名「玩家」在排行榜里被合并成一人
        name = `玩家${i + 1}`
      }
      return { ...p, name }
    }),
    performance: input.performance,
    reasons: input.reasons?.length ? input.reasons : undefined,
    note: input.note?.trim() || undefined,
    createdAt: existing?.createdAt || input.createdAt || now,
    updatedAt: now,
  }

  // 用本人 delta 再推导一次，保证一致
  record.result = deriveMatchResult(getSelfDelta(record))

  const list = readLocal().filter((r) => r.id !== id)
  list.unshift(record)
  writeLocal(list)

  setPreferUnit(record.settleUnit)
  record.players.forEach((p) => {
    if (!p.isSelf) rememberName(p.name)
  })
  rememberLocation(record.location)

  if (isUserLoggedIn()) syncSaveToCloud(record)
  return record
}

export function removeMatch(id: string) {
  writeLocal(readLocal().filter((r) => r.id !== id))
  if (isUserLoggedIn()) syncRemoveToCloud(id)
}

function mergeMatches(local: MatchRecord[], cloud: MatchRecord[]): MatchRecord[] {
  const map = new Map<string, MatchRecord>()
  for (const r of cloud) {
    if (r?.id) map.set(r.id, r)
  }
  for (const r of local) {
    if (!r?.id) continue
    const exist = map.get(r.id)
    if (!exist || (r.updatedAt || 0) >= (exist.updatedAt || 0)) {
      map.set(r.id, r)
    }
  }
  return Array.from(map.values()).sort((a, b) => b.playedAt - a.playedAt)
}

export async function syncCloudMatchesToLocal(): Promise<number> {
  try {
    const res = await (Taro as any).cloud.callFunction({ name: 'getMatches', data: {} })
    const cloud: MatchRecord[] = res?.result?.matches || []
    if (!Array.isArray(cloud)) return 0
    const local = readLocal()
    const merged = mergeMatches(local, cloud)
    writeLocal(merged)
    return Math.max(0, merged.length - local.length)
  } catch {
    return 0
  }
}

export function pushLocalMatchesToCloud() {
  try {
    listMatches()
      .slice(0, 100)
      .forEach((r) => syncSaveToCloud(r))
  } catch {
    /* ignore */
  }
}
