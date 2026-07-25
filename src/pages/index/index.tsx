import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'

import type { DiscardPuzzle } from '../../content/types'
import { getCachedPuzzles, loadPuzzles } from '../../core/puzzle-service'

import './index.scss'

export default function DashboardPage() {
  const [puzzles, setPuzzles] = useState<DiscardPuzzle[]>(getCachedPuzzles())
  const [stats, setStats] = useState({
    todayDone: 0,
    todayGoal: 10,
    streak: 0,
    total: 0,
    donePuzzles: 0,
    accuracy: 0,
  })

  useDidShow(() => {
    loadPuzzles().then(setPuzzles)
    try {
      const records = Taro.getStorageSync('train_records') || []
      const today = new Date().toISOString().slice(0, 10)
      const todayRecords = records.filter(
        (r: any) => new Date(r.time).toISOString().slice(0, 10) === today
      )
      const daySet = new Set(records.map((r: any) => new Date(r.time).toISOString().slice(0, 10)))
      const reasonable = records.filter((r: any) => r.reasonable).length
      setStats({
        todayDone: todayRecords.length,
        todayGoal: 10,
        streak: daySet.size,
        total: records.length,
        donePuzzles: new Set(records.map((r: any) => r.puzzleId)).size,
        accuracy: records.length > 0 ? Math.round((reasonable / records.length) * 100) : 0,
      })
    } catch { /* ignore */ }
  })

  const startTraining = () => {
    Taro.switchTab({ url: '/pages/puzzles/index' })
  }


  const progress = Math.min(100, (stats.donePuzzles / puzzles.length) * 100)

  return (
    <View className="dashboard-page">
      {/* 品牌头部 */}
      <View className="brand-header">
        <View className="brand-left">
          <Text className="brand-name">Mahjong Coach</Text>
          <Text className="brand-sub">Mahjong Coach</Text>
        </View>
        <View className="training-status">
          <Text className="status-text">训练中 · 第{stats.donePuzzles + 1}题 / 共{puzzles.length}题</Text>
        </View>
      </View>

      {/* 今日训练卡片 */}
      <View className="card today-card">
        <View className="card-title-row">
          <Text className="card-title">今日训练</Text>
          <Text className="card-subtitle">每日练习推荐题型</Text>
        </View>
        <View className="today-stats">
          <View className="today-stat">
            <Text className="stat-num">{stats.todayDone}/{stats.todayGoal}</Text>
            <Text className="stat-label">今日题数</Text>
          </View>
          <View className="today-stat">
            <Text className="stat-num">{stats.streak}天</Text>
            <Text className="stat-label">连续训练</Text>
          </View>
          <View className="today-stat">
            <Text className="stat-num">{stats.total}题</Text>
            <Text className="stat-label">累计练习</Text>
          </View>
        </View>
      </View>

      {/* 能力雷达卡片 */}
      <View className="card radar-card">
        <View className="card-title-row">
          <Text className="card-title">能力雷达</Text>
          <Text className="card-subtitle">基础能力 · 进阶判断 · 策略记忆</Text>
        </View>
        <View className="radar-placeholder">
          <View className="radar-shape">
            <Text className="radar-center">{stats.accuracy}%</Text>
            <Text className="radar-center-label">综合正确率</Text>
          </View>
          <View className="radar-dims">
            <View className="dim-item"><Text className="dim-dot" />拆搭效率</View>
            <View className="dim-item"><Text className="dim-dot" />进张计算</View>
            <View className="dim-item"><Text className="dim-dot" />防守意识</View>
          </View>
        </View>
      </View>

      {/* 训练统计卡片 */}
      <View className="card progress-card">
        <View className="card-title-row">
          <Text className="card-title">训练统计</Text>
          <Text className="card-subtitle">记录成长轨迹</Text>
        </View>
        <View className="progress-info">
          <Text className="progress-label">基础拆搭训练</Text>
          <Text className="progress-count">{stats.donePuzzles}/{puzzles.length}</Text>
        </View>
        <View className="progress-bar">
          <View className="progress-fill" style={{ width: `${progress}%` }} />
        </View>
        <View className="progress-actions">
          <View className="btn-start" onClick={startTraining}>
            <Text className="btn-start-text">开始训练</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
