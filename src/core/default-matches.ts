import source from '../content/default-matches.json'
import { compareMatchesByTime, deriveMatchResult, SELF_PLAYER_NAME, type MatchRecord } from './match-types'

// 导出的时间没有时区，固定按北京时间解释，避免 H5 与真机日期偏移。
function beijingTime(value: string): number {
  return Date.parse(`${value}+08:00`)
}

export function createDefaultMatches(): MatchRecord[] {
  return source.rounds.map((round): MatchRecord => ({
    id: `board_20261016_${round.id}`,
    playedAt: beijingTime(round.played_at),
    variant: 'xuezhan',
    location: round.location,
    settleUnit: 'score',
    result: deriveMatchResult(round.scores.find((p) => p.player === SELF_PLAYER_NAME)?.score || 0),
    players: round.scores.map((p) => ({
      name: p.player,
      isSelf: p.player === SELF_PLAYER_NAME,
      scoreDelta: p.score,
    })),
    note: round.note || undefined,
    createdAt: beijingTime(round.created_at),
    updatedAt: beijingTime(round.updated_at),
  })).sort(compareMatchesByTime)
}
