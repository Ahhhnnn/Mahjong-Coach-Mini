import type { SeatGender } from './match-types'
import type { SeatPosition } from './table-seat-layout'

import tableEmpty from '../assets/records/table-empty.png'
import seatTopMale from '../assets/records/seat-top-male.png'
import seatTopFemale from '../assets/records/seat-top-female.png'
import seatLeftMale from '../assets/records/seat-left-male.png'
import seatLeftFemale from '../assets/records/seat-left-female.png'
import seatRightMale from '../assets/records/seat-right-male.png'
import seatRightFemale from '../assets/records/seat-right-female.png'
import seatBottomMale from '../assets/records/seat-bottom-male.png'
import seatBottomFemale from '../assets/records/seat-bottom-female.png'

export const TABLE_EMPTY_IMAGE = tableEmpty

const SEAT_AVATAR_MAP: Record<SeatPosition, Record<SeatGender, string>> = {
  top: { male: seatTopMale, female: seatTopFemale },
  left: { male: seatLeftMale, female: seatLeftFemale },
  right: { male: seatRightMale, female: seatRightFemale },
  bottom: { male: seatBottomMale, female: seatBottomFemale },
}

export function getSeatAvatar(position: SeatPosition, gender: SeatGender): string {
  return SEAT_AVATAR_MAP[position][gender]
}
