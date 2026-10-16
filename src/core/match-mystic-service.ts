import {
  compareMatchesByTime, fixedMatchRecords, FIXED_MATCH_PLAYERS,
  getPlayerDelta, getSelfDelta, type MatchRecord,
} from './match-types'
import { filterBySeason, type MatchSeason } from './match-stats-service'

export const MYSTIC_MIN_GAMES = 5

export interface OpponentMystic {
  name: string
  games: number
  ahead: number
  behind: number
  tied: number
  pressureRate: number
  averageGap: number
  eligible: boolean
  matchIds: string[]
}

export interface LocationMystic {
  name: string
  games: number
  total: number
  average: number
  wins: number
  positiveRate: number
  eligible: boolean
  matchIds: string[]
}

export interface MatchMystic {
  games: number
  matchIds: string[]
  opponents: OpponentMystic[]
  locations: LocationMystic[]
  nemeses: string[]
  luckyPlaces: string[]
  unluckyPlaces: string[]
}

/** 仅分析可核验的积分牌局；不根据总积分推断两人间的输赢流水。 */
export function computeMatchMystic(records: MatchRecord[], season?: MatchSeason): MatchMystic {
  const valid = fixedMatchRecords(records).filter((record) => Number.isFinite(record.playedAt)
    && record.players.every((player) => Number.isFinite(player.scoreDelta))
    && Math.abs(record.players.reduce((sum, player) => sum + player.scoreDelta!, 0)) < 1e-6)
  const games = (season ? filterBySeason(valid, season) : valid).slice().sort(compareMatchesByTime)
  const opponents = new Map<string, OpponentMystic>()
  const locations = new Map<string, LocationMystic>()
  for (const record of games) {
    const self = getSelfDelta(record)
    for (const player of record.players.filter((p) => !p.isSelf)) {
      const entry = opponents.get(player.name) || {
        name: player.name, games: 0, ahead: 0, behind: 0, tied: 0,
        pressureRate: 0, averageGap: 0, eligible: false, matchIds: [],
      }
      const gap = getPlayerDelta(player) - self
      entry.games++
      entry.ahead += Number(gap > 0)
      entry.behind += Number(gap < 0)
      entry.tied += Number(gap === 0)
      // 先累计差值，最后统一计算场均值。
      entry.averageGap += gap
      entry.matchIds.push(record.id)
      opponents.set(player.name, entry)
    }
    const name = record.location?.trim()
    if (!name) continue
    const place = locations.get(name) || {
      name, games: 0, total: 0, average: 0, wins: 0,
      positiveRate: 0, eligible: false, matchIds: [],
    }
    place.games++
    place.total += self
    place.wins += Number(self > 0)
    place.matchIds.push(record.id)
    locations.set(name, place)
  }
  const opponentList = Array.from(opponents.values()).map((entry) => ({
    ...entry, pressureRate: entry.ahead / entry.games * 100,
    averageGap: entry.averageGap / entry.games, eligible: entry.games >= MYSTIC_MIN_GAMES,
  })).sort((a, b) => b.pressureRate - a.pressureRate || b.averageGap - a.averageGap
    || FIXED_MATCH_PLAYERS.indexOf(a.name as typeof FIXED_MATCH_PLAYERS[number])
      - FIXED_MATCH_PLAYERS.indexOf(b.name as typeof FIXED_MATCH_PLAYERS[number]))
  const locationList = Array.from(locations.values()).map((entry) => ({
    ...entry, average: entry.total / entry.games, positiveRate: entry.wins / entry.games * 100,
    eligible: entry.games >= MYSTIC_MIN_GAMES,
  })).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.average - a.average
    || b.games - a.games || a.name.localeCompare(b.name, 'zh'))
  const rivals = opponentList.filter((entry) => entry.eligible && entry.ahead * 2 > entry.games)
  const best = locationList.find((entry) => entry.eligible && entry.total > 0)
  const negativePlaces = locationList.filter((entry) => entry.eligible && entry.total < 0)
  const worst = negativePlaces[negativePlaces.length - 1]
  return {
    games: games.length, matchIds: games.map((record) => record.id),
    opponents: opponentList, locations: locationList,
    nemeses: rivals.filter((entry) => entry.ahead * rivals[0].games === rivals[0].ahead * entry.games).map((entry) => entry.name),
    luckyPlaces: best ? locationList.filter((entry) => entry.eligible
      && entry.total * best.games === best.total * entry.games).map((entry) => entry.name) : [],
    unluckyPlaces: worst ? locationList.filter((entry) => entry.eligible
      && entry.total * worst.games === worst.total * entry.games).map((entry) => entry.name) : [],
  }
}

/** 玄学界面统一显示一位小数，保留明确正负号，避免负零。 */
export function formatMysticScore(value: number): string {
  const rounded = Number(value.toFixed(1))
  return `${rounded > 0 ? '+' : ''}${rounded} 分`
}

export function formatMysticRate(value: number): string {
  return `${Number(value.toFixed(1))}%`
}
