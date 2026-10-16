import { useEffect, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { Button, Popup, Progress, Transition } from '@taroify/core'
import { Award, Fire, FlagOutlined, Lock, Star } from '@taroify/icons'
import {
  getPendingBadgeIds, markBadgesSeen, RARITY_LABELS, type MatchBadgeView,
} from '../core/match-badge-service'
import './match-badge-wall.scss'

function Medal({ badge, large = false }: { badge: MatchBadgeView; large?: boolean }) {
  const Icon = { award: Award, fire: Fire, star: Star, flag: FlagOutlined }[badge.symbol]
  return (
    <View className={`honor-medal rarity-${badge.rarity} ${large ? 'large' : ''} ${badge.unlockedAt ? 'earned' : 'locked'}`}>
      <View className="medal-ribbon ribbon-left" /><View className="medal-ribbon ribbon-right" />
      <View className="medal-face"><View className="medal-inner"><Icon size={large ? 52 : 28} /></View></View>
      <View className="medal-glint" />
    </View>
  )
}

export default function MatchBadgeWall({ badges }: { badges: MatchBadgeView[] }) {
  const [selectedId, setSelectedId] = useState<string>()
  const [celebration, setCelebration] = useState<string[]>([])
  const [celebrationIndex, setCelebrationIndex] = useState(0)
  const offered = useRef(new Set<string>())
  const unlocked = badges.filter((b) => b.unlockedAt).length
  const sorted = [...badges].sort((a, b) => Number(!!b.unlockedAt) - Number(!!a.unlockedAt))
  const activeId = celebration[celebrationIndex] || selectedId
  const selected = badges.find((b) => b.id === activeId)
  const celebrating = celebration.length > 0
  useEffect(() => {
    if (!badges.length) return
    const pending = getPendingBadgeIds().filter((id) => !offered.current.has(id) && badges.some((b) => b.id === id))
    if (pending.length) {
      pending.forEach((id) => offered.current.add(id))
      setCelebration((existing) => [...existing, ...pending])
    }
  }, [badges])
  const close = () => {
    if (celebration.length) markBadgesSeen(celebration)
    setCelebration([])
    setCelebrationIndex(0)
    setSelectedId(undefined)
  }
  const next = () => {
    if (celebrationIndex < celebration.length - 1) setCelebrationIndex((i) => i + 1)
    else close()
  }
  return (
    <View className="honor-section">
      <View className="honor-heading">
        <View><Text className="honor-eyebrow">HALL OF HONORS</Text><Text className="honor-title">我的荣誉</Text></View>
        <Text className="honor-count">{unlocked}<Text className="honor-count-total"> / {badges.length}</Text></Text>
      </View>
      <Text className="honor-intro">每一场，都是进阶的印记 · 生涯积分荣誉</Text>
      <View className="honor-grid">
        {sorted.map((badge, index) => (
          <View key={badge.id} className={`honor-card rarity-${badge.rarity} ${badge.unlockedAt ? 'is-earned' : 'is-locked'}`}
            style={{ animationDelay: `${Math.min(index, 7) * 45}ms` }} onClick={() => setSelectedId(badge.id)}>
            <View className="honor-card-top">
              <Medal badge={badge} />
              <Text className="honor-rarity">{RARITY_LABELS[badge.rarity]}</Text>
              {!badge.unlockedAt && <View className="honor-lock"><Lock size={13} /></View>}
            </View>
            <Text className="honor-name">{badge.name}</Text>
            <Text className="honor-description">{badge.description}</Text>
            <View className="honor-progress">
              <Progress percent={badge.unlockedAt ? 100 : badge.progress} label={false} color="warning" />
              <Text className="honor-progress-label">{badge.unlockedAt ? '已解锁 · 点击鉴赏' : badge.progressLabel}</Text>
            </View>
          </View>
        ))}
      </View>
      <Popup className="honor-popup" open={!!selected} rounded onClose={close}>
        <Popup.Backdrop />
        {selected && (
          <View key={`${selected.id}-${celebrating}`} className={`honor-detail rarity-${selected.rarity} ${celebrating ? 'celebrating' : ''}`}>
            <View className="honor-detail-glow" />
            {celebrating && <View className="honor-sparkles">{Array.from({ length: 12 }, (_, i) => (
              <View key={i} className="honor-spark" style={{ transform: `rotate(${i * 30}deg)`, animationDelay: `${i % 3 * 60}ms` }}><View /></View>
            ))}</View>}
            <Text className="honor-detail-eyebrow">{celebrating ? `荣誉解锁 · ${celebrationIndex + 1} / ${celebration.length}` : '你的牌桌勋章'}</Text>
            <View className="honor-detail-medal"><Medal badge={selected} large /></View>
            <Transition in appear name="fade" timeout={500}>
              <View>
                <Text className="honor-detail-title">{selected.name}</Text>
                <Text className="honor-detail-rarity">{RARITY_LABELS[selected.rarity]}荣誉</Text>
                <Text className="honor-detail-description">{selected.description}</Text>
              </View>
            </Transition>
            <Text className="honor-detail-status">{selected.unlockedAt
              ? `已于 ${new Date(selected.unlockedAt).getFullYear()}/${new Date(selected.unlockedAt).getMonth() + 1}/${new Date(selected.unlockedAt).getDate()} 解锁`
              : selected.progressLabel}</Text>
            <Button block shape="round" className="honor-detail-button" onClick={celebrating ? next : close}>
              {celebrating && celebrationIndex < celebration.length - 1 ? '查看下一枚' : celebrating ? '收下荣誉' : '继续我的牌程'}
            </Button>
          </View>
        )}
      </Popup>
    </View>
  )
}
