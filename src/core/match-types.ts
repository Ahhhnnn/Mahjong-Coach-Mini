/** 本人本场胜负 */
export type MatchResult = 'win' | 'loss' | 'draw'

/** 本场自我评价 */
export type MatchPerformance = 'good' | 'normal' | 'mistake'

/** 复盘原因标签 */
export type MatchReason =
  | 'greedy'
  | 'aggressive'
  | 'defense'
  | 'discard'
  | 'riichi_choice'
  | 'luck'

/** 玩法（可扩展） */
export type MatchVariant = 'xuezhan'

export interface MatchPlayer {
  name: string
  isSelf: boolean
  isDealer?: boolean
  scoreDelta?: number
  /** 仅识别旧存档，不再录入或展示。 */
  moneyDelta?: number
}

export const SELF_PLAYER_NAME = 'HENING'
export const FIXED_MATCH_PLAYERS = [SELF_PLAYER_NAME, 'WUYU', 'TANGXIANG', 'DUHAN'] as const
export type PlayerName = typeof FIXED_MATCH_PLAYERS[number]

/** 只接纳能确认身份的完整四人牌局；匿名座位不能推断成某位牌友。 */
export function normalizeMatchPlayers(players: MatchPlayer[], selfName: string = SELF_PLAYER_NAME): MatchPlayer[] | undefined {
  if (!FIXED_MATCH_PLAYERS.includes(selfName as PlayerName) || !Array.isArray(players) || players.length !== FIXED_MATCH_PLAYERS.length) return undefined
  const byName = new Map<string, MatchPlayer>()
  for (const player of players) {
    if (!player || (player.name !== undefined && typeof player.name !== 'string')) return undefined
    const rawName = (player.name || '').trim()
    const name = player.isSelf && ['', '我', '我的'].includes(rawName)
      ? SELF_PLAYER_NAME : rawName.toUpperCase()
    if (!FIXED_MATCH_PLAYERS.some((known) => known === name)
      || byName.has(name)) return undefined
    byName.set(name, { ...player, name, isSelf: name === selfName })
  }
  return FIXED_MATCH_PLAYERS.map((name) => byName.get(name)!)
}

export interface MatchRecord {
  id: string
  playedAt: number
  variant: MatchVariant
  location?: string
  /** money 仅用于识别并排除旧存档。 */
  settleUnit: 'score' | 'money'
  result: MatchResult
  players: MatchPlayer[]
  performance?: MatchPerformance
  reasons?: MatchReason[]
  note?: string
  createdAt: number
  updatedAt: number
  /** 云端乐观并发版本；0 表示尚未同步的新牌局。 */
  revision?: number
}

/** 统一按对局发生时间从早到晚排序，同一时刻按稳定 ID 排序。 */
export function compareMatchesByTime(a: MatchRecord, b: MatchRecord): number {
  return a.playedAt - b.playedAt || a.id.localeCompare(b.id)
}

/** 保留原始存储，展示和统计仅使用固定四人的完整记录。 */
export function fixedMatchRecords(records: MatchRecord[], selfName: string = SELF_PLAYER_NAME): MatchRecord[] {
  return records.flatMap((record) => {
    if (record.settleUnit !== 'score') return []
    const players = normalizeMatchPlayers(record.players, selfName)
    return players ? [{ ...record, players, result: deriveMatchResult(getPlayerDelta(players.find((p) => p.name === selfName)!)) }] : []
  })
}

export const PERFORMANCE_OPTIONS: {
  value: MatchPerformance
  label: string
  emoji: string
}[] = [
  { value: 'good', label: '发挥不错', emoji: '😀' },
  { value: 'normal', label: '正常发挥', emoji: '😐' },
  { value: 'mistake', label: '有明显失误', emoji: '😥' },
]

export const REASON_OPTIONS: {
  value: MatchReason
  label: string
  emoji: string
}[] = [
  { value: 'greedy', label: '贪心了', emoji: '🔥' },
  { value: 'aggressive', label: '太激进', emoji: '⚔️' },
  { value: 'defense', label: '防守不足', emoji: '🛡️' },
  { value: 'discard', label: '拆搭错误', emoji: '🃏' },
  { value: 'riichi_choice', label: '选叫问题', emoji: '🎯' },
  { value: 'luck', label: '手气不好', emoji: '🍀' },
]

export const VARIANT_LABELS: Record<MatchVariant, string> = {
  xuezhan: '血战到底',
}

export const PLAYER_AVATAR_COLORS = ['#1a5c2e', '#3b82f6', '#eab308', '#a855f7']

