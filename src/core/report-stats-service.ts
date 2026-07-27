import { CHAPTERS } from '../content/chapters'
import {
  calcStreak,
  computeTrainStats,
  localDayKey,
  shiftDay,
  type TrainRecordLike,
  type TrainStats,
} from './train-stats-service'

export interface ReportRecordLike extends TrainRecordLike {
  hit?: boolean
}

export interface SkillStat {
  chapterId: string
  title: string
  shortLabel: string
  /** 本周正确率 0–100；无样本为 null */
  score: number | null
  sampleCount: number
  /** 相对上周正确率差值；无上周样本为 null */
  delta: number | null
}

export interface CalendarDay {
  key: string
  /** 展示用，如 一 / 26 */
  label: string
  weekday: string
  trained: boolean
  isToday: boolean
}

export interface ChapterProgress {
  donePuzzles: number
  totalPuzzles: number
  completedChapters: number
  totalChapters: number
  percent: number
}

export interface WeakestSkill {
  chapterId: string
  title: string
  accuracy: number
  sampleCount: number
}

export interface ReportStats {
  base: TrainStats
  trainDaysTotal: number
  maxStreak: number
  weekDone: number
  weekAccuracy: number
  weekOptimalRate: number
  calendarDays: CalendarDay[]
  skills: SkillStat[]
  weakest: WeakestSkill | null
  chapterProgress: ChapterProgress
  mistakeCount: number
  /** 能力雷达五维 0–100（原始算法） */
  radar: number[]
}

export const RADAR_LABELS = ['拆搭效率', '进张计算', '防守意识', '牌型判断', '定缺策略']

