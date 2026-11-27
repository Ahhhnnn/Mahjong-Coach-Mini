import Taro from '@tarojs/taro'
import { updateMatchBadges } from './match-badge-service'
import { clearTableIdentity, getCachedUser, getTableIdentity, identityScope } from './table-identity-service'
import { forgetCachedTable } from './table-directory-service'
import {
  compareMatchesByTime, deriveMatchResult, fixedMatchRecords, FIXED_MATCH_PLAYERS,
  getSelfDelta, makeMatchId, normalizeMatchPlayers, seatMatchRecords, type MatchRecord, type TablePlayContext,
} from './match-types'

interface Pending {
  kind: 'save' | 'remove'
  revision: number
  mutationId: string
  base?: MatchRecord
}
export interface MatchConflict { id: string; message: string; draft?: MatchRecord }
interface Cache { records: MatchRecord[]; pending: Record<string, Pending>; conflicts: MatchConflict[] }
interface Source {
  scope: string
  playerName: string
  bindingId: string
  seats: readonly string[]
  tableId: string
  role: 'admin' | 'member'
  legacy: boolean
}
export const MATCHES_CHANGED = 'table-matches-changed'
const flights = new Map<string, Promise<number>>()
const requested = new Set<string>()
const empty = (): Cache => ({ records: [], pending: {}, conflicts: [] })

function resolve(ctx?: TablePlayContext): Source | null {
  if (ctx && ctx.tableId !== 'fixed-four') {
    const openid = getCachedUser()?.openid
    if (!openid || !ctx.bindingId || !ctx.playerName || ctx.seats?.length !== 4) return null
    return {
      scope: `match_table_v3:${openid}:${ctx.tableId}:${ctx.bindingId}`,
      playerName: ctx.playerName, bindingId: ctx.bindingId, seats: ctx.seats,
      tableId: ctx.tableId, role: ctx.role, legacy: false,
    }
  }
  const identity = getTableIdentity()
  if (!identity) return null
  return {
    scope: identityScope(), playerName: identity.playerName, bindingId: identity.bindingId,
    seats: FIXED_MATCH_PLAYERS, tableId: 'fixed-four', role: identity.role, legacy: true,
  }
}

function liveScope(source: Source): string {
  if (!source.legacy) {
    const openid = getCachedUser()?.openid
    return openid ? `match_table_v3:${openid}:${source.tableId}:${source.bindingId}` : ''
  }
  return identityScope()
}

function contextOf(source: Source): TablePlayContext | undefined {
  return source.legacy ? undefined : {
    tableId: source.tableId, playerName: source.playerName, bindingId: source.bindingId,
    seats: [...source.seats], role: source.role,
  }
}

