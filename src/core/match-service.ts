import Taro from '@tarojs/taro'
import { updateMatchBadges } from './match-badge-service'
import {
  compareMatchesByTime,
  deriveMatchResult,
  fixedMatchRecords,
  FIXED_MATCH_PLAYERS,
  getSelfDelta,
  makeMatchId,
  normalizeMatchPlayers,
  SELF_PLAYER_NAME,
  type MatchRecord,
} from './match-types'

const STORAGE_KEY = 'match_records'
const PLAYER_NAMES_KEY = 'match_player_names'
const LOCATIONS_KEY = 'match_locations'
const DELETED_KEY = 'match_deleted_ids'
const PENDING_SAVES_KEY = 'match_pending_saves'
const PENDING_DELETES_KEY = 'match_pending_deletes'
const MANUAL_QUEUE_MIGRATED_KEY = 'match_manual_queue_migrated'
let cloudSync: Promise<number> | undefined
let syncRequested = false

function deletedIds(): string[] {
  return readIds(DELETED_KEY)
}

function readIds(key: string): string[] {
  try {
    const ids = Taro.getStorageSync(key)
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
  } catch { return [] }
}

function queueId(key: string, id: string) {
  Taro.setStorageSync(key, Array.from(new Set([...readIds(key), id])))
}

function unqueueId(key: string, id: string) {
  Taro.setStorageSync(key, readIds(key).filter((item) => item !== id))
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
    Taro.setStorageSync(STORAGE_KEY, items.slice().sort(compareMatchesByTime))
  } catch {
    /* ignore */
  }
}

function requestCloudSync() {
  syncRequested = true
  void syncCloudMatchesToLocal()
}

function migrateManualQueue() {
  if (Taro.getStorageSync(MANUAL_QUEUE_MIGRATED_KEY)) return
  const removed = new Set(deletedIds())
  // 升级前离线录入的 m_ 记录仍是页面操作；默认 board_ 历史绝不进入保存队列。
  fixedMatchRecords(readLocal()).forEach((record) => {
    if (record.id.startsWith('m_') && !removed.has(record.id)) queueId(PENDING_SAVES_KEY, record.id)
  })
  Taro.setStorageSync(MANUAL_QUEUE_MIGRATED_KEY, true)
}

export function listMatches(): MatchRecord[] {
  return fixedMatchRecords(readLocal()).sort(compareMatchesByTime)
}

export function getMatch(id: string): MatchRecord | undefined {
  return fixedMatchRecords(readLocal()).find((r) => r.id === id)
}

