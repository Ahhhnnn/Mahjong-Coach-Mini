/** 结算单位：积分 / 金额 */
export type SettleUnit = 'score' | 'money'

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
  moneyDelta?: number
}

export interface MatchRecord {
  id: string
  playedAt: number
  variant: MatchVariant
  location?: string
  settleUnit: SettleUnit
  result: MatchResult
  players: MatchPlayer[]
  performance?: MatchPerformance
  reasons?: MatchReason[]
  note?: string
  createdAt: number
  updatedAt: number
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

export function getPlayerDelta(player: MatchPlayer, unit: SettleUnit): number {
  const v = unit === 'score' ? player.scoreDelta : player.moneyDelta
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0
}

export function getSelfPlayer(record: MatchRecord): MatchPlayer | undefined {
  return record.players.find((p) => p.isSelf)
}

export function getSelfDelta(record: MatchRecord): number {
  const self = getSelfPlayer(record)
  if (!self) return 0
  return getPlayerDelta(self, record.settleUnit)
}

export function formatDelta(value: number, unit: SettleUnit): string {
  const suffix = unit === 'score' ? '分' : '元'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}${suffix}`
}
