import Taro from '@tarojs/taro'

export interface TrainRecordLike {
  puzzleId?: string
  reasonable?: boolean
  time?: number
}

export interface TrainStats {
  todayDone: number
  todayGoal: number
  streak: number
  total: number
  donePuzzles: number
  accuracy: number
  xp: number
  level: number
  /** 本级经验 0–99 */
  levelXp: number
  /** 本级上限 */
  levelXpMax: number
  levelTitle: string
}

const TODAY_GOAL = 10
const XP_PER_LEVEL = 100

function localDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  return localDayKey(dt)
}

/** 连续训练天数：从今天起向前数有记录的自然日；若今天无记录则从昨天起算 */
export function calcStreak(dayKeys: Set<string>, today = localDayKey(new Date())): number {
  let cursor = today
  if (!dayKeys.has(cursor)) {
    cursor = shiftDay(today, -1)
    if (!dayKeys.has(cursor)) return 0
  }
  let streak = 0
  while (dayKeys.has(cursor)) {
    streak += 1
    cursor = shiftDay(cursor, -1)
  }
  return streak
}

export function getLevelTitle(level: number): string {
  if (level <= 1) return '新手'
  if (level <= 3) return '川麻入门'
  if (level <= 6) return '进阶'
  return '高手'
}

export function getTrainRecords(): TrainRecordLike[] {
  try {
    return (Taro.getStorageSync('train_records') as TrainRecordLike[]) || []
  } catch {
    return []
  }
}

export function computeTrainStats(records: TrainRecordLike[] = getTrainRecords()): TrainStats {
  const today = localDayKey(new Date())
  const dayKeys = new Set<string>()
  let todayDone = 0
  let reasonable = 0
  let xp = 0
  const puzzleIds = new Set<string>()

  for (const r of records) {
    const t = typeof r.time === 'number' ? r.time : 0
    if (t) {
      const localKey = localDayKey(new Date(t))
      dayKeys.add(localKey)
      if (localKey === today) todayDone += 1
    }
    if (r.reasonable) {
      reasonable += 1
      xp += 10
    } else {
      xp += 3
    }
    if (r.puzzleId) puzzleIds.add(r.puzzleId)
  }

  const total = records.length
  const level = Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1)
  const levelXp = xp % XP_PER_LEVEL

  return {
    todayDone,
    todayGoal: TODAY_GOAL,
    streak: calcStreak(dayKeys, today),
    total,
    donePuzzles: puzzleIds.size,
    accuracy: total > 0 ? Math.round((reasonable / total) * 100) : 0,
    xp,
    level,
    levelXp,
    levelXpMax: XP_PER_LEVEL,
    levelTitle: getLevelTitle(level),
  }
}
