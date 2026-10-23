import Taro from '@tarojs/taro'
import { updateMatchBadges } from './match-badge-service'
import { clearTableIdentity, getTableIdentity, identityScope } from './table-identity-service'
import {
  compareMatchesByTime, deriveMatchResult, fixedMatchRecords, FIXED_MATCH_PLAYERS,
  getSelfDelta, makeMatchId, normalizeMatchPlayers, type MatchRecord,
} from './match-types'

interface Pending {
  kind: 'save' | 'remove'
  revision: number
  mutationId: string
  base?: MatchRecord
}
export interface MatchConflict { id: string; message: string; draft?: MatchRecord }
interface Cache { records: MatchRecord[]; pending: Record<string, Pending>; conflicts: MatchConflict[] }
export const MATCHES_CHANGED = 'table-matches-changed'
const flights = new Map<string, Promise<number>>()
const requested = new Set<string>()
const empty = (): Cache => ({ records: [], pending: {}, conflicts: [] })
function read(scope = identityScope()): Cache {
  if (!scope) return empty()
  const raw = Taro.getStorageSync(scope)
  if (raw?.records && raw.pending && Array.isArray(raw.conflicts)) return raw
  const cache = empty()
  // 旧版待上传数据只作为草稿待核对，绝不拿旧缓存覆盖共享牌局。
  if (getTableIdentity()?.role === 'admin') {
    const oldRecords = Taro.getStorageSync('match_records')
    const oldPending = Taro.getStorageSync('match_pending_saves')
    if (Array.isArray(oldRecords) && Array.isArray(oldPending)) {
      cache.conflicts = oldRecords.filter((r) => oldPending.includes(r.id)).map((draft) => ({
        id: draft.id, draft, message: '旧版离线草稿，请先核对云端牌局再重新编辑',
      }))
    }
    const oldDeletes = Taro.getStorageSync('match_pending_deletes')
    if (Array.isArray(oldDeletes)) oldDeletes.forEach((id) => cache.conflicts.push({ id, message: '旧版离线删除，请核对后重新删除' }))
  }
  Taro.setStorageSync(scope, cache)
  return cache
}
function write(cache: Cache, scope = identityScope()) {
  if (!scope || identityScope() !== scope) return
  cache.records.sort(compareMatchesByTime)
  Taro.setStorageSync(scope, cache)
  Taro.eventCenter?.trigger(MATCHES_CHANGED)
}
function requireIdentity() {
  const identity = getTableIdentity()
  if (!identity) throw new Error('请先认领自己的身份')
  return identity
}
export function listMatches(): MatchRecord[] {
  const identity = getTableIdentity()
  return identity ? fixedMatchRecords(read().records, identity.playerName).sort(compareMatchesByTime) : []
}
export function getMatch(id: string): MatchRecord | undefined { return listMatches().find((r) => r.id === id) }
export function listRecentPlayerNames(limit = 12): string[] {
  return FIXED_MATCH_PLAYERS.filter((name) => name !== getTableIdentity()?.playerName).slice(0, limit)
}
export function listRecentLocations(limit = 8): string[] {
  return [...new Set(listMatches().slice().reverse().map((r) => r.location?.trim()).filter((v): v is string => !!v))].slice(0, limit)
}
export function getMatchSyncState(): { pending: number; conflicts: MatchConflict[] } {
  const cache = read()
  return { pending: Object.keys(cache.pending).length, conflicts: cache.conflicts }
}
export function getMatchConflict(id: string) { return read().conflicts.find((item) => item.id === id) }
export function discardMatchConflict(id: string) {
  const cache = read()
  cache.conflicts = cache.conflicts.filter((item) => item.id !== id)
  write(cache)
}
function refreshBadges() {
  const identity = getTableIdentity()
  if (identity) updateMatchBadges(listMatches(), false, identity.playerName)
}
function requestSync() {
  requested.add(identityScope())
  void syncCloudMatchesToLocal()
}
export function upsertMatch(input: Omit<MatchRecord, 'id' | 'createdAt' | 'updatedAt' | 'result'> & {
  id?: string; result?: MatchRecord['result']; createdAt?: number
}): MatchRecord {
  const identity = requireIdentity()
  if (input.settleUnit !== 'score' || !Number.isFinite(input.playedAt) || input.playedAt <= 0) throw new Error('请输入有效的积分牌局时间')
  const players = normalizeMatchPlayers(input.players, identity.playerName)
  if (!players || players.some((p) => !Number.isFinite(p.scoreDelta))
    || Math.abs(players.reduce((s, p) => s + p.scoreDelta!, 0)) > 1e-6) throw new Error('四人积分必须完整且合计为零')
  const cache = read()
  const existing = input.id ? getMatch(input.id) : undefined
  if (input.id && !existing) throw new Error('这场牌局已不存在，请返回刷新')
  if (existing && input.revision !== undefined && input.revision !== existing.revision) throw new Error('牌局已更新，请返回刷新后重新编辑')
  const now = Date.now(), id = input.id || makeMatchId()
  const record: MatchRecord = { ...input, id, players, settleUnit: 'score',
    location: input.location?.trim(), note: input.note?.trim(), result: 'draw',
    revision: existing?.revision || 0, createdAt: existing?.createdAt || now, updatedAt: now }
  record.result = deriveMatchResult(getSelfDelta(record))
  const previous = cache.pending[id]
  cache.pending[id] = { kind: 'save', revision: previous?.revision ?? record.revision ?? 0,
    mutationId: makeMatchId(), base: previous ? previous.base : existing }
  cache.records = [...cache.records.filter((r) => r.id !== id), record]
  cache.conflicts = cache.conflicts.filter((item) => item.id !== id)
  write(cache)
  refreshBadges()
  requestSync()
  return record
}
export function removeMatch(id: string, revision?: number) {
  requireIdentity()
  const cache = read(), existing = getMatch(id)
  if (!existing) throw new Error('这场牌局已不存在')
  if (revision !== undefined && revision !== existing.revision) throw new Error('牌局已更新，请返回刷新后重试')
  const previous = cache.pending[id]
  // 未发出的本地新建可以直接放弃；请求中的新建必须等回执后再删除。
  if (previous?.kind === 'save' && previous.revision === 0 && !flights.has(identityScope())) delete cache.pending[id]
  else cache.pending[id] = { kind: 'remove', revision: previous?.revision ?? existing.revision ?? 0,
    mutationId: makeMatchId(), base: previous ? previous.base : existing }
  cache.records = cache.records.filter((r) => r.id !== id)
  cache.conflicts = cache.conflicts.filter((item) => item.id !== id)
  write(cache)
  refreshBadges()
  requestSync()
}