export function listRecentPlayerNames(limit = 12): string[] {
  try {
    const raw = Taro.getStorageSync(PLAYER_NAMES_KEY)
    if (!Array.isArray(raw)) return []
    return raw.filter((n: string) => FIXED_MATCH_PLAYERS.some((name) => name === n) && n !== SELF_PLAYER_NAME).slice(0, limit)
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
  if (n === SELF_PLAYER_NAME || !FIXED_MATCH_PLAYERS.some((name) => name === n)) return
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
  if (input.settleUnit !== 'score') throw new Error('仅支持积分牌局')
  const players = normalizeMatchPlayers(input.players)
  if (!players) throw new Error('牌局必须包含 HENING、WUYU、TANGXIANG、DUHAN 各一位')
  const now = Date.now()
  const existing = input.id ? getMatch(input.id) : undefined
  const id = input.id || makeMatchId()
  const result = input.result ?? deriveMatchResult(getSelfDelta({ ...input, id, result: 'draw', createdAt: now, updatedAt: now } as MatchRecord))

  const record: MatchRecord = {
    id,
    playedAt: input.playedAt || now,
    variant: input.variant || 'xuezhan',
    location: input.location?.trim() || undefined,
    settleUnit: 'score',
    result,
    players,
    performance: input.performance,
    reasons: input.reasons?.length ? input.reasons : undefined,
    note: input.note?.trim() || undefined,
    createdAt: existing?.createdAt || input.createdAt || now,
    updatedAt: Math.max(now, (existing?.updatedAt || 0) + 1),
  }

  // 用本人 delta 再推导一次，保证一致
  record.result = deriveMatchResult(getSelfDelta(record))

  const removed = deletedIds()
  if (removed.includes(id)) Taro.setStorageSync(DELETED_KEY, removed.filter((item) => item !== id))
  const list = readLocal().filter((r) => r.id !== id)
  list.unshift(record)
  writeLocal(list)
  queueId(PENDING_SAVES_KEY, id)
  unqueueId(PENDING_DELETES_KEY, id)
  updateMatchBadges(list)

  record.players.forEach((p) => {
    if (!p.isSelf) rememberName(p.name)
  })
  rememberLocation(record.location)

  if (isUserLoggedIn()) requestCloudSync()
  return record
}

export function removeMatch(id: string) {
  Taro.setStorageSync(DELETED_KEY, Array.from(new Set([...deletedIds(), id])))
  queueId(PENDING_DELETES_KEY, id)
  unqueueId(PENDING_SAVES_KEY, id)
  const remaining = readLocal().filter((r) => r.id !== id)
  writeLocal(remaining)
  updateMatchBadges(remaining)
  if (isUserLoggedIn()) requestCloudSync()
}

function mergeMatches(local: MatchRecord[], cloud: MatchRecord[]): MatchRecord[] {
  const map = new Map<string, MatchRecord>()
  const removed = new Set(deletedIds())
  for (const r of cloud) {
    if (r?.id && !removed.has(r.id)) map.set(r.id, r)
  }
  const pending = new Set(readIds(PENDING_SAVES_KEY))
  const visibleIds = new Set(fixedMatchRecords(local).map((record) => record.id))
  for (const r of local) {
    if (!r?.id || removed.has(r.id)) continue
    // 仅待上传的页面编辑覆盖云端；旧匿名数据保留，但不自动上传或展示。
    if (pending.has(r.id) || !visibleIds.has(r.id)) {
      map.set(r.id, r)
    }
  }
  return Array.from(map.values()).sort(compareMatchesByTime)
}

/** 仅同步页面录入的变更并拉取云端历史，绝不调用初始化函数或补入默认数据。 */
export function syncCloudMatchesToLocal(): Promise<number> {
  if (!isUserLoggedIn()) return Promise.resolve(0)
  if (cloudSync) return cloudSync
  cloudSync = (async () => {
    try {
      let changed = 0
      migrateManualQueue()
      do {
        syncRequested = false
        for (const id of readIds(PENDING_DELETES_KEY)) {
          const response = await (Taro as any).cloud.callFunction({ name: 'removeMatch', data: { id } })
          if (!response?.result?.ok) return changed
          unqueueId(PENDING_DELETES_KEY, id)
        }
        const pending = new Set(readIds(PENDING_SAVES_KEY))
        const saves = fixedMatchRecords(readLocal()).filter((record) => pending.has(record.id)).sort(compareMatchesByTime)
        for (const record of saves) {
          // 请求间隙发生的删除或编辑留给下一轮，不上传过时快照。
          const current = getMatch(record.id)
          if (deletedIds().includes(record.id) || JSON.stringify(current) !== JSON.stringify(record)) continue
          const response = await (Taro as any).cloud.callFunction({ name: 'saveMatch', data: record })
          if (!response?.result?.ok) return changed
          if (response.result.deleted) {
            queueId(DELETED_KEY, record.id)
            unqueueId(PENDING_SAVES_KEY, record.id)
            continue
          }
          if (JSON.stringify(getMatch(record.id)) === JSON.stringify(record)) {
            unqueueId(PENDING_SAVES_KEY, record.id)
          }
        }
        const res = await (Taro as any).cloud.callFunction({
          name: 'getMatches', data: {},
        })
        if (!res?.result?.ok || !Array.isArray(res.result.matches)) return changed
        const cloud: MatchRecord[] = res.result.matches
        const remoteDeleted: string[] = Array.isArray(res.result.deletedIds)
          ? res.result.deletedIds.filter((id: unknown): id is string => typeof id === 'string') : []
        Taro.setStorageSync(DELETED_KEY, Array.from(new Set([...deletedIds(), ...remoteDeleted])))
        // 请求期间可能发生编辑或删除，保留最新本地状态，并在下一轮继续同步。
        const local = readLocal()
        const merged = mergeMatches(local, cloud)
        writeLocal(merged)
        updateMatchBadges(merged, local.length === 0)
        merged.forEach((record) => {
          record.players.forEach((player) => { if (!player.isSelf) rememberName(player.name) })
          rememberLocation(record.location)
        })
        changed += merged.filter((r) => {
          const previous = local.find((item) => item.id === r.id)
          return !previous || JSON.stringify(previous) !== JSON.stringify(r)
        }).length
      } while (syncRequested)
      return changed
    } catch {
      return 0
    }
  })().finally(() => { cloudSync = undefined })
  return cloudSync
}

export function pushLocalMatchesToCloud() {
  // 只重试页面保存队列，与拉取共享同一个进行中的请求。
  void syncCloudMatchesToLocal()
}
