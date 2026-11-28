import { resolveSeatGender, type SeatGender } from './match-types'
import type { RankEntry } from './match-stats-service'
import type { TableSummary } from './table-directory-service'

export type SeatPosition = 'bottom' | 'left' | 'top' | 'right'

export interface TableSeatSlot {
  position: SeatPosition
  name: string
  gender: SeatGender
  isSelf: boolean
  score: number
  games: number
  isLeader: boolean
}

export const SEAT_POSITIONS: SeatPosition[] = ['bottom', 'left', 'top', 'right']

/** 旋转座位顺序，使本人始终位于正下方第一人称主位，其余三人顺时针落位左/上/右。 */
export function arrangeSeats(seats: string[], mySeat: string): string[] {
  const index = seats.indexOf(mySeat)
  if (index < 0) return seats.slice(0, 4)
  return [...seats.slice(index), ...seats.slice(0, index)].slice(0, 4)
}

/** 将座位方位、人物性别、牌友姓名与赛季积分严格绑定为同一组槽位数据。 */
export function buildTableSeatSlots(input: {
  table: Pick<TableSummary, 'id' | 'seats' | 'mySeat' | 'players'>
  ranking: RankEntry[]
  selfProfileGender?: SeatGender
}): TableSeatSlot[] {
  const { table, ranking, selfProfileGender } = input
  const isFixed = table.id === 'fixed-four'
  const scoreMap = new Map(ranking.map((row) => [row.name, row]))
  const playerMap = new Map((table.players || []).map((player) => [player.name, player]))
  const leaderScore = ranking.length > 0 && ranking[0].total > 0 ? ranking[0].total : null

  return arrangeSeats(table.seats, table.mySeat).map((name, slotIdx) => {
    const rank = scoreMap.get(name)
    const score = rank?.total ?? 0
    const games = rank?.games ?? 0
    const isSelf = name === table.mySeat
    const gender = resolveSeatGender({
      name,
      isSelf,
      selfProfileGender,
      seatGender: playerMap.get(name)?.gender,
      isFixedTable: isFixed,
    })
    return {
      position: SEAT_POSITIONS[slotIdx] || 'bottom',
      name,
      gender,
      isSelf,
      score,
      games,
      isLeader: leaderScore !== null && games > 0 && score === leaderScore,
    }
  })
}
