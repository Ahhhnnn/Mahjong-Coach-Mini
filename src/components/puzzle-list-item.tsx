import { View, Text } from '@tarojs/components'
import type { ReactNode } from 'react'

import './puzzle-list-item.scss'

export type PuzzleListItemTone = 'red' | 'green'

type Props = {
  index: number
  tone: PuzzleListItemTone
  title: string
  subtitle: string
  meta?: string
  badge?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
}

export function PuzzleListItem({
  index,
  tone,
  title,
  subtitle,
  meta,
  badge,
  trailing,
  onClick,
}: Props) {
  const num = String(index + 1).padStart(2, '0')
  return (
    <View className="puzzle-list-item">
      <View className="pli-main" onClick={onClick}>
        <View className={`pli-index pli-index--${tone}`}>
          <Text className="pli-index-text">{num}</Text>
        </View>
        <View className="pli-body">
          <View className="pli-title-row">
            <Text className="pli-title">{title}</Text>
            {badge}
          </View>
          <Text className="pli-sub">{subtitle}</Text>
          {meta ? <Text className="pli-meta">{meta}</Text> : null}
        </View>
        {!trailing ? <Text className="pli-arrow">›</Text> : null}
      </View>
      {trailing}
    </View>
  )
}
