import { getCachedUser } from './table-identity-service'
import { persistBadgeViews, getPendingBadgeIds, markBadgesSeen, type MatchBadge, type MatchBadgeView } from './match-badge-service'
import { SOLO_SELF_NAME, type SoloMatchRecord } from './match-types'

type Metric = 'first' | 'games' | 'best' | 'winStreak' | 'rate' | 'stable' | 'worst' | 'loseStreak' | 'volatile'

export const SOLO_BADGES: MatchBadge[] = [
  { id: 'solo_open', name: '开门有分', description: '单人账本第一场就是正分', rarity: 'gold', symbol: 'award', metric: 'first', target: 1 },
  { id: 'solo_10', name: '十场起步', description: '单人累计记录 10 场', rarity: 'copper', symbol: 'flag', metric: 'games', target: 10 },
  { id: 'solo_25', name: '廿五常客', description: '单人累计记录 25 场', rarity: 'silver', symbol: 'flag', metric: 'games', target: 25 },
  { id: 'solo_50', name: '半百俱乐部', description: '单人累计记录 50 场', rarity: 'gold', symbol: 'award', metric: 'games', target: 50 },
  { id: 'solo_century', name: '单场破百', description: '单场得分 +100 以上', rarity: 'gold', symbol: 'star', metric: 'best', target: 100 },
  { id: 'solo_sky', name: '一飞冲天', description: '单场得分 +140 以上', rarity: 'legend', symbol: 'star', metric: 'best', target: 140 },
  { id: 'solo_win_3', name: '连胜三场', description: '连续 3 场正分', rarity: 'silver', symbol: 'fire', metric: 'winStreak', target: 3 },
  { id: 'solo_win_5', name: '五连正分', description: '连续 5 场正分', rarity: 'legend', symbol: 'fire', metric: 'winStreak', target: 5 },
  { id: 'solo_rate', name: '正分过半', description: '正分率达到 60%（至少 10 场）', rarity: 'silver', symbol: 'award', metric: 'rate', target: 60 },
  { id: 'solo_stable', name: '稳如泰山', description: '得分标准差 ≤ 30（至少 10 场）', rarity: 'silver', symbol: 'flag', metric: 'stable', target: 30 },
  { id: 'solo_pit', name: '单场深坑', description: '单场 -100 以下', rarity: 'copper', symbol: 'star', metric: 'worst', target: 100 },
  { id: 'solo_lose_3', name: '三连失分', description: '连续 3 场负分', rarity: 'copper', symbol: 'fire', metric: 'loseStreak', target: 3 },
  { id: 'solo_swing', name: '过山车', description: '得分标准差 ≥ 60（至少 10 场）', rarity: 'copper', symbol: 'fire', metric: 'volatile', target: 60 },
]

export function soloLedgerKey(openid = getCachedUser()?.openid || ''): string {
  return openid ? `solo_badges_v1:${openid}` : ''
}

function needsMinimumGames(metric: string): boolean {
  return metric === 'rate' || metric === 'stable' || metric === 'volatile'
}

function meets(badge: MatchBadge, values: Record<Metric, number>, games: number): boolean {
  return games > 0 && (!needsMinimumGames(badge.metric) || games >= 10)
    && (badge.metric === 'stable' ? values.stable <= badge.target : values[badge.metric as Metric] >= badge.target)
}

export function evaluateSoloBadges(records: SoloMatchRecord[]): MatchBadgeView[] {
  const games = records.filter((record) => Number.isFinite(record.playedAt) && Number.isFinite(record.scoreDelta))
    .slice().sort((a, b) => a.playedAt - b.playedAt || a.id.localeCompare(b.id))
  const firstUnlockedAt: Record<string, number> = {}
  const values: Record<Metric, number> = {
    first: 0, games: 0, best: 0, worst: 0, winStreak: 0, loseStreak: 0, rate: 0, stable: 0, volatile: 0,
  }
  let positiveCount = 0, mean = 0, squared = 0, winStreak = 0, loseStreak = 0, maxWin = 0, maxLose = 0, firstFlag = 0
  games.forEach((record, index) => {
    const delta = record.scoreDelta
    if (index === 0) firstFlag = delta > 0 ? 1 : 0
    winStreak = delta > 0 ? winStreak + 1 : 0
    loseStreak = delta < 0 ? loseStreak + 1 : 0
    maxWin = Math.max(maxWin, winStreak)
    maxLose = Math.max(maxLose, loseStreak)
    const n = index + 1
    if (delta > 0) positiveCount += 1
    const difference = delta - mean
    mean += difference / n
    squared += difference * (delta - mean)
    const stddev = Math.sqrt(Math.max(0, squared / n))
    Object.assign(values, {
      first: firstFlag, games: n, best: Math.max(values.best, delta), worst: Math.max(values.worst, -delta),
      winStreak: maxWin, loseStreak: maxLose, rate: positiveCount / n * 100, stable: stddev, volatile: stddev,
    })
    for (const badge of SOLO_BADGES) {
      if (firstUnlockedAt[badge.id] === undefined && meets(badge, values, n)) firstUnlockedAt[badge.id] = record.playedAt
    }
  })
  const n = values.games
  return SOLO_BADGES.map((badge) => {
    const current = values[badge.metric as Metric]
    const minimum = needsMinimumGames(badge.metric)
    const hit = meets(badge, values, n)
    const progress = minimum && n < 10 ? n / 10 * 100 : badge.metric === 'stable' ? (hit ? 100 : 0) : current / badge.target * 100
    let progressLabel = `${Number(current.toFixed(1))} / ${badge.target}`
    if (minimum && n < 10) progressLabel = `${n} / 10 场 · 尚需积累样本`
    else if (badge.metric === 'rate') progressLabel = `正分率 ${current.toFixed(1)}% / 60%`
    else if (badge.metric === 'stable' || badge.metric === 'volatile') progressLabel = `标准差 ${current.toFixed(1)} / ${badge.metric === 'stable' ? '≤' : '≥'} ${badge.target}`
    else if (badge.metric === 'first') progressLabel = n ? (hit ? '首场为正分' : '首场不是正分') : '记录第一场'
    return {
      ...badge, current, progress: Math.min(100, Math.max(0, progress)), progressLabel,
      unlockedAt: hit ? firstUnlockedAt[badge.id] : undefined,
    }
  })
}

export function updateSoloBadges(records: SoloMatchRecord[], markSeen = false): MatchBadgeView[] {
  const evaluated = evaluateSoloBadges(records)
  const ledger = soloLedgerKey()
  if (!ledger) return evaluated
  return persistBadgeViews(evaluated, SOLO_SELF_NAME, ledger, markSeen)
}

export function pendingSoloBadgeIds(): string[] {
  const ledger = soloLedgerKey()
  return ledger ? getPendingBadgeIds(SOLO_SELF_NAME, ledger) : []
}

export function markSoloBadgesSeen(ids: string[]) {
  const ledger = soloLedgerKey()
  if (ledger) markBadgesSeen(ids, SOLO_SELF_NAME, ledger)
}
