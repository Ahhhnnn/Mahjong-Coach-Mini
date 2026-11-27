import { matchSeasonBounds, type MatchSeason } from './match-stats-service'
import { SOLO_SEATS, type SoloMatchRecord, type SoloSeat } from './match-types'
import { MYSTIC_MIN_GAMES } from './match-mystic-service'

export interface SoloSeatMystic {
  seat: SoloSeat
  label: string
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
  total: number
  average: number
  eligible: boolean
  matchIds: string[]
}

export interface SoloMystic {
  games: number
  seatedGames: number
  seats: SoloSeatMystic[]
  luckySeats: SoloSeat[]
  unluckySeats: SoloSeat[]
}

/** 只统计选了方位的单人记录。胜率与牌局页一致：平局不计入胜负。 */
export function computeSoloSeatMystic(records: SoloMatchRecord[], season?: MatchSeason): SoloMystic {
  const bounds = season ? matchSeasonBounds(season) : undefined
  const games = records.filter((record) => Number.isFinite(record.playedAt) && record.playedAt > 0 && Number.isFinite(record.scoreDelta)
    && (!bounds || (record.playedAt >= bounds.start && record.playedAt < bounds.end)))
  const buckets = new Map<SoloSeat, SoloMatchRecord[]>()
  for (const seat of SOLO_SEATS) buckets.set(seat.value, [])
  for (const record of games) {
    if (record.seat && buckets.has(record.seat)) buckets.get(record.seat)!.push(record)
  }
  const seats = SOLO_SEATS.map((seat) => {
    const list = buckets.get(seat.value) || []
    const wins = list.filter((record) => record.scoreDelta > 0).length
    const losses = list.filter((record) => record.scoreDelta < 0).length
    const draws = list.length - wins - losses
    const total = list.reduce((sum, record) => sum + record.scoreDelta, 0)
    const decisive = wins + losses
    return {
      seat: seat.value, label: seat.label, games: list.length, wins, losses, draws,
      winRate: decisive ? Math.round(wins / decisive * 100) : 0,
      total, average: list.length ? total / list.length : 0,
      eligible: list.length >= MYSTIC_MIN_GAMES, matchIds: list.map((record) => record.id),
    }
  })
  const ranked = seats.filter((seat) => seat.eligible && seat.total > 0).sort((a, b) => b.average - a.average || b.games - a.games)
  const negative = seats.filter((seat) => seat.eligible && seat.total < 0).sort((a, b) => a.average - b.average || b.games - a.games)
  const best = ranked[0]
  const worst = negative[0]
  return {
    games: games.length,
    seatedGames: seats.reduce((sum, seat) => sum + seat.games, 0),
    seats,
    luckySeats: best ? ranked.filter((seat) => seat.total * best.games === best.total * seat.games).map((seat) => seat.seat) : [],
    unluckySeats: worst ? negative.filter((seat) => seat.total * worst.games === worst.total * seat.games).map((seat) => seat.seat) : [],
  }
}
