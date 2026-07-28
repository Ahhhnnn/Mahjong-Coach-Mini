import {
  getPlayerDelta,
  getSelfDelta,
  getSelfPlayer,
  type MatchPerformance,
  type MatchReason,
  type MatchRecord,
  type SettleUnit,
} from './match-types'
import { REASON_OPTIONS } from './match-types'

export type StatsRange = 'all' | 'week' | 'month' | 'quarter' | 'year'
export type TrendSpan = 'week' | 'month' | 'quarter' | 'half' | 'year'

export type TrendPoint = {
  label: string
  cumulative: number
  time: number
}

export type RankEntry = {
  name: string
  isSelf: boolean
  total: number
  games: number
}

export type AiInsight = {
  style: string
  strengths: string[]
  weakness: string
  recommend: string
  recommendUrl: string
  summaryLines: string[]
}

export type MatchStats = {
  unit: SettleUnit
  total: number
  wins: number
  losses: number
  draws: number
  winRate: number
  cumulative: number
  trend: TrendPoint[]
  ranking: RankEntry[]
  ai: AiInsight
}

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function rangeStart(range: StatsRange, now = Date.now()): number | null {
  if (range === 'all') return null
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  if (range === 'week') {
    const day = d.getDay() || 7
    d.setDate(d.getDate() - day + 1)
    return d.getTime()
  }
  if (range === 'month') {
    d.setDate(1)
    return d.getTime()
  }
  if (range === 'quarter') {
    const q = Math.floor(d.getMonth() / 3) * 3
    d.setMonth(q, 1)
    return d.getTime()
  }
  // year
  d.setMonth(0, 1)
  return d.getTime()
}

export function trendSpanStart(span: TrendSpan, now = Date.now()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  if (span === 'week') {
    d.setDate(d.getDate() - 6)
    return d.getTime()
  }
  if (span === 'month') {
    d.setDate(d.getDate() - 29)
    return d.getTime()
  }
  if (span === 'quarter') {
    d.setDate(d.getDate() - 89)
    return d.getTime()
  }
  if (span === 'half') {
    d.setDate(d.getDate() - 179)
    return d.getTime()
  }
  d.setDate(d.getDate() - 364)
  return d.getTime()
}

export function filterByRange(records: MatchRecord[], range: StatsRange): MatchRecord[] {
  const start = rangeStart(range)
  if (start == null) return records
  return records.filter((r) => r.playedAt >= start)
}

function formatTrendLabel(ts: number, span: TrendSpan): string {
  const d = new Date(ts)
  const m = d.getMonth() + 1
  const day = d.getDate()
  if (span === 'year' || span === 'half') return `${m}月`
  return `${m}/${day}`
}

export function buildTrend(
  records: MatchRecord[],
  span: TrendSpan,
  unit: SettleUnit
): TrendPoint[] {
  const start = trendSpanStart(span)
  const sorted = records
    .filter((r) => r.playedAt >= start)
    .slice()
    .sort((a, b) => a.playedAt - b.playedAt)

  let cum = 0
  const points: TrendPoint[] = []
  // 起点
  points.push({ label: formatTrendLabel(start, span), cumulative: 0, time: start })

  for (const r of sorted) {
    const deltaUnit = r.settleUnit === unit ? unit : r.settleUnit
    // 优先用目标单位字段；若本场单位不同则用本场单位 delta（避免混计时为 0）
    const self = getSelfPlayer(r)
    let delta = 0
    if (self) {
      const prefer = getPlayerDelta(self, unit)
      const fallback = getPlayerDelta(self, r.settleUnit)
      delta = prefer !== 0 || (unit === r.settleUnit) ? prefer : fallback
      // 若 prefer 为 0 且该单位未填写，用本场单位
      if (unit !== r.settleUnit) {
        const hasPrefer =
          unit === 'score' ? typeof self.scoreDelta === 'number' : typeof self.moneyDelta === 'number'
        delta = hasPrefer ? prefer : fallback
      }
      void deltaUnit
    } else {
      delta = getSelfDelta(r)
    }
    cum += delta
    points.push({
      label: formatTrendLabel(r.playedAt, span),
      cumulative: cum,
      time: r.playedAt,
    })
  }
  return points
}

