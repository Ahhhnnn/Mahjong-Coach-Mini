import Taro from '@tarojs/taro'
import { updateSoloBadges } from './solo-badge-service'
import { soloRecordsFromTables } from './solo-from-table'
import { getCachedUser } from './table-identity-service'
import {
  deriveMatchResult, isSoloSeat, makeMatchId, parseTableSoloId, type MatchPerformance, type MatchReason, type SoloMatchRecord, type SoloSeat,
} from './match-types'

interface Pending { kind: 'save' | 'remove'; revision: number; mutationId: string; base?: SoloMatchRecord }
export interface SoloConflict { id: string; message: string; draft?: SoloMatchRecord }
interface Cache { records: SoloMatchRecord[]; pending: Record<string, Pending>; conflicts: SoloConflict[] }

export const SOLO_CHANGED = 'solo-matches-changed'
const flights = new Map<string, Promise<number>>()
const requested = new Set<string>()
const empty = (): Cache => ({ records: [], pending: {}, conflicts: [] })

export function soloScope(openid = getCachedUser()?.openid || ''): string {
  return openid ? `solo_matches_v1:${openid}` : ''
}

function read(scope = soloScope()): Cache {
  if (!scope) return empty()
  const raw = Taro.getStorageSync(scope)
  if (raw?.records && raw.pending && Array.isArray(raw.conflicts)) return raw
  const cache = empty()
  if (soloScope() === scope) Taro.setStorageSync(scope, cache)
  return cache
}

function write(cache: Cache, scope = soloScope()) {
  if (!scope || soloScope() !== scope) return
  cache.records.sort((a, b) => a.playedAt - b.playedAt || a.id.localeCompare(b.id))
  Taro.setStorageSync(scope, cache)
  Taro.eventCenter?.trigger(SOLO_CHANGED)
}

function accept(record: SoloMatchRecord & { source?: string }): SoloMatchRecord | undefined {
  if (!record || record.settleUnit !== 'score' || !Number.isFinite(record.playedAt) || record.playedAt <= 0) return undefined
  if (!Number.isFinite(record.scoreDelta)) return undefined
  const seat = isSoloSeat(record.seat) ? record.seat : undefined
  const origin = record.origin === 'table' || record.source === 'table' ? 'table' as const : undefined
  const sourceTableId = typeof record.sourceTableId === 'string' && record.sourceTableId ? record.sourceTableId : undefined
  return { ...record, seat, result: deriveMatchResult(record.scoreDelta), settleUnit: 'score', variant: record.variant || 'xuezhan', origin, sourceTableId }
}

export function listSoloMatches(): SoloMatchRecord[] {
  const stored = read().records.flatMap((record) => {
    const next = accept(record)
    return next ? [next] : []
  })
  return soloRecordsFromTables(stored).sort((a, b) => a.playedAt - b.playedAt || a.id.localeCompare(b.id))
}

export function getSoloMatch(id: string): SoloMatchRecord | undefined {
  return listSoloMatches().find((record) => record.id === id)
}

export function listSoloLocations(limit = 8): string[] {
  return [...new Set(listSoloMatches().slice().reverse().map((record) => record.location?.trim()).filter((value): value is string => !!value))].slice(0, limit)
}

export function getSoloSyncState(): { pending: number; conflicts: SoloConflict[] } {
  const cache = read()
  return { pending: Object.keys(cache.pending).length, conflicts: cache.conflicts }
}

export function getSoloConflict(id: string) { return read().conflicts.find((item) => item.id === id) }

export function discardSoloConflict(id: string) {
  const cache = read()
  cache.conflicts = cache.conflicts.filter((item) => item.id !== id)
  write(cache)
}

function refreshBadges() { updateSoloBadges(listSoloMatches(), false) }

function requestSync() {
  const scope = soloScope()
  if (!scope) return
  requested.add(scope)
  void syncCloudSoloToLocal()
}

function rejectMirrored(id?: string) {
  if (id && parseTableSoloId(id)) throw new Error('这场分数来自四人牌局，请到对应桌子里修改')
}

