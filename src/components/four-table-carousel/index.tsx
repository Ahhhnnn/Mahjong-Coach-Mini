import { useEffect, useState } from 'react'
import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@taroify/core'
import { Arrow, Award, Plus } from '@taroify/icons'
import { evaluateMatchBadges } from '../../core/match-badge-service'
import { listMatches } from '../../core/match-service'
import { computeMatchStats, type MatchSeason } from '../../core/match-stats-service'
import { formatDelta } from '../../core/match-types'
import { getSeatAvatar, TABLE_EMPTY_IMAGE } from '../../core/table-avatar-assets'
import { tableContext, type TableSummary } from '../../core/table-directory-service'
import { getCachedUser } from '../../core/table-identity-service'
import { buildTableSeatSlots } from '../../core/table-seat-layout'
import './index.scss'

export interface FourTableCarouselProps {
  season: MatchSeason
  seasonLabel: string
  seasonShort: string
  tables: TableSummary[]
}

export default function FourTableCarousel({ season, seasonLabel, seasonShort, tables }: FourTableCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (activeIndex >= tables.length && tables.length > 0) {
      setActiveIndex(0)
    }
  }, [activeIndex, tables.length])

  const openTable = (tableId: string) => {
    Taro.navigateTo({ url: `/pages/table/index?id=${encodeURIComponent(tableId)}` })
  }

  const goCreate = () => {
    Taro.navigateTo({ url: '/pages/table-create/index' })
  }

  if (!tables.length) {
    return (
      <View className="four-carousel-empty">
        <View className="four-empty-card">
          <Text className="four-empty-title">还没有入座</Text>
          <Text className="four-empty-desc">可以新建一张四人牌桌，或用邀请码加入朋友的桌子。</Text>
          <Button color="primary" shape="round" onClick={goCreate}>添加桌子</Button>
        </View>
      </View>
    )
  }

  const selfProfileGender = getCachedUser()?.gender

  const renderTableCard = (table: TableSummary, index: number, inSwiper: boolean) => {
    const isFixed = table.id === 'fixed-four'
    const ctx = isFixed ? undefined : tableContext(table)
    const records = listMatches(ctx)
    const stats = computeMatchStats(records, {
      season,
      playerName: table.mySeat,
      seats: isFixed ? undefined : table.seats,
    })
    const mineBadges = evaluateMatchBadges(records, table.mySeat, isFixed ? undefined : table.seats)
      .filter((badge) => badge.unlockedAt).length

    const slots = buildTableSeatSlots({
      table,
      ranking: stats.ranking,
      selfProfileGender,
    })
    const topSlot = slots.find((slot) => slot.position === 'top')
    const leftSlot = slots.find((slot) => slot.position === 'left')
    const rightSlot = slots.find((slot) => slot.position === 'right')
    const bottomSlot = slots.find((slot) => slot.position === 'bottom')

    const claimedCount = isFixed
      ? table.seats.length
      : table.players.filter((player) => player.claimed).length
    const isDimmed = inSwiper && index !== activeIndex

    return (
      <View
        className={`four-table-card ${isDimmed ? 'is-dimmed' : ''}`}
        onClick={() => openTable(table.id)}
        role="button"
        aria-label={`进入${table.name}查看四人战绩`}
      >
        <View className="four-card-head">
          <View className={`four-table-tag ${isFixed ? 'is-fixed' : ''}`}>
            <Text className="four-table-tag-text">
              {isFixed ? '固定牌桌' : table.inviteCode ? `邀请码 ${table.inviteCode}` : '自建牌桌'}
            </Text>
          </View>
          <Text className="four-table-season">{seasonLabel}</Text>
        </View>

        <View className="four-table-stage">
          <Image className="four-table-bg" src={TABLE_EMPTY_IMAGE} mode="aspectFit" />

          {topSlot && (
            <Image
              className="four-seat-avatar avatar-top"
              src={getSeatAvatar('top', topSlot.gender)}
              mode="aspectFit"
            />
          )}
          {leftSlot && (
            <Image
              className="four-seat-avatar avatar-left"
              src={getSeatAvatar('left', leftSlot.gender)}
              mode="aspectFit"
            />
          )}
          {rightSlot && (
            <Image
              className="four-seat-avatar avatar-right"
              src={getSeatAvatar('right', rightSlot.gender)}
              mode="aspectFit"
            />
          )}

          <View className="four-self-halo" />
          {bottomSlot && (
            <Image
              className="four-seat-avatar avatar-bottom"
              src={getSeatAvatar('bottom', bottomSlot.gender)}
              mode="aspectFit"
            />
          )}

          <View className="four-center-plaque">
            <Text className="four-plaque-name">{table.name}</Text>
            <Text className="four-plaque-meta">
              {stats.total > 0 ? `${seasonShort} · ${stats.total}场` : `${seasonShort} · 暂无对局`}
            </Text>
            <View className="four-plaque-cta">
              <Text className="four-plaque-cta-text">点击看战绩</Text>
              <Arrow size={11} color="#2c2414" />
            </View>
          </View>

          {slots.map((slot) => (
            <View
              key={slot.name}
              className={`four-seat-badge pos-${slot.position} ${slot.isSelf ? 'is-self' : ''}`}
            >
              {slot.isLeader && (
                <View className="four-seat-crown">
                  <Award size={12} color="#b8841f" />
                </View>
              )}
              <Text className="four-seat-name">
                {slot.isSelf ? `我 · ${slot.name}` : slot.name}
              </Text>
              <Text className={`four-seat-score ${slot.score > 0 ? 'pos' : slot.score < 0 ? 'neg' : 'zero'}`}>
                {formatDelta(slot.score)}
              </Text>
            </View>
          ))}
        </View>

        <View className="four-card-foot">
          <Text className="four-foot-meta">{mineBadges} 枚本桌荣誉</Text>
          <Text className="four-foot-right">
            {isFixed ? `${table.seats.length}/${table.seats.length} 已入座` : `${claimedCount}/${table.seats.length} 已入座`}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View className="four-carousel-wrap">
      {tables.length === 1 ? (
        <View className="four-single-wrap">
          {renderTableCard(tables[0], 0, false)}
        </View>
      ) : (
        <>
          <Swiper
            className="four-table-swiper"
            current={activeIndex}
            previousMargin="24rpx"
            nextMargin="58rpx"
            duration={280}
            onChange={(event) => setActiveIndex(event.detail.current)}
          >
            {tables.map((table, index) => (
              <SwiperItem key={table.id} className="four-swiper-item">
                {renderTableCard(table, index, true)}
              </SwiperItem>
            ))}
          </Swiper>
          <View className="four-carousel-dots">
            <View className="four-dots-track">
              {tables.map((table, index) => (
                <View key={table.id} className={`four-dot ${index === activeIndex ? 'active' : ''}`} />
              ))}
            </View>
            <Text className="four-dots-hint">左右滑动切换牌桌 ({activeIndex + 1}/{tables.length})</Text>
          </View>
        </>
      )}

      <View className="four-add-entry" onClick={goCreate} role="button">
        <Plus size={14} color="#1a5c2e" />
        <Text className="four-add-entry-text">添加桌子或输入邀请码</Text>
      </View>
    </View>
  )
}