export function syncCloudMatchesToLocal(): Promise<number> {
  const scope = identityScope(), identity = getTableIdentity()
  if (!scope || !identity) return Promise.resolve(0)
  const flight = flights.get(scope)
  if (flight) return flight
  const call = async (data: Record<string, unknown>) => {
    const response = await Taro.cloud.callFunction({ name: 'matchTable', data: { ...data, schemaVersion: 2, bindingId: identity.bindingId } })
    if (identityScope() !== scope) return null
    const result = response?.result as any
    if (['UNBOUND', 'FORBIDDEN', 'UNAUTHORIZED'].includes(result?.code)) clearTableIdentity(scope)
    return identityScope() === scope ? result : null
  }
  const task = (async () => {
    let changed = 0
    try {
      do {
        requested.delete(scope)
        const initial = read(scope)
        for (const [id, pending] of Object.entries(initial.pending)) {
          if (identityScope() !== scope) return changed
          const current = read(scope)
          if (current.pending[id]?.mutationId !== pending.mutationId) continue
          const record = current.records.find((r) => r.id === id)
          const result = await call({ ...(pending.kind === 'save' ? record : { id }),
            action: pending.kind, revision: pending.revision, mutationId: pending.mutationId })
          if (!result) return changed
          if (!result.ok && !['CONFLICT', 'DELETED'].includes(result.code)) return changed
          const latest = read(scope), next = latest.pending[id]
          if (!result.ok) {
            const draft = latest.records.find((r) => r.id === id)
            latest.conflicts = [...latest.conflicts.filter((item) => item.id !== id), { id, draft, message: result.msg }]
            delete latest.pending[id]
            latest.records = latest.records.filter((r) => r.id !== id)
            if (pending.base && result.code !== 'DELETED') latest.records.push(pending.base)
          } else if (next?.mutationId === pending.mutationId) {
            delete latest.pending[id]
            latest.records = latest.records.map((r) => r.id === id ? { ...r, revision: result.revision } : r)
          } else if (next) {
            // 请求过程中继续编辑/删除：只前移已确认版本，不丢掉更新的草稿。
            next.revision = result.revision
            latest.records = latest.records.map((r) => r.id === id ? { ...r, revision: result.revision } : r)
            requested.add(scope)
          }
          write(latest, scope)
        }
        const result = await call({ action: 'list' })
        if (!result?.ok || !Array.isArray(result.matches)) return changed
        const latest = read(scope)
        const firstLoad = !latest.records.length
        const removed = new Set<string>(result.deletedIds || [])
        const cloudRecords = fixedMatchRecords(result.matches, identity.playerName)
        const merged = new Map<string, MatchRecord>(cloudRecords.map((r) => [r.id, r]))
        for (const [id, pending] of Object.entries(latest.pending)) {
          const draft = latest.records.find((r) => r.id === id)
          if (removed.has(id)) {
            latest.conflicts = [...latest.conflicts.filter((item) => item.id !== id), { id, draft, message: '这场牌局已经被删除' }]
            delete latest.pending[id]
            continue
          }
          if (pending.kind === 'remove') merged.delete(id)
          else if (draft) merged.set(id, draft)
        }
        latest.records = [...merged.values()]
        write(latest, scope)
        updateMatchBadges(listMatches(), firstLoad, identity.playerName)
        changed += cloudRecords.length
      } while (requested.has(scope) && identityScope() === scope)
    } catch { /* 离线保留缓存及明确的保存队列，下次前台或手动刷新重试。 */ }
    return changed
  })().finally(() => { flights.delete(scope) })
  flights.set(scope, task)
  return task
}
export function pushLocalMatchesToCloud() { requestSync() }