function read(source: Source): Cache {
  if (!source.scope) return empty()
  const raw = Taro.getStorageSync(source.scope)
  if (raw?.records && raw.pending && Array.isArray(raw.conflicts)) return raw
  const cache = empty()
  // 旧版待上传数据只作为草稿待核对，绝不拿旧缓存覆盖共享牌局。
  if (source.legacy && source.role === 'admin') {
    const oldRecords = Taro.getStorageSync('match_records')
    const oldPending = Taro.getStorageSync('match_pending_saves')
    if (Array.isArray(oldRecords) && Array.isArray(oldPending)) {
      cache.conflicts = oldRecords.filter((record) => oldPending.includes(record.id)).map((draft) => ({
        id: draft.id, draft, message: '旧版离线草稿，请先核对云端牌局再重新编辑',
      }))
    }
    const oldDeletes = Taro.getStorageSync('match_pending_deletes')
    if (Array.isArray(oldDeletes)) oldDeletes.forEach((id) => cache.conflicts.push({ id, message: '旧版离线删除，请核对后重新删除' }))
  }
  if (liveScope(source) === source.scope) Taro.setStorageSync(source.scope, cache)
  return cache
}
function write(cache: Cache, source: Source) {
  if (!source.scope || liveScope(source) !== source.scope) return
  cache.records.sort(compareMatchesByTime)
  Taro.setStorageSync(source.scope, cache)
  Taro.eventCenter?.trigger(MATCHES_CHANGED)
}
function requireSource(ctx?: TablePlayContext) {
  const source = resolve(ctx)
  if (!source) throw new Error(ctx && ctx.tableId !== 'fixed-four' ? '请先认领这张桌子的座位' : '请先认领自己的身份')
  return source
}
function accept(records: MatchRecord[], source: Source) {
  return source.legacy ? fixedMatchRecords(records, source.playerName) : seatMatchRecords(records, source.seats, source.playerName)
}
export function listMatches(ctx?: TablePlayContext): MatchRecord[] {
  const source = resolve(ctx)
  return source ? accept(read(source).records, source).sort(compareMatchesByTime) : []
}
/** 只读已有缓存。缓存还没建立时不创建空记录，避免冲掉旧草稿导入。 */
export function peekMatches(ctx?: TablePlayContext): { ready: boolean; records: MatchRecord[] } {
  const source = resolve(ctx)
  if (!source?.scope) return { ready: false, records: [] }
  const raw = Taro.getStorageSync(source.scope)
  if (!raw?.records || !raw.pending || !Array.isArray(raw.conflicts)) return { ready: false, records: [] }
  return { ready: true, records: accept(raw.records, source) }
}
export function getMatch(id: string, ctx?: TablePlayContext): MatchRecord | undefined {
  return listMatches(ctx).find((record) => record.id === id)
}
export function listRecentPlayerNames(limit = 12): string[] {
  return FIXED_MATCH_PLAYERS.filter((name) => name !== getTableIdentity()?.playerName).slice(0, limit)
}
export function listRecentLocations(limit = 8, ctx?: TablePlayContext): string[] {
  return [...new Set(listMatches(ctx).slice().reverse().map((record) => record.location?.trim()).filter((value): value is string => !!value))].slice(0, limit)
}
export function getMatchSyncState(ctx?: TablePlayContext): { pending: number; conflicts: MatchConflict[] } {
  const source = resolve(ctx)
  if (!source) return { pending: 0, conflicts: [] }
  const cache = read(source)
  return { pending: Object.keys(cache.pending).length, conflicts: cache.conflicts }
}
export function getMatchConflict(id: string, ctx?: TablePlayContext) {
  const source = resolve(ctx)
  return source ? read(source).conflicts.find((item) => item.id === id) : undefined
}
export function discardMatchConflict(id: string, ctx?: TablePlayContext) {
  const source = resolve(ctx)
  if (!source) return
  const cache = read(source)
  cache.conflicts = cache.conflicts.filter((item) => item.id !== id)
  write(cache, source)
}
function refreshBadges(source: Source) {
  updateMatchBadges(listMatches(contextOf(source)), false, source.playerName, source.legacy ? undefined : source.scope, source.legacy ? undefined : source.seats)
}
function requestSync(ctx?: TablePlayContext) {
  const source = resolve(ctx)
  if (!source) return
  requested.add(source.scope)
  void syncCloudMatchesToLocal(ctx)
}
export function upsertMatch(input: Omit<MatchRecord, 'id' | 'createdAt' | 'updatedAt' | 'result'> & {
  id?: string; result?: MatchRecord['result']; createdAt?: number
}, ctx?: TablePlayContext): MatchRecord {
  const source = requireSource(ctx)
  if (input.settleUnit !== 'score' || !Number.isFinite(input.playedAt) || input.playedAt <= 0) throw new Error('请输入有效的积分牌局时间')
  const normalized = source.legacy
    ? normalizeMatchPlayers(input.players, source.playerName)
    : seatMatchRecords([{ ...input, id: input.id || 'draft', result: 'draw', createdAt: 0, updatedAt: 0 }], source.seats, source.playerName)[0]?.players
  if (!normalized || normalized.some((player) => !Number.isFinite(player.scoreDelta))
    || Math.abs(normalized.reduce((sum, player) => sum + player.scoreDelta!, 0)) > 1e-6) throw new Error('四人积分必须完整且合计为零')
  const cache = read(source)
  const existing = input.id ? getMatch(input.id, ctx) : undefined
  if (input.id && !existing) throw new Error('这场牌局已不存在，请返回刷新')
  if (existing && input.revision !== undefined && input.revision !== existing.revision) throw new Error('牌局已更新，请返回刷新后重新编辑')
  const now = Date.now(), id = input.id || makeMatchId()
  const record: MatchRecord = {
    ...input, id, players: normalized, settleUnit: 'score', location: input.location?.trim(), note: input.note?.trim(),
    result: 'draw', revision: existing?.revision || 0, createdAt: existing?.createdAt || now, updatedAt: now,
  }
  record.result = deriveMatchResult(getSelfDelta(record))
  const previous = cache.pending[id]
  cache.pending[id] = {
    kind: 'save', revision: previous?.revision ?? record.revision ?? 0, mutationId: makeMatchId(),
    base: previous ? previous.base : existing,
  }
  cache.records = [...cache.records.filter((item) => item.id !== id), record]
  cache.conflicts = cache.conflicts.filter((item) => item.id !== id)
  write(cache, source)
  refreshBadges(source)
  requestSync(ctx)
  return record
}
export function removeMatch(id: string, revision?: number, ctx?: TablePlayContext) {
  const source = requireSource(ctx)
  const cache = read(source), existing = getMatch(id, ctx)
  if (!existing) throw new Error('这场牌局已不存在')
  if (revision !== undefined && revision !== existing.revision) throw new Error('牌局已更新，请返回刷新后重试')
  const previous = cache.pending[id]
  // 未发出的本地新建可以直接放弃；请求中的新建必须等回执后再删除。
  if (previous?.kind === 'save' && previous.revision === 0 && !flights.has(source.scope)) delete cache.pending[id]
  else cache.pending[id] = {
    kind: 'remove', revision: previous?.revision ?? existing.revision ?? 0, mutationId: makeMatchId(),
    base: previous ? previous.base : existing,
  }
  cache.records = cache.records.filter((item) => item.id !== id)
  cache.conflicts = cache.conflicts.filter((item) => item.id !== id)
  write(cache, source)
  refreshBadges(source)
  requestSync(ctx)
}