/** 与旧报告页一致的雷达估值 */
export function computeRadarValues(records: ReportRecordLike[]): number[] {
  const total = records.length
  if (total === 0) return [40, 40, 40, 40, 40]
  const hitCount = records.filter((r) => r.hit).length
  const reasonableCount = records.filter((r) => r.reasonable).length
  const base = Math.round((reasonableCount / total) * 100)
  const precision = Math.round((hitCount / total) * 100)
  return [
    Math.min(100, base + 5),
    Math.min(100, precision + 8),
    Math.min(100, Math.max(25, base - 10)),
    Math.min(100, Math.max(30, precision)),
    Math.min(100, Math.max(28, base - 5)),
  ]
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function shortChapterLabel(title: string): string {
  const afterDot = title.split(/[·•]/).pop()?.trim()
  const source = afterDot || title
  return source.charAt(0) || '练'
}

function buildPuzzleChapterMap(): Map<string, string> {
  const map = new Map<string, string>()
  for (const ch of CHAPTERS) {
    for (const id of ch.puzzles) map.set(id, ch.id)
  }
  return map
}

function rateOf(records: ReportRecordLike[]): number | null {
  if (records.length === 0) return null
  const ok = records.filter((r) => r.reasonable).length
  return Math.round((ok / records.length) * 100)
}

function optimalRateOf(records: ReportRecordLike[]): number {
  if (records.length === 0) return 0
  const hit = records.filter((r) => r.hit).length
  return Math.round((hit / records.length) * 100)
}

function inDaySet(r: ReportRecordLike, days: Set<string>): boolean {
  if (typeof r.time !== 'number' || !r.time) return false
  return days.has(localDayKey(new Date(r.time)))
}

function dayWindow(today: string, startOffset: number, endOffset: number): Set<string> {
  const set = new Set<string>()
  for (let i = startOffset; i <= endOffset; i++) {
    set.add(shiftDay(today, i))
  }
  return set
}

/** 任意历史最长连续训练天数 */
export function calcMaxStreak(dayKeys: Set<string>): number {
  if (dayKeys.size === 0) return 0
  const sorted = [...dayKeys].sort()
  let max = 1
  let cur = 1
  for (let i = 1; i < sorted.length; i++) {
    if (shiftDay(sorted[i - 1], 1) === sorted[i]) {
      cur += 1
      max = Math.max(max, cur)
    } else {
      cur = 1
    }
  }
  return max
}

function buildCalendar(dayKeys: Set<string>, today: string, days = 14): CalendarDay[] {
  const list: CalendarDay[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = shiftDay(today, -i)
    const [y, m, d] = key.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    list.push({
      key,
      label: String(d),
      weekday: WEEKDAYS[dt.getDay()],
      trained: dayKeys.has(key),
      isToday: key === today,
    })
  }
  return list
}

function computeChapterProgress(donePuzzleIds: Set<string>): ChapterProgress {
  let donePuzzles = 0
  let totalPuzzles = 0
  let completedChapters = 0
  for (const ch of CHAPTERS) {
    totalPuzzles += ch.puzzles.length
    const doneInCh = ch.puzzles.filter((id) => donePuzzleIds.has(id)).length
    donePuzzles += doneInCh
    if (doneInCh >= ch.puzzles.length && ch.puzzles.length > 0) {
      completedChapters += 1
    }
  }
  return {
    donePuzzles,
    totalPuzzles,
    completedChapters,
    totalChapters: CHAPTERS.length,
    percent: totalPuzzles > 0 ? Math.round((donePuzzles / totalPuzzles) * 100) : 0,
  }
}

function computeSkills(
  records: ReportRecordLike[],
  thisWeek: Set<string>,
  lastWeek: Set<string>,
  puzzleChapter: Map<string, string>
): SkillStat[] {
  return CHAPTERS.map((ch) => {
    const weekRecs = records.filter(
      (r) => r.puzzleId && puzzleChapter.get(r.puzzleId) === ch.id && inDaySet(r, thisWeek)
    )
    const prevRecs = records.filter(
      (r) => r.puzzleId && puzzleChapter.get(r.puzzleId) === ch.id && inDaySet(r, lastWeek)
    )
    const score = rateOf(weekRecs)
    const prev = rateOf(prevRecs)
    return {
      chapterId: ch.id,
      title: ch.title,
      shortLabel: shortChapterLabel(ch.title),
      score,
      sampleCount: weekRecs.length,
      delta: score !== null && prev !== null ? score - prev : null,
    }
  })
}

function pickWeakest(skills: SkillStat[], fallbackAllTime: SkillStat[]): WeakestSkill | null {
  const withSamples = skills.filter((s) => s.sampleCount > 0 && s.score !== null)
  const pool = withSamples.length > 0 ? withSamples : fallbackAllTime.filter((s) => s.sampleCount > 0 && s.score !== null)
  if (pool.length === 0) return null
  const worst = pool.reduce((a, b) => ((a.score ?? 100) <= (b.score ?? 100) ? a : b))
  return {
    chapterId: worst.chapterId,
    title: worst.title,
    accuracy: worst.score ?? 0,
    sampleCount: worst.sampleCount,
  }
}

export function computeReportStats(
  records: ReportRecordLike[] = [],
  options: { mistakeCount?: number } = {}
): ReportStats {
  const base = computeTrainStats(records)
  const today = localDayKey(new Date())
  const thisWeek = dayWindow(today, -6, 0)
  const lastWeek = dayWindow(today, -13, -7)
  const puzzleChapter = buildPuzzleChapterMap()

  const dayKeys = new Set<string>()
  const donePuzzleIds = new Set<string>()
  const weekRecords: ReportRecordLike[] = []

  for (const r of records) {
    if (typeof r.time === 'number' && r.time) {
      dayKeys.add(localDayKey(new Date(r.time)))
    }
    if (r.puzzleId) donePuzzleIds.add(r.puzzleId)
    if (inDaySet(r, thisWeek)) weekRecords.push(r)
  }

  const skills = computeSkills(records, thisWeek, lastWeek, puzzleChapter)

  // 全时段章节正确率（无本周样本时用于薄弱项兜底）
  const allTimeSkills: SkillStat[] = CHAPTERS.map((ch) => {
    const recs = records.filter((r) => r.puzzleId && puzzleChapter.get(r.puzzleId) === ch.id)
    return {
      chapterId: ch.id,
      title: ch.title,
      shortLabel: shortChapterLabel(ch.title),
      score: rateOf(recs),
      sampleCount: recs.length,
      delta: null,
    }
  })

  return {
    base,
    trainDaysTotal: dayKeys.size,
    maxStreak: calcMaxStreak(dayKeys),
    weekDone: weekRecords.length,
    weekAccuracy: rateOf(weekRecords) ?? 0,
    weekOptimalRate: optimalRateOf(weekRecords),
    calendarDays: buildCalendar(dayKeys, today, 14),
    skills,
    weakest: pickWeakest(skills, allTimeSkills),
    chapterProgress: computeChapterProgress(donePuzzleIds),
    mistakeCount: options.mistakeCount ?? 0,
    radar: computeRadarValues(records),
  }
}

export function emptyReportStats(): ReportStats {
  return computeReportStats([], { mistakeCount: 0 })
}
