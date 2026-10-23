import {
  compareMatchesByTime,
  fixedMatchRecords,
  getPlayerDelta,
  getSelfDelta,
  getSelfPlayer,
  SELF_PLAYER_NAME,
  type MatchPerformance,
  type MatchReason,
  type MatchRecord,
} from './match-types'
import { REASON_OPTIONS } from './match-types'

export type StatsRange = 'all' | 'week' | 'month' | 'quarter' | 'year'
export type TrendSpan = 'all' | 'week' | 'month' | 'quarter' | 'half' | 'year'
export type MatchSeasonPeriod = 'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4'
export type MatchSeason = { year: number; period: MatchSeasonPeriod }

export const MATCH_SEASON_OPTIONS: { value: MatchSeasonPeriod; label: string; dates: string }[] = [
  { value: 'all', label: '全年', dates: '01.01 — 12.31' },
  { value: 'Q1', label: 'Q1', dates: '01.01 — 03.31' },
  { value: 'Q2', label: 'Q2', dates: '04.01 — 06.30' },
  { value: 'Q3', label: 'Q3', dates: '07.01 — 09.30' },
  { value: 'Q4', label: 'Q4', dates: '10.01 — 12.31' },
]
const BEIJING_OFFSET = 8 * 60 * 60 * 1000

/** 与导入牌局保持一致，按北京时间的自然年、自然季度划分。 */
export function getMatchSeasonAt(time = Date.now()): MatchSeason {
  const date = new Date(time + BEIJING_OFFSET)
  const period = `Q${Math.floor(date.getUTCMonth() / 3) + 1}` as MatchSeasonPeriod
  return { year: date.getUTCFullYear(), period }
}

export function matchSeasonBounds(season: MatchSeason): { start: number; end: number } {
  const month = season.period === 'all' ? 0 : (Number(season.period.slice(1)) - 1) * 3
  const months = season.period === 'all' ? 12 : 3
  return {
    start: Date.UTC(season.year, month, 1) - BEIJING_OFFSET,
    end: Date.UTC(season.year, month + months, 1) - BEIJING_OFFSET,
  }
}

export function filterBySeason(records: MatchRecord[], season: MatchSeason): MatchRecord[] {
  const { start, end } = matchSeasonBounds(season)
  return records.filter((record) => record.playedAt >= start && record.playedAt < end)
}

export type TrendPoint = { label: string; time: number }
export type TrendSeries = { id: string; name: string; color: string; values: number[]; total: number }
export type MatchTrend = { points: TrendPoint[]; series: TrendSeries[] }
const MEMBER_COLORS = ['#56c9a0', '#78b8ef', '#ba9af4', '#ef998f', '#82cbbf']
function memberKey(player: { name: string; isSelf: boolean }): string {
  return player.isSelf ? '__self__' : player.name
}
function memberColor(key: string): string {
  const known: Record<string, string> = { __self__: '#edc779', HENING: '#a8b7d7', WUYU: '#56c9a0', TANGXIANG: '#78b8ef', DUHAN: '#ba9af4' }
  if (known[key]) return known[key]
  // 名称哈希使不同筛选、增删记录后配色稳定。
  let hash = 0
  for (const c of key) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return MEMBER_COLORS[hash % MEMBER_COLORS.length]
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
  total: number
  wins: number
  losses: number
  draws: number
  winRate: number
  cumulative: number
  trend: MatchTrend
  ranking: RankEntry[]
  ai: AiInsight
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
  if (span === 'all') return 0
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

export function buildTrend(records: MatchRecord[], span: TrendSpan, selfName = SELF_PLAYER_NAME): MatchTrend {
  const start = trendSpanStart(span)
  const sorted = fixedMatchRecords(records, selfName).filter((r) => r.settleUnit === 'score' && r.playedAt >= start)
    .slice().sort(compareMatchesByTime)
  if (!sorted.length) return { points: [], series: [] }
  const members = new Map<string, TrendSeries>()
  for (const record of sorted) record.players.forEach((player) => {
    const id = memberKey(player)
    if (!members.has(id)) members.set(id, { id, name: player.name, color: memberColor(id), values: [0], total: 0 })
  })
  const firstTime = span === 'all' ? sorted[0].playedAt - 1 : start
  const points: TrendPoint[] = [{ label: '起点', time: firstTime }]
  for (const record of sorted) {
    const deltas = new Map(record.players.map((p) => [memberKey(p), getPlayerDelta(p)]))
    members.forEach((series, id) => {
      series.total += deltas.get(id) || 0
      series.values.push(series.total)
    })
    const d = new Date(record.playedAt)
    points.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, time: record.playedAt })
  }
  return { points, series: Array.from(members.values()).sort((a, b) => Number(b.id === '__self__') - Number(a.id === '__self__') || a.id.localeCompare(b.id)) }
}

export function buildRanking(records: MatchRecord[], selfName = SELF_PLAYER_NAME): RankEntry[] {
  const map = new Map<string, RankEntry>()

  for (const r of fixedMatchRecords(records, selfName).filter((record) => record.settleUnit === 'score')) {
    r.players.forEach((p) => {
      const key = memberKey(p)

      const delta = getPlayerDelta(p)

      const displayName = p.name
      const exist = map.get(key)
      if (exist) {
        exist.total += delta
        exist.games += 1
      } else {
        map.set(key, {
          name: displayName,
          isSelf: !!p.isSelf,
          total: delta,
          games: 1,
        })
      }
    })
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    if (b.games !== a.games) return b.games - a.games
    return a.name.localeCompare(b.name, 'zh')
  })
}

function reasonLabel(r: MatchReason): string {
  return REASON_OPTIONS.find((o) => o.value === r)?.label || r
}

export function buildAiInsight(records: MatchRecord[], selfName = SELF_PLAYER_NAME): AiInsight {
  const recent = fixedMatchRecords(records, selfName).sort((a, b) => compareMatchesByTime(b, a)).slice(0, 20)
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
      : '/pages/basic/index'

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
    season?: MatchSeason
    playerName?: string
  } = {}
): MatchStats {
  const selfName = options.playerName || SELF_PLAYER_NAME
  const range = options.range || 'all'
  const trendSpan = options.trendSpan || 'all'
  const scoreRecords = fixedMatchRecords(records, selfName)
  const filtered = options.season ? filterBySeason(scoreRecords, options.season) : filterByRange(scoreRecords, range)

  let wins = 0
  let losses = 0
  let draws = 0
  let cumulative = 0

  for (const r of filtered) {
    if (r.result === 'win') wins += 1
    else if (r.result === 'loss') losses += 1
    else draws += 1

    cumulative += getSelfDelta(r)
  }

  const decisive = wins + losses
  const winRate = decisive > 0 ? Math.round((wins / decisive) * 100) : 0

  return {
    total: filtered.length,
    wins,
    losses,
    draws,
    winRate,
    cumulative,
    // 历史赛季从零累计，不能再套用相对于今天的滚动时间窗口。
    trend: buildTrend(options.season ? filtered : records, options.season ? 'all' : trendSpan, selfName),
    ranking: buildRanking(filtered, selfName),
    ai: buildAiInsight(options.season ? filtered : records, selfName),
  }
}

/** 供录入页软校验：四人 delta 之和 */
export function sumPlayerDeltas(
  players: { scoreDelta?: number }[]
): number {
  return players.reduce((s, p) => s + getPlayerDelta(p), 0)
}

export function performanceToLabel(p?: MatchPerformance): string {
  if (p === 'good') return '发挥不错'
  if (p === 'mistake') return '有明显失误'
  if (p === 'normal') return '正常发挥'
  return ''
}