export function syncCloudMatchesToLocal(ctx?: TablePlayContext): Promise<number> {
  const source = resolve(ctx)
  if (!source) return Promise.resolve(0)
  const scope = source.scope
  const flight = flights.get(scope)
  if (flight) return flight
  const call = async (data: Record<string, unknown>) => {
    const response = await Taro.cloud.callFunction({
      name: 'matchTable',
      data: { ...data, schemaVersion: 2, bindingId: source.bindingId, tableId: source.tableId },
    })
    if (liveScope(source) !== scope) return null
    const result = response?.result as any
    if (['UNBOUND', 'FORBIDDEN', 'UNAUTHORIZED'].includes(result?.code)) {
      if (source.legacy) clearTableIdentity(scope)
      else forgetCachedTable(source.tableId)
    }
    return liveScope(source) === scope ? result : null
  }
  const task = (async () => {
    let changed = 0
    try {
      do {
        requested.delete(scope)
        const initial = read(source)
        for (const [id, pending] of Object.entries(initial.pending)) {
          if (liveScope(source) !== scope) return changed
          const current = read(source)
          if (current.pending[id]?.mutationId !== pending.mutationId) continue
          const record = current.records.find((item) => item.id === id)
          const result = await call({
            ...(pending.kind === 'save' ? record : { id }),
            action: pending.kind, revision: pending.revision, mutationId: pending.mutationId,
          })
          if (!result) return changed
          if (!result.ok && !['CONFLICT', 'DELETED'].includes(result.code)) return changed
          const latest = read(source), next = latest.pending[id]
          if (!result.ok) {
            const draft = latest.records.find((item) => item.id === id)
            latest.conflicts = [...latest.conflicts.filter((item) => item.id !== id), { id, draft, message: result.msg }]
            delete latest.pending[id]
            latest.records = latest.records.filter((item) => item.id !== id)
            if (pending.base && result.code !== 'DELETED') latest.records.push(pending.base)
          } else if (next?.mutationId === pending.mutationId) {
            delete latest.pending[id]
            latest.records = latest.records.map((item) => item.id === id ? { ...item, revision: result.revision } : item)
          } else if (next) {
            // 请求过程中继续编辑/删除：只前移已确认版本，不丢掉更新的草稿。
            next.revision = result.revision
            latest.records = latest.records.map((item) => item.id === id ? { ...item, revision: result.revision } : item)
            requested.add(scope)
          }
          write(latest, source)
        }
        const result = await call({ action: 'list' })
        if (!result?.ok || !Array.isArray(result.matches)) return changed
        const latest = read(source)
        const firstLoad = !latest.records.length
        const removed = new Set<string>(result.deletedIds || [])
        const cloudRecords = accept(result.matches, source)
        const merged = new Map<string, MatchRecord>(cloudRecords.map((item) => [item.id, item]))
        for (const [id, pending] of Object.entries(latest.pending)) {
          const draft = latest.records.find((item) => item.id === id)
          if (removed.has(id)) {
            latest.conflicts = [...latest.conflicts.filter((item) => item.id !== id), { id, draft, message: '这场牌局已经被删除' }]
            delete latest.pending[id]
            continue
          }
          if (pending.kind === 'remove') merged.delete(id)
          else if (draft) merged.set(id, draft)
        }
        latest.records = [...merged.values()]
        write(latest, source)
        updateMatchBadges(listMatches(contextOf(source)), firstLoad, source.playerName, source.legacy ? undefined : source.scope, source.legacy ? undefined : source.seats)
        changed += cloudRecords.length
      } while (requested.has(scope) && liveScope(source) === scope)
    } catch { /* 离线保留缓存及明确的保存队列，下次前台或手动刷新重试。 */ }
    return changed
  })().finally(() => { flights.delete(scope) })
  flights.set(scope, task)
  return task
}
export function pushLocalMatchesToCloud() { requestSync() }
