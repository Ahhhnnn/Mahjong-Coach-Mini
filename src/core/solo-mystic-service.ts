import { matchSeasonBounds, type MatchSeason } from './match-stats-service'
import { type SoloMatchRecord } from './match-types'
import { MYSTIC_MIN_GAMES } from './match-mystic-service'

export interface SoloVenueMystic {
  name: string
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
  placedGames: number
  venues: SoloVenueMystic[]
  luckyVenues: string[]
  unluckyVenues: string[]
}

/** 按棋牌室汇总单人分数。胜率与牌局页一致：平局不计入胜负。 */
export function computeSoloVenueMystic(records: SoloMatchRecord[], season?: MatchSeason): SoloMystic {
  const bounds = season ? matchSeasonBounds(season) : undefined
  const games = records.filter((record) => Number.isFinite(record.playedAt) && record.playedAt > 0 && Number.isFinite(record.scoreDelta)
    && (!bounds || (record.playedAt >= bounds.start && record.playedAt < bounds.end)))
  const buckets = new Map<string, SoloMatchRecord[]>()
  for (const record of games) {
    const name = record.location?.trim()
    if (!name) continue
    const list = buckets.get(name) || []
    list.push(record)
    buckets.set(name, list)
  }
  const venues = [...buckets.entries()].map(([name, list]) => {
    const wins = list.filter((record) => record.scoreDelta > 0).length
    const losses = list.filter((record) => record.scoreDelta < 0).length
    const draws = list.length - wins - losses
    const total = list.reduce((sum, record) => sum + record.scoreDelta, 0)
    const decisive = wins + losses
    return {
      name, games: list.length, wins, losses, draws,
      winRate: decisive ? Math.round(wins / decisive * 100) : 0,
      total, average: list.length ? total / list.length : 0,
      eligible: list.length >= MYSTIC_MIN_GAMES, matchIds: list.map((record) => record.id),
    }
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.winRate - a.winRate || b.games - a.games || a.name.localeCompare(b.name, 'zh'))
  const ranked = venues.filter((venue) => venue.eligible && venue.wins + venue.losses > 0 && venue.winRate >= 50)
  const negative = venues.filter((venue) => venue.eligible && venue.wins + venue.losses > 0 && venue.winRate < 50)
    .sort((a, b) => a.winRate - b.winRate || b.games - a.games)
  const best = ranked[0]
  const worst = negative[0]
  return {
    games: games.length,
    placedGames: venues.reduce((sum, venue) => sum + venue.games, 0),
    venues,
    luckyVenues: best ? ranked.filter((venue) => venue.winRate === best.winRate).map((venue) => venue.name) : [],
    unluckyVenues: worst ? negative.filter((venue) => venue.winRate === worst.winRate).map((venue) => venue.name) : [],
  }
}