export function upsertSoloMatch(input: {
  id?: string
  playedAt: number
  scoreDelta: number
  location?: string
  seat?: SoloSeat
  note?: string
  performance?: MatchPerformance
  reasons?: MatchReason[]
  revision?: number
  createdAt?: number
}): SoloMatchRecord {
  if (!soloScope()) throw new Error('请先微信登录')
  rejectMirrored(input.id)
  if (!Number.isFinite(input.playedAt) || input.playedAt <= 0 || !Number.isFinite(input.scoreDelta)) throw new Error('请输入有效的时间和分数')
  const cache = read()
  const existing = input.id ? getSoloMatch(input.id) : undefined
  if (input.id && !existing) throw new Error('这场记录已不存在，请返回刷新')
  if (existing && input.revision !== undefined && input.revision !== existing.revision) throw new Error('记录已更新，请返回刷新后重新编辑')
  const now = Date.now()
  const id = input.id || makeMatchId()
  const record: SoloMatchRecord = {
    id, playedAt: input.playedAt, variant: 'xuezhan', settleUnit: 'score', scoreDelta: input.scoreDelta,
    result: deriveMatchResult(input.scoreDelta), location: input.location?.trim(),
    seat: isSoloSeat(input.seat) ? input.seat : undefined, note: input.note?.trim(),
    performance: input.performance, reasons: input.reasons, revision: existing?.revision || 0,
    createdAt: existing?.createdAt || input.createdAt || now, updatedAt: now,
  }
  const previous = cache.pending[id]
  cache.pending[id] = {
    kind: 'save', revision: previous?.revision ?? record.revision ?? 0, mutationId: makeMatchId(),
    base: previous ? previous.base : existing,
  }
  cache.records = [...cache.records.filter((item) => item.id !== id), record]
  cache.conflicts = cache.conflicts.filter((item) => item.id !== id)
  write(cache)
  refreshBadges()
  requestSync()
  return record
}

export function removeSoloMatch(id: string, revision?: number) {
  if (!soloScope()) throw new Error('请先微信登录')
  rejectMirrored(id)
  const cache = read()
  const existing = getSoloMatch(id)
  if (!existing) throw new Error('这场记录已不存在')
  if (revision !== undefined && revision !== existing.revision) throw new Error('记录已更新，请返回刷新后重试')
  const previous = cache.pending[id]
  const scope = soloScope()
  if (previous?.kind === 'save' && previous.revision === 0 && !flights.has(scope)) delete cache.pending[id]
  else cache.pending[id] = {
    kind: 'remove', revision: previous?.revision ?? existing.revision ?? 0, mutationId: makeMatchId(),
    base: previous ? previous.base : existing,
  }
  cache.records = cache.records.filter((item) => item.id !== id)
  cache.conflicts = cache.conflicts.filter((item) => item.id !== id)
  write(cache)
  refreshBadges()
  requestSync()
}

export function syncCloudSoloToLocal(): Promise<number> {
  const scope = soloScope()
  const openid = getCachedUser()?.openid
  if (!scope || !openid) return Promise.resolve(0)
  const flight = flights.get(scope)
  if (flight) return flight
  const call = async (data: Record<string, unknown>) => {
    const response = await Taro.cloud.callFunction({ name: 'soloMatch', data })
    if (soloScope() !== scope) return null
    return response?.result as any
  }
  const task = (async () => {
    let changed = 0
    try {
      do {
        requested.delete(scope)
        const initial = read(scope)
        for (const [id, pending] of Object.entries(initial.pending)) {
          if (soloScope() !== scope) return changed
          const current = read(scope)
          if (current.pending[id]?.mutationId !== pending.mutationId) continue
          const record = current.records.find((item) => item.id === id)
          const result = await call({
            ...(pending.kind === 'save' ? record : { id }),
            action: pending.kind, revision: pending.revision, mutationId: pending.mutationId,
          })
          if (!result) return changed
          if (!result.ok && !['CONFLICT', 'DELETED'].includes(result.code)) return changed
          const latest = read(scope)
          const next = latest.pending[id]
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
            next.revision = result.revision
            latest.records = latest.records.map((item) => item.id === id ? { ...item, revision: result.revision } : item)
            requested.add(scope)
          }
          write(latest, scope)
        }
        const result = await call({ action: 'list' })
        if (!result?.ok || !Array.isArray(result.matches)) return changed
        const latest = read(scope)
        const firstLoad = !latest.records.length
        const removed = new Set<string>(result.deletedIds || [])
        const cloudRecords = result.matches.flatMap((item: SoloMatchRecord) => {
          const next = accept(item)
          return next ? [next] : []
        })
        const merged = new Map<string, SoloMatchRecord>(cloudRecords.map((item: SoloMatchRecord) => [item.id, item]))
        for (const [id, pending] of Object.entries(latest.pending)) {
          const draft = latest.records.find((item) => item.id === id)
          if (removed.has(id)) {
            latest.conflicts = [...latest.conflicts.filter((item) => item.id !== id), { id, draft, message: '这场记录已经被删除' }]
            delete latest.pending[id]
            continue
          }
          if (pending.kind === 'remove') merged.delete(id)
          else if (draft) merged.set(id, draft)
        }
        latest.records = [...merged.values()]
        write(latest, scope)
        updateSoloBadges(listSoloMatches(), firstLoad)
        changed += cloudRecords.length
      } while (requested.has(scope) && soloScope() === scope)
    } catch { /* 离线保留本地队列，下次登录或打开页面再同步到云端。 */ }
    return changed
  })().finally(() => { flights.delete(scope) })
  flights.set(scope, task)
  return task
}
