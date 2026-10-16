import source from '../content/default-matches.json'
import { deriveMatchResult, type MatchRecord } from './match-types'

export const DEFAULT_MATCH_VERSION = 'mahjong-board-2026-10-16-v1'

// 导出的时间没有时区，固定按北京时间解释，避免 H5 与真机日期偏移。
function beijingTime(value: string): number {
  return Date.parse(`${value}+08:00`)
}

export function createDefaultMatches(): MatchRecord[] {
  return source.rounds.map((round) => ({
    id: `board_20261016_${round.id}`,
    playedAt: beijingTime(round.played_at),
    variant: 'xuezhan',
    location: round.location,
    settleUnit: 'score',
    result: deriveMatchResult(round.scores.find((p) => p.player === 'HENING')?.score || 0),
    players: round.scores.map((p) => ({
      name: p.player,
      isSelf: p.player === 'HENING',
      scoreDelta: p.score,
    })),
    note: round.note || undefined,
    createdAt: beijingTime(round.created_at),
    updatedAt: beijingTime(round.updated_at),
  }))
}
