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