export function makeMatchId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function deriveMatchResult(delta: number): MatchResult {
  if (delta > 0) return 'win'
  if (delta < 0) return 'loss'
  return 'draw'
}

export function getPlayerDelta(player: Pick<MatchPlayer, 'scoreDelta'>): number {
  const v = player.scoreDelta
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

export function getSelfPlayer(record: MatchRecord): MatchPlayer | undefined {
  return record.players.find((p) => p.isSelf)
}

export function getSelfDelta(record: MatchRecord): number {
  const self = getSelfPlayer(record)
  if (!self || record.settleUnit !== 'score') return 0
  return getPlayerDelta(self)
}

export function formatDelta(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}分`
}

/** 单人账本里的本人，不对应任何四人座位。 */
export const SOLO_SELF_NAME = '我'

/** 单人记账时的桌面方位，用来比较不同位置的胜率和手气。 */
export const SOLO_SEATS = [
  { value: 'east', label: '东' },
  { value: 'south', label: '南' },
  { value: 'west', label: '西' },
  { value: 'north', label: '北' },
] as const
export type SoloSeat = typeof SOLO_SEATS[number]['value']

export function isSoloSeat(value: unknown): value is SoloSeat {
  return SOLO_SEATS.some((seat) => seat.value === value)
}

export function soloSeatLabel(seat?: SoloSeat): string {
  return SOLO_SEATS.find((item) => item.value === seat)?.label || ''
}

export interface SoloMatchRecord {
  id: string
  playedAt: number
  variant: MatchVariant
  location?: string
  /** 这一场自己坐的方位。不填则不进入位置玄学。 */
  seat?: SoloSeat
  settleUnit: 'score'
  scoreDelta: number
  result: MatchResult
  performance?: MatchPerformance
  reasons?: MatchReason[]
  note?: string
  createdAt: number
  updatedAt: number
  revision?: number
}

/** 单人记录转成仅含本人的牌局，便于复用赛季统计。 */
export function soloToMatchRecord(record: SoloMatchRecord): MatchRecord {
  return {
    id: record.id,
    playedAt: record.playedAt,
    variant: record.variant,
    location: record.location,
    settleUnit: 'score',
    result: deriveMatchResult(record.scoreDelta),
    players: [{ name: SOLO_SELF_NAME, isSelf: true, scoreDelta: record.scoreDelta }],
    performance: record.performance,
    reasons: record.reasons,
    note: record.note,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    revision: record.revision,
  }
}

export interface TablePlayContext {
  tableId: string
  playerName: string
  bindingId: string
  seats: string[]
  role: 'admin' | 'member'
}

/** 按指定座位接纳牌局。不改写名字大小写，供自定义桌子和单人账本使用。 */
export function seatMatchRecords(records: MatchRecord[], seats: readonly string[], selfName: string): MatchRecord[] {
  const expected = seats.map((name) => name.trim())
  if (!expected.length || expected.some((name) => !name) || new Set(expected).size !== expected.length) return []
  return records.flatMap((record) => {
    const accepted = acceptSeatRecord(record, expected, selfName)
    return accepted ? [accepted] : []
  })
}

function acceptSeatRecord(record: MatchRecord, expected: string[], selfName: string): MatchRecord | undefined {
  if (record.settleUnit !== 'score' || !Array.isArray(record.players) || record.players.length !== expected.length) return undefined
  const byName = new Map<string, MatchPlayer>()
  for (const player of record.players) {
    if (!player || typeof player.name !== 'string') return undefined
    const name = player.name.trim()
    if (!expected.includes(name) || byName.has(name)) return undefined
    byName.set(name, { ...player, name, isSelf: name === selfName })
  }
  if (expected.some((name) => !byName.has(name))) return undefined
  const players = expected.map((name) => byName.get(name)!)
  const self = players.find((player) => player.name === selfName)
  if (!self) return undefined
  return { ...record, players, result: deriveMatchResult(getPlayerDelta(self)) }
}

/** 建桌前的本地校验。云函数会再验一次，这里只负责即时提示。 */
export function validateTableDraft(name: string, seats: string[], mySeat: string): string | undefined {
  const tableName = name.trim()
  if (!tableName || [...tableName].length > 16) return '桌名需要 1 到 16 个字'
  const cleaned = seats.map((seat) => seat.trim())
  if (cleaned.length !== 4 || cleaned.some((seat) => !seat || [...seat].length > 12)) return '每个座位名需要 1 到 12 个字'
  if (new Set(cleaned.map((seat) => seat.toLocaleLowerCase('zh-CN'))).size !== 4) return '四个座位名不能重复'
  if (!cleaned.includes(mySeat.trim())) return '请选择自己的座位'
  return undefined
}
