import Taro from '@tarojs/taro'
import { CHAPTERS } from '../content/chapters'
import type { DiscardPuzzle } from '../content/types'
import type { TrainRecord } from './cloud'

export type MistakeStatus = 'review' | 'reinforce' | 'mastered' | 'repeat'

export type MistakeItem = {
  puzzleId: string
  puzzle: DiscardPuzzle
  errorCount: number
  lastErrorAt: number
  correctStreak: number
  status: MistakeStatus
  chapterId: string
  chapterTitle: string
}

export type MistakeStats = {
  total: number
  mastered: number
  repeat: number
  review: number
  reinforce: number
  masteryRate: number
}

export type MistakeFilters = {
  chapterId?: string | 'all'
  difficulty?: number | 'all'
  timeRange?: 'all' | '7d' | '30d'
}

const STATUS_LABEL: Record<MistakeStatus, string> = {
  review: '待复习',
  reinforce: '待强化',
  mastered: '已掌握',
  repeat: '反复出错',
}

const DIFFICULTY_LABEL: Record<number, string> = {
  1: '简单',
  2: '较易',
  3: '中等',
  4: '较难',
  5: '困难',
}

export function getMistakeStatusLabel(status: MistakeStatus): string {
  return STATUS_LABEL[status]
}

export function getDifficultyLabel(difficulty: number): string {
  return DIFFICULTY_LABEL[difficulty] || `难度${difficulty}`
}

export function findChapterForPuzzle(puzzleId: string): { id: string; title: string } {
  for (const ch of CHAPTERS) {
    if (ch.puzzles.includes(puzzleId)) {
      return { id: ch.id, title: ch.title }
    }
  }
  return { id: '', title: '拆搭训练' }
}

function resolveStatus(errorCount: number, correctStreak: number): MistakeStatus {
  if (correctStreak >= 2) return 'mastered'
  if (correctStreak === 1) return 'reinforce'
  if (errorCount >= 2) return 'repeat'
  return 'review'
}

/** 从 train_records 聚合错题（仅曾 miss 过的题目） */
export function aggregateMistakes(
  records: TrainRecord[],
  puzzles: DiscardPuzzle[]
): MistakeItem[] {
  const puzzleMap = new Map(puzzles.map((p) => [p.id, p]))
  // 按时间正序遍历，便于计算「上次错误后的连续答对」
  const sorted = [...records].filter((r) => r?.puzzleId).sort((a, b) => a.time - b.time)

  type Acc = {
    errorCount: number
    lastErrorAt: number
    correctStreak: number
  }
  const map = new Map<string, Acc>()

  for (const r of sorted) {
    let acc = map.get(r.puzzleId)
    if (!acc) {
      acc = { errorCount: 0, lastErrorAt: 0, correctStreak: 0 }
      map.set(r.puzzleId, acc)
    }
    if (!r.hit) {
      acc.errorCount += 1
      acc.lastErrorAt = r.time
      acc.correctStreak = 0
    } else if (acc.errorCount > 0) {
      // 仅统计「曾错过」之后的连续答对
      acc.correctStreak += 1
    }
  }

  const items: MistakeItem[] = []
  for (const [puzzleId, acc] of map) {
    if (acc.errorCount <= 0) continue
    const puzzle = puzzleMap.get(puzzleId)
    if (!puzzle) continue
    const chapter = findChapterForPuzzle(puzzleId)
    items.push({
      puzzleId,
      puzzle,
      errorCount: acc.errorCount,
      lastErrorAt: acc.lastErrorAt,
      correctStreak: acc.correctStreak,
      status: resolveStatus(acc.errorCount, acc.correctStreak),
      chapterId: chapter.id,
      chapterTitle: chapter.title,
    })
  }

  // 最近出错优先
  return items.sort((a, b) => b.lastErrorAt - a.lastErrorAt)
}

export function getMistakeStats(items: MistakeItem[]): MistakeStats {
  const total = items.length
  const mastered = items.filter((i) => i.status === 'mastered').length
  const repeat = items.filter((i) => i.status === 'repeat').length
  const review = items.filter((i) => i.status === 'review').length
  const reinforce = items.filter((i) => i.status === 'reinforce').length
  return {
    total,
    mastered,
    repeat,
    review,
    reinforce,
    masteryRate: total === 0 ? 0 : Math.round((mastered / total) * 100),
  }
}

export function filterMistakes(items: MistakeItem[], filters: MistakeFilters): MistakeItem[] {
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  return items.filter((item) => {
    if (filters.chapterId && filters.chapterId !== 'all' && item.chapterId !== filters.chapterId) {
      return false
    }
    if (
      filters.difficulty &&
      filters.difficulty !== 'all' &&
      item.puzzle.difficulty !== filters.difficulty
    ) {
      return false
    }
    if (filters.timeRange === '7d' && now - item.lastErrorAt > 7 * dayMs) return false
    if (filters.timeRange === '30d' && now - item.lastErrorAt > 30 * dayMs) return false
    return true
  })
}

/** 读取本地训练记录并聚合错题 */
export function loadMistakes(puzzles: DiscardPuzzle[]): MistakeItem[] {
  try {
    const records: TrainRecord[] = Taro.getStorageSync('train_records') || []
    return aggregateMistakes(records, puzzles)
  } catch {
    return []
  }
}

/** 练习队列：未掌握优先，已掌握排后 */
export function buildPracticeIds(items: MistakeItem[]): string[] {
  const pending = items.filter((i) => i.status !== 'mastered')
  const mastered = items.filter((i) => i.status === 'mastered')
  return [...pending, ...mastered].map((i) => i.puzzleId)
}
