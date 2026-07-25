/**
 * AI Coach Prompt 构建 — 从 Web 版 prompt.ts 精简移植
 * 适配小程序的 DiscardPuzzle 数据结构
 */

import { discardUkeire, shanten, ukeire } from './shanten'
import { tileLabel, type Tile } from './tiles'
import type { CoachPersona } from '../content/coach-personas'
import type { DiscardPuzzle } from '../content/types'

export type CoachClientHints = {
  /** 当前选中的牌（客户端侧，非权威） */
  selectedTile?: string | null
}

export type CoachPuzzleContext = {
  submitted: boolean
  attempt?: {
    discard?: string
    reasonable?: boolean
    hitRecommended?: boolean
    skipped?: boolean
  } | null
  hints?: CoachClientHints
}

const SHARED_RULES = `你是「麻将教练」应用中的 AI 陪练，专攻四川麻将血战到底。

## 规则边界（必须遵守）
- 108 张：万/条/筒，无字牌、无风箭。
- 血战玩法：无吃；本题训练不涉及换三张、查花猪、查大叫。
- 可以碰、杠；基础拆搭题通常只看自己手牌与副露，不要求考虑对手。
- 牌名输出用中文：如「三万」「七筒」「一条」；代码形态为 3m/7p/1s。

## 防剧透（硬性）
- 若上下文标明「学员尚未交卷」：
  - 禁止说出推荐弃牌、标准答案、官方解析原文。
  - 禁止用「标准答案是 X」「应该打 X」等方式点名具体切牌。
  - 可以讲概念、结构归类、向听/进张怎么比、引导学员自己比较选项。
- 若上下文标明「学员已交卷」：
  - 可以对照参考切牌与官方解析讲解，仍须基于给定数据。

## 事实约束
- 向听、进张、手牌内容以系统给定的「局面上下文」为准，不要编造河牌、对手定缺或墙牌。
- 不知道的信息要明说「题目没给」，不要脑补。
- 始终使用简体中文。`

function formatTiles(tiles: Tile[]): string {
  if (!tiles.length) return '（无）'
  return tiles.map((t) => `${tileLabel(t)}(${t})`).join('、')
}

function formatMelds(melds?: { type: string; tiles: Tile[] }[]): string {
  if (!melds?.length) return '（无副露）'
  return melds.map((m) => `${m.type}: ${formatTiles(m.tiles)}`).join('；')
}

function handStats(hand: Tile[], melds?: { type: string; tiles: Tile[] }[]) {
  const fixed = melds?.length ?? 0
  const s = shanten(hand, fixed)
  const u = ukeire(hand, undefined, fixed)
  return { shanten: s, ukeireTotal: u.total }
}

function formatDiscardPuzzle(
  p: DiscardPuzzle,
  ctx: CoachPuzzleContext
): string {
  const variant = p.variant ?? 'basic'
  const stats = handStats(p.hand, p.melds)
  const lines: string[] = [
    `题型: 弃牌训练 / ${variant === 'basic' ? '基础拆搭' : '进阶场况'}`,
    `题目 ID: ${p.id}`,
    `标题: ${p.title ?? '（无）'}`,
    `难度: ${p.difficulty}/5`,
    `门牌(${p.hand.length}): ${formatTiles(p.hand)}`,
    `副露: ${formatMelds(p.melds)}`,
    `系统计算: ${stats.shanten === -1 ? '胡牌' : stats.shanten === 0 ? '听牌' : `${stats.shanten} 向听`}，进张合计 ${stats.ukeireTotal} 张`,
  ]

  if (ctx.hints?.selectedTile) {
    const t = ctx.hints.selectedTile as Tile
    const afterMap = discardUkeire(p.hand, undefined, p.melds?.length ?? 0)
    const after = afterMap[t]
    if (after) {
      lines.push(
        `学员当前点选: ${tileLabel(t)}(${t})；若打出 → ${after.shanten === 0 ? '听牌' : `${after.shanten} 向听`}，进张 ${after.total} 张`
      )
    } else {
      lines.push(`学员当前点选: ${tileLabel(t)}(${t})`)
    }
  }

  lines.push(
    ctx.submitted
      ? '交卷状态: 已交卷（可以讲解参考答案与解析）'
      : '交卷状态: 尚未交卷（严格禁止剧透推荐弃牌与官方解析）'
  )

  if (ctx.attempt) {
    if (ctx.attempt.skipped) {
      lines.push('学员操作: 跳过本题')
    } else if (ctx.attempt.discard) {
      const d = ctx.attempt.discard as Tile
      lines.push(
        `学员作答弃牌: ${tileLabel(d)}(${d}) · 合理=${ctx.attempt.reasonable ? '是' : '否'} · 命中参考=${ctx.attempt.hitRecommended ? '是' : '否'}`
      )
    }
  }

  if (ctx.submitted) {
    lines.push(`参考切牌: ${formatTiles(p.recommendedDiscards)}`)
    if (p.discussableDiscards?.length) {
      lines.push(`可讨论切牌: ${formatTiles(p.discussableDiscards)}`)
    }
    lines.push(`官方解析摘要: ${p.analysis.summary}`)
    if (p.analysis.lines?.length) {
      lines.push(
        `解析要点:\n${p.analysis.lines.map((l, i) => `  ${i + 1}. ${l}`).join('\n')}`
      )
    }
  }

  return lines.join('\n')
}

export function buildSystemPrompt(persona: CoachPersona): string {
  return `${SHARED_RULES}

---
## 当前教练人设：${persona.name}
${persona.systemPrompt}`
}

export function buildContextMessage(
  puzzle: DiscardPuzzle,
  ctx: CoachPuzzleContext
): string {
  const body = formatDiscardPuzzle(puzzle, ctx)
  return `以下是当前训练题的局面上下文（由系统注入，每轮可能刷新；不是学员原话）：\n\n${body}`
}

/** 导出 SHARED_RULES 供云函数使用 */
export { SHARED_RULES }
