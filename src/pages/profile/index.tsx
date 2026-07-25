import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'

import puzzlesData from '../../content/puzzles.json'
import type { DiscardPuzzle } from '../../content/types'

import './index.scss'

const puzzles = puzzlesData as DiscardPuzzle[]

export default function ProfilePage() {
  const [stats, setStats] = useState({
    total: 0,
    reasonable: 0,
    days: 0,
    xp: 0,
    level: 1,
    mistakes: [] as { puzzle: DiscardPuzzle; time: number }[],
  })

  useDidShow(() => {
    try {
      const records = Taro.getStorageSync('train_records') || []
      const days = new Set(records.map((r: any) => new Date(r.time).toISOString().slice(0, 10))).size
      const reasonable = records.filter((r: any) => r.reasonable).length
      const xp = records.reduce((s: number, r: any) => s + (r.reasonable ? 10 : 3), 0)

      const wrongRecords = records.filter((r: any) => !r.hit && !r.skipped)
      const seen = new Set<string>()
      const mistakes: { puzzle: DiscardPuzzle; time: number }[] = []
      for (const r of wrongRecords) {
        if (seen.has(r.puzzleId)) continue
        seen.add(r.puzzleId)
        const p = puzzles.find((pp) => pp.id === r.puzzleId)
        if (p) mistakes.push({ puzzle: p, time: r.time })
      }

      setStats({ total: records.length, reasonable, days, xp, level: Math.max(1, Math.floor(xp / 100) + 1), mistakes: mistakes.slice(0, 5) })
    } catch { /* ignore */ }
  })

  const goTrain = (puzzleId: string) => {
    const idx = puzzles.findIndex((p) => p.id === puzzleId)
    if (idx >= 0) Taro.navigateTo({ url: `/pages/train/index?index=${idx}` })
  }

  const levelProgress = (stats.xp % 100) / 100 * 100

  return (
    <View className="profile-page">
      {/* 个人信息头部 */}
      <View className="profile-header">
        <View className="avatar">
          <Text className="avatar-text">🀄</Text>
        </View>
        <View className="user-info">
          <Text className="nickname">麻将学员</Text>
          <View className="level-row">
            <Text className="level-tag">Lv.{stats.level} 川麻入门</Text>
            <Text className="xp-text">{stats.xp % 100}/100</Text>
          </View>
          <View className="level-bar">
            <View className="level-fill" style={{ width: `${levelProgress}%` }} />
          </View>
        </View>
      </View>

      {/* 数据概览 */}
      <View className="stats-card">
        <View className="stat-item">
          <Text className="stat-num">{stats.total}</Text>
          <Text className="stat-label">总练习</Text>
        </View>
        <View className="stat-item">
          <Text className="stat-num">{stats.reasonable}</Text>
          <Text className="stat-label">正确数</Text>
        </View>
        <View className="stat-item">
          <Text className="stat-num">{stats.days}</Text>
          <Text className="stat-label">训练天数</Text>
        </View>
        <View className="stat-item">
          <Text className="stat-num">{stats.xp}</Text>
          <Text className="stat-label">我的积分</Text>
        </View>
      </View>

      {/* 错题本 */}
      <View className="section-card">
        <View className="section-header">
          <Text className="section-title">错题本</Text>
          <Text className="section-extra">{stats.mistakes.length} 题</Text>
        </View>
        {stats.mistakes.length === 0 ? (
          <Text className="section-empty">暂无错题，继续加油！</Text>
        ) : (
          stats.mistakes.map((m) => (
            <View key={m.puzzle.id} className="list-item" onClick={() => goTrain(m.puzzle.id)}>
              <View className="item-info">
                <Text className="item-title">{m.puzzle.title || '拆搭训练'}</Text>
                <Text className="item-sub">基础拆搭 · {new Date(m.time).toLocaleDateString()}</Text>
              </View>
              <Text className="item-arrow">›</Text>
            </View>
          ))
        )}
      </View>

      {/* 功能菜单 */}
      <View className="section-card">
        <View className="section-header">
          <Text className="section-title">常用功能</Text>
        </View>
        <View className="list-item">
          <Text className="item-title">收藏题库</Text>
          <Text className="item-arrow">›</Text>
        </View>
        <View className="list-item">
          <Text className="item-title">个性化设置</Text>
          <Text className="item-arrow">›</Text>
        </View>
        <View className="list-item">
          <Text className="item-title">帮助与反馈</Text>
          <Text className="item-arrow">›</Text>
        </View>
        <View className="list-item">
          <Text className="item-title">关于 Mahjong Coach</Text>
          <Text className="item-arrow">›</Text>
        </View>
      </View>
    </View>
  )
}
