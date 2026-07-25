import type { Tile } from './tiles'
import { discardUkeire } from './shanten'
import type { DiscardPuzzle } from '../content/types'

export type ScoreTier = 'excellent' | 'good' | 'poor'

export interface ScoreResult {
  score: number
  tier: ScoreTier
  /** 打出所选牌后的向听数 */
  myShanten: number
  /** 打出所选牌后的进张数 */
  myUkeire: number
  /** 理论最优向听数 */
  bestShanten: number
  /** 理论最优进张数（最优向听数下的最大进张） */
  bestUkeire: number
}

/**
 * 基于真实牌效（向听数 + 进张数）为打出的一张牌打分。
 *
 * 评分原则（确定、无随机，相同答案永远同分）：
 * 1. 向听数越低越好（越接近听牌）——这是首要指标
 * 2. 同向听数下，进张数越多越好——这是次要指标
 *
 * - 最优解（推荐弃牌 / 达到理论最优牌效）：100 分
 * - 向听数最优但进张略少：80~99 分
 * - 向听数慢一步（+1）：60~74 分（可讨论）
 * - 向听数更差：20~50 分（非最优）
 */
export function scoreDiscard(
  puzzle: DiscardPuzzle,
  selectedTile: Tile,
  fixedMelds: number
): ScoreResult {
  // 打出每张牌后的牌效
  const evalMap = discardUkeire(puzzle.hand, undefined, fixedMelds)

  // 理论最优：最低向听数 + 该向听数下的最大进张数
  let bestShanten = Infinity
  let bestUkeire = 0
  for (const key of Object.keys(evalMap) as Tile[]) {
    const e = evalMap[key]
    if (e.shanten < bestShanten) {
      bestShanten = e.shanten
      bestUkeire = e.total
    } else if (e.shanten === bestShanten && e.total > bestUkeire) {
      bestUkeire = e.total
    }
  }

  const my = evalMap[selectedTile] ?? {
    shanten: bestShanten + 9,
    total: 0,
    waits: {},
  }
  const myShanten = my.shanten
  const myUkeire = my.total

  const isRecommended = puzzle.recommendedDiscards.includes(selectedTile)

  let score: number
  let tier: ScoreTier

  if (isRecommended || (myShanten === bestShanten && myUkeire >= bestUkeire)) {
    // 最优解：推荐弃牌，或达到理论最优牌效
    score = 100
    tier = 'excellent'
  } else if (myShanten === bestShanten) {
    // 向听数最优，但进张数少于最优 → 按进张比例给分
    const ratio = bestUkeire > 0 ? myUkeire / bestUkeire : 1
    score = Math.round(80 + 19 * ratio) // 80~99
    tier = ratio >= 0.85 ? 'excellent' : 'good'
  } else if (myShanten === bestShanten + 1) {
    // 慢一步（向听数 +1），仍可讨论
    score = 60 + Math.min(14, Math.round(myUkeire / 2)) // 60~74
    tier = 'good'
  } else {
    // 向听数更差，非最优
    score = Math.max(20, 50 - (myShanten - bestShanten) * 12)
    tier = 'poor'
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    tier,
    myShanten,
    myUkeire,
    bestShanten,
    bestUkeire,
  }
}
