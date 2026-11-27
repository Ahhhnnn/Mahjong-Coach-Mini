import { peekMatches } from './match-service'
import {
  deriveMatchResult, parseTableSoloId, tableSoloId, type MatchRecord, type SoloMatchRecord,
} from './match-types'
import { listCachedTables, tableContext } from './table-directory-service'

function project(tableId: string, records: MatchRecord[]): SoloMatchRecord[] {
  return records.flatMap((record) => {
    const self = record.players.find((player) => player.isSelf)
    const scoreDelta = self?.scoreDelta
    if (!self || typeof scoreDelta !== 'number' || !Number.isFinite(scoreDelta)) return []
    return [{
      id: tableSoloId(tableId, record.id),
      playedAt: record.playedAt,
      variant: record.variant || 'xuezhan',
      location: record.location,
      settleUnit: 'score' as const,
      scoreDelta,
      result: deriveMatchResult(scoreDelta),
      performance: record.performance,
      reasons: record.reasons,
      note: record.note,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      revision: record.revision,
      origin: 'table' as const,
      sourceTableId: tableId,
    }]
  })
}

/** 已同步到本地的四人牌局，按本人分数叠进个人页。公共牌局一份不改。 */
export function soloRecordsFromTables(stored: SoloMatchRecord[]): SoloMatchRecord[] {
  const projected = new Map<string, SoloMatchRecord>()
  const authoritative = new Set<string>()
  const fixed = peekMatches()
  if (fixed.ready) {
    authoritative.add('fixed-four')
    for (const record of project('fixed-four', fixed.records)) projected.set(record.id, record)
  }
  for (const table of listCachedTables()) {
    if (table.id === 'fixed-four') continue
    const peeked = peekMatches(tableContext(table))
    if (!peeked.ready) continue
    authoritative.add(table.id)
    for (const record of project(table.id, peeked.records)) projected.set(record.id, record)
  }
  const byId = new Map<string, SoloMatchRecord>()
  for (const record of stored) {
    const parsed = parseTableSoloId(record.id)
    if (parsed && authoritative.has(parsed.tableId)) continue
    byId.set(record.id, record)
  }
  for (const record of projected.values()) byId.set(record.id, record)
  return [...byId.values()]
}
