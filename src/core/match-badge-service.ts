import Taro from '@tarojs/taro'
import { getPlayerDelta, getSelfPlayer, type MatchRecord } from './match-types'

export type BadgeRarity = 'copper' | 'silver' | 'gold' | 'legend'
type Metric = 'first' | 'games' | 'best' | 'winStreak' | 'rate' | 'stable' | 'second' | 'worst' | 'loseStreak' | 'volatile'
export interface MatchBadge {
  id: string
  name: string
  description: string
  rarity: BadgeRarity
  symbol: 'award' | 'fire' | 'star' | 'flag'
  metric: Metric
  target: number
}
export interface MatchBadgeView extends MatchBadge {
  unlockedAt?: number
  current: number
  progress: number
  progressLabel: string
}
export const RARITY_LABELS: Record<BadgeRarity, string> = {
  copper: '青铜', silver: '白银', gold: '黄金', legend: '传奇',
}
export const MATCH_BADGES: MatchBadge[] = [
  { id: 'first_blood', name: '首战告捷', description: '生涯第一场就拿下一位，天选开局', rarity: 'gold', symbol: 'award', metric: 'first', target: 1 },
  { id: 'regular_10', name: '十场老将', description: '累计参赛 10 场，牌桌常客', rarity: 'copper', symbol: 'flag', metric: 'games', target: 10 },
  { id: 'regular_25', name: '廿五常客', description: '累计参赛 25 场', rarity: 'silver', symbol: 'flag', metric: 'games', target: 25 },
  { id: 'regular_50', name: '半百俱乐部', description: '累计参赛 50 场，牌桌常青树', rarity: 'gold', symbol: 'award', metric: 'games', target: 50 },
  { id: 'century', name: '单场破百', description: '单场得分 +100 以上，一战封神', rarity: 'gold', symbol: 'star', metric: 'best', target: 100 },
  { id: 'skyrocket', name: '一飞冲天', description: '单场得分 +140 以上，传说之夜', rarity: 'legend', symbol: 'star', metric: 'best', target: 140 },
  { id: 'win_streak_3', name: '连中三元', description: '连续 3 场一位，势不可挡', rarity: 'silver', symbol: 'fire', metric: 'winStreak', target: 3 },
  { id: 'win_streak_5', name: '五连绝世', description: '连续 5 场一位，传说级统治力', rarity: 'legend', symbol: 'fire', metric: 'winStreak', target: 5 },
  { id: 'sharp_shooter', name: '常胜将军', description: '正分率达到 60%（至少 10 场）', rarity: 'silver', symbol: 'award', metric: 'rate', target: 60 },
  { id: 'stable_rock', name: '稳如泰山', description: '得分标准差 ≤ 30（至少 10 场），发挥极其稳定', rarity: 'silver', symbol: 'flag', metric: 'stable', target: 30 },
  { id: 'runner_up_5', name: '千年老二', description: '累计 5 次第二位，差一点就赢了', rarity: 'copper', symbol: 'award', metric: 'second', target: 5 },
  { id: 'piggy_bank', name: '送财童子', description: '单场 -100 以下，牌桌慈善家', rarity: 'copper', symbol: 'star', metric: 'worst', target: 100 },
  { id: 'lose_streak_3', name: '三连垫底', description: '连续 3 场垫底，触底必反弹', rarity: 'copper', symbol: 'fire', metric: 'loseStreak', target: 3 },
  { id: 'roller_coaster', name: '过山车', description: '得分标准差 ≥ 60（至少 10 场），大起大落', rarity: 'copper', symbol: 'fire', metric: 'volatile', target: 60 },
]
const KEY = 'match_badges_v1'
interface BadgeState { unlocked: Record<string, number>; seen: string[] }
function readState(): BadgeState {
  try {
    const state = Taro.getStorageSync(KEY)
    if (state && typeof state.unlocked === 'object' && state.unlocked && Array.isArray(state.seen)) return state
  } catch { /* 本地降级 */ }
  return { unlocked: {}, seen: [] }
}
function evaluate(records: MatchRecord[]) {
  const games = records.filter((r) => r.settleUnit === 'score' && getSelfPlayer(r))
    .slice().sort((a, b) => a.playedAt - b.playedAt || a.id.localeCompare(b.id))
  const scores: number[] = []
  let winStreak = 0, loseStreak = 0, maxWin = 0, maxLose = 0, seconds = 0, firstRank = 0
  games.forEach((r, i) => {
    const delta = getPlayerDelta(getSelfPlayer(r)!, 'score')
    const rank = 1 + r.players.filter((p) => getPlayerDelta(p, 'score') > delta).length
    const bottom = r.players.every((p) => getPlayerDelta(p, 'score') >= delta)
    if (i === 0) firstRank = rank
    if (rank === 2) seconds++
    winStreak = rank === 1 ? winStreak + 1 : 0
    loseStreak = bottom ? loseStreak + 1 : 0
    maxWin = Math.max(maxWin, winStreak)
    maxLose = Math.max(maxLose, loseStreak)
    scores.push(delta)
  })
  const n = scores.length
  const mean = n ? scores.reduce((sum, v) => sum + v, 0) / n : 0
  const stddev = n ? Math.sqrt(scores.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n) : 0
  const values: Record<Metric, number> = {
    first: firstRank === 1 ? 1 : 0, games: n, best: Math.max(0, ...scores),
    worst: Math.max(0, ...scores.map((s) => -s)), winStreak: maxWin, loseStreak: maxLose,
    second: seconds, rate: n ? scores.filter((s) => s > 0).length / n * 100 : 0,
    stable: stddev, volatile: stddev,
  }
  return MATCH_BADGES.map((badge) => {
    const current = values[badge.metric]
    const minimum = ['rate', 'stable', 'volatile'].includes(badge.metric)
    const enough = !minimum || n >= 10
    const hit = n > 0 && enough && (badge.metric === 'stable' ? current <= badge.target : current >= badge.target)
    const progress = minimum && !enough ? n / 10 * 100 : badge.metric === 'stable' ? (hit ? 100 : 0) : current / badge.target * 100
    let progressLabel = `${Number(current.toFixed(1))} / ${badge.target}`
    if (minimum && !enough) progressLabel = `${n} / 10 场 · 尚需积累样本`
    else if (badge.metric === 'rate') progressLabel = `正分率 ${current.toFixed(1)}% / 60%`
    else if (badge.metric === 'stable' || badge.metric === 'volatile') progressLabel = `标准差 ${current.toFixed(1)} / ${badge.metric === 'stable' ? '≤' : '≥'} ${badge.target}`
    else if (badge.metric === 'first') progressLabel = n ? (hit ? '首场第一名' : '首场未获第一名') : '记录第一场牌局'
    return { ...badge, current, progress: Math.min(100, Math.max(0, progress)), progressLabel, hit }
  })
}

/** 只在数据变更或打开牌局页时调用，渲染过程不写存储。 */
export function updateMatchBadges(records: MatchRecord[], markSeen = false): MatchBadgeView[] {
  const state = readState()
  const evaluated = evaluate(records)
  for (const badge of evaluated) {
    if (badge.hit && !state.unlocked[badge.id]) state.unlocked[badge.id] = Date.now()
  }
  if (markSeen) state.seen = Object.keys(state.unlocked)
  try { Taro.setStorageSync(KEY, state) } catch { /* 不阻塞牌局保存 */ }
  return evaluated.map(({ hit: _hit, ...badge }) => ({ ...badge, unlockedAt: state.unlocked[badge.id] }))
}
export function getPendingBadgeIds(): string[] {
  const state = readState()
  return Object.keys(state.unlocked).filter((id) => !state.seen.includes(id))
}
export function markBadgesSeen(ids: string[]) {
  const state = readState()
  state.seen = Array.from(new Set([...state.seen, ...ids]))
  try { Taro.setStorageSync(KEY, state) } catch { /* 下次可重新展示 */ }
}
