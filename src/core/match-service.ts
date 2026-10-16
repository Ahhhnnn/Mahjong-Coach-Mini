import Taro from '@tarojs/taro'
import { createDefaultMatches, DEFAULT_MATCH_VERSION } from './default-matches'
import { updateMatchBadges } from './match-badge-service'
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
const DEFAULT_VERSION_KEY = 'match_default_version'
const DELETED_KEY = 'match_deleted_ids'
let cloudSync: Promise<number> | undefined

function deletedIds(): string[] {
  try {
    const ids = Taro.getStorageSync(DELETED_KEY)
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
  } catch { return [] }
}
let initializing = false

/** 必须先于读取、上传和云端合并；稳定 ID 保留用户已修改的版本。 */
export function ensureDefaultMatches() {
  if (initializing) return
  initializing = true
  try {
    if (Taro.getStorageSync(DEFAULT_VERSION_KEY) === DEFAULT_MATCH_VERSION) return
    const local = readLocal()
    const ids = new Set(local.map((r) => r.id))
    const additions = createDefaultMatches().filter((r) => !ids.has(r.id))
    const merged = [...local, ...additions].sort((a, b) => b.playedAt - a.playedAt).slice(0, MAX_LOCAL)
    Taro.setStorageSync(STORAGE_KEY, merged)
    // 默认历史荣誉记为已展示，避免首次进入连续庆祝。
    updateMatchBadges(merged, true)
    Taro.setStorageSync(DEFAULT_VERSION_KEY, DEFAULT_MATCH_VERSION)
    merged.forEach((record) => {
      record.players.forEach((player) => { if (!player.isSelf) rememberName(player.name) })
      rememberLocation(record.location)
    })
  } catch { /* 下次读取重试，不标记失败的初始化 */ } finally {
    initializing = false
  }
}

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
  ensureDefaultMatches()
  return readLocal().sort((a, b) => b.playedAt - a.playedAt)
}

export function getMatch(id: string): MatchRecord | undefined {
  ensureDefaultMatches()
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
  ensureDefaultMatches()
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

  const removed = deletedIds()
  if (removed.includes(id)) Taro.setStorageSync(DELETED_KEY, removed.filter((item) => item !== id))
  const list = readLocal().filter((r) => r.id !== id)
  list.unshift(record)
  writeLocal(list)
  updateMatchBadges(list)

  setPreferUnit(record.settleUnit)
  record.players.forEach((p) => {
    if (!p.isSelf) rememberName(p.name)
  })
  rememberLocation(record.location)

  if (isUserLoggedIn()) syncSaveToCloud(record)
  return record
}

export function removeMatch(id: string) {
  ensureDefaultMatches()
  Taro.setStorageSync(DELETED_KEY, Array.from(new Set([...deletedIds(), id])))
  const remaining = readLocal().filter((r) => r.id !== id)
  writeLocal(remaining)
  updateMatchBadges(remaining)
  if (isUserLoggedIn()) syncRemoveToCloud(id)
}

function mergeMatches(local: MatchRecord[], cloud: MatchRecord[]): MatchRecord[] {
  const map = new Map<string, MatchRecord>()
  const removed = new Set(deletedIds())
  for (const r of cloud) {
    if (r?.id && !removed.has(r.id)) map.set(r.id, r)
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

/** 合并后再上传，避免默认种子覆盖云端已经编辑过的历史牌局。 */
export function syncCloudMatchesToLocal(): Promise<number> {
  ensureDefaultMatches()
  if (!isUserLoggedIn()) return Promise.resolve(0)
  if (cloudSync) return cloudSync
  cloudSync = (async () => {
    try {
      const res = await (Taro as any).cloud.callFunction({ name: 'getMatches', data: {} })
      if (!res?.result?.ok || !Array.isArray(res.result.matches)) return 0
      const cloud: MatchRecord[] = res.result.matches
      // 请求期间可能发生编辑或删除，这里读取最新本地状态。
      const local = readLocal()
      const merged = mergeMatches(local, cloud)
      writeLocal(merged)
      updateMatchBadges(merged)
      const changed = merged.filter((r) => {
        const previous = local.find((item) => item.id === r.id)
        return !previous || JSON.stringify(previous) !== JSON.stringify(r)
      }).length
      deletedIds().forEach(syncRemoveToCloud)
      // 上传不存在或本地更新的记录；请求失败时等待下一次打开重试。
      merged.slice(0, MAX_LOCAL).forEach((record) => {
        const remote = cloud.find((item) => item.id === record.id)
        if (!remote || record.updatedAt > remote.updatedAt) syncSaveToCloud(record)
      })
      return changed
    } catch {
      return 0
    }
  })().finally(() => { cloudSync = undefined })
  return cloudSync
}

export function pushLocalMatchesToCloud() {
  // 与拉取共享同一个进行中的请求，先合并再推送。
  void syncCloudMatchesToLocal()
}