export function buildRanking(records: MatchRecord[], unit: SettleUnit): RankEntry[] {
  const map = new Map<string, RankEntry>()

  for (const r of records) {
    for (const p of r.players) {
      const key = p.isSelf ? '__self__' : p.name.trim()
      if (!key) continue
      const delta =
        unit === r.settleUnit
          ? getPlayerDelta(p, unit)
          : (() => {
              const has =
                unit === 'score' ? typeof p.scoreDelta === 'number' : typeof p.moneyDelta === 'number'
              return has ? getPlayerDelta(p, unit) : getPlayerDelta(p, r.settleUnit)
            })()
      const exist = map.get(key)
      if (exist) {
        exist.total += delta
        exist.games += 1
      } else {
        map.set(key, {
          name: p.isSelf ? '我' : p.name.trim(),
          isSelf: !!p.isSelf,
          total: delta,
          games: 1,
        })
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function reasonLabel(r: MatchReason): string {
  return REASON_OPTIONS.find((o) => o.value === r)?.label || r
}

export function buildAiInsight(records: MatchRecord[]): AiInsight {
  const recent = records.slice(0, 20)
  const reasonCount = new Map<MatchReason, number>()
  let aggressive = 0
  let defense = 0
  let discardBad = 0
  let perfMistake = 0
  let wins = 0
  let decisive = 0

  for (const r of recent) {
    if (r.result === 'win') wins += 1
    if (r.result === 'win' || r.result === 'loss') decisive += 1
    if (r.performance === 'mistake') perfMistake += 1
    for (const reason of r.reasons || []) {
      reasonCount.set(reason, (reasonCount.get(reason) || 0) + 1)
      if (reason === 'aggressive' || reason === 'greedy') aggressive += 1
      if (reason === 'defense') defense += 1
      if (reason === 'discard') discardBad += 1
    }
  }

  const winRate = decisive > 0 ? wins / decisive : 0
  let style = '稳健进攻型'
  if (aggressive >= defense + 2) style = '激进进攻型'
  else if (defense >= aggressive + 2) style = '防守偏弱型'
  else if (perfMistake >= Math.ceil(recent.length / 3) && recent.length >= 3) style = '波动较大型'

  const strengths: string[] = []
  if (winRate >= 0.55) strengths.push('胜率保持稳定')
  if (discardBad === 0 && recent.length >= 3) strengths.push('拆搭能力持续改善')
  if (strengths.length === 0) strengths.push('持续记录牌局，画像会更准')

  let topReason: MatchReason | null = null
  let topCount = 0
  reasonCount.forEach((c, k) => {
    if (c > topCount) {
      topCount = c
      topReason = k
    }
  })

  const weaknessMap: Partial<Record<MatchReason, string>> = {
    greedy: '贪牌与风险收益判断',
    aggressive: '进攻节奏控制',
    defense: '后期防守判断',
    discard: '拆搭取舍',
    riichi_choice: '选叫决策',
    luck: '波动期心态管理',
  }
  const weakness =
    topReason && topCount > 0
      ? weaknessMap[topReason] || reasonLabel(topReason)
      : perfMistake > 0
        ? '关键失误局复盘'
        : '多记几场后再看短板'

  const recommend =
    topReason === 'defense' || topReason === 'riichi_choice'
      ? '推荐训练：猜对手胡牌训练'
      : '推荐训练：基础拆搭练习'
  const recommendUrl =
    topReason === 'defense' || topReason === 'riichi_choice'
      ? '/pages/guess/index'
      : '/pages/puzzles/index'

  const summaryLines = [
    `近${recent.length || 0}场胜率 ${decisive ? Math.round(winRate * 100) : 0}%`,
    `打法画像：${style}`,
    topReason ? `高频复盘点：${reasonLabel(topReason)}（${topCount}次）` : '复盘标签还不多，记牌局时勾选原因更有用',
    `建议关注：${weakness}`,
  ]

  return {
    style,
    strengths: strengths.slice(0, 2),
    weakness,
    recommend,
    recommendUrl,
    summaryLines,
  }
}

export function computeMatchStats(
  records: MatchRecord[],
  options: {
    range?: StatsRange
    trendSpan?: TrendSpan
    unit?: SettleUnit
  } = {}
): MatchStats {
  const range = options.range || 'month'
  const trendSpan = options.trendSpan || 'week'
  const unit = options.unit || 'score'
  const filtered = filterByRange(records, range)

  let wins = 0
  let losses = 0
  let draws = 0
  let cumulative = 0

  for (const r of filtered) {
    if (r.result === 'win') wins += 1
    else if (r.result === 'loss') losses += 1
    else draws += 1

    const self = getSelfPlayer(r)
    if (self) {
      const has =
        unit === 'score' ? typeof self.scoreDelta === 'number' : typeof self.moneyDelta === 'number'
      cumulative += has ? getPlayerDelta(self, unit) : getPlayerDelta(self, r.settleUnit)
    }
  }

  const decisive = wins + losses
  const winRate = decisive > 0 ? Math.round((wins / decisive) * 100) : 0

  return {
    unit,
    total: filtered.length,
    wins,
    losses,
    draws,
    winRate,
    cumulative,
    trend: buildTrend(records, trendSpan, unit),
    ranking: buildRanking(filtered, unit).slice(0, 10),
    ai: buildAiInsight(records),
  }
}

/** 供录入页软校验：四人 delta 之和 */
export function sumPlayerDeltas(
  players: { scoreDelta?: number; moneyDelta?: number }[],
  unit: SettleUnit
): number {
  return players.reduce((s, p) => s + getPlayerDelta(p as any, unit), 0)
}

export function performanceToLabel(p?: MatchPerformance): string {
  if (p === 'good') return '发挥不错'
  if (p === 'mistake') return '有明显失误'
  if (p === 'normal') return '正常发挥'
  return ''
}
