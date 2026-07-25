import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'

import RadarChart from '../../components/radar-chart'
import { fetchCloudRecords, mergeRecords, type TrainRecord } from '../../core/cloud'

import './index.scss'

const RADAR_LABELS = ['拆搭效率', '进张计算', '防守意识', '牌型判断', '定缺策略']

interface ReportData {
  weekDone: number
  accuracy: number
  optimalRate: number
  total: number
  days: { date: string; count: number }[]
  radar: number[]
}

/** 根据训练记录计算报告数据 */
function computeStats(records: any[]): ReportData {
  const now = Date.now()
  const weekRecords = records.filter((r) => now - r.time < 7 * 86400000)
  const reasonable = weekRecords.filter((r) => r.reasonable).length
  const accuracy =
    weekRecords.length > 0 ? Math.round((reasonable / weekRecords.length) * 100) : 0

  // 最近7天每天的做题数
  const days: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000)
    const key = d.toISOString().slice(5, 10).replace('-', '.')
    const count = records.filter(
      (r) => new Date(r.time).toISOString().slice(0, 10) === d.toISOString().slice(0, 10)
    ).length
    days.push({ date: key, count })
  }

  // 根据训练记录计算能力雷达值
  const total = records.length
  const hitCount = records.filter((r) => r.hit).length
  const reasonableCount = records.filter((r) => r.reasonable).length
  const optimalRate = total > 0 ? Math.round((hitCount / total) * 100) : 0
  const base = total > 0 ? Math.round((reasonableCount / total) * 100) : 35
  const precision = total > 0 ? Math.round((hitCount / total) * 100) : 30
  const radar = [
    Math.min(100, base + 5), // 拆搭效率
    Math.min(100, precision + 8), // 进张计算
    Math.min(100, Math.max(25, base - 10)), // 防守意识
    Math.min(100, Math.max(30, precision)), // 牌型判断
    Math.min(100, Math.max(28, base - 5)), // 定缺策略
  ]

  return {
    weekDone: weekRecords.length,
    accuracy,
    optimalRate,
    total,
    days,
    radar,
  }
}

export default function ReportPage() {
  const [data, setData] = useState<ReportData>({
    weekDone: 0,
    accuracy: 0,
    optimalRate: 0,
    total: 0,
    days: [],
    radar: [40, 40, 40, 40, 40],
  })

  useDidShow(() => {
    // 1. 本地优先：立即用本地数据渲染（快、离线可用）
    let localRecords: TrainRecord[] = []
    try {
      localRecords = Taro.getStorageSync('train_records') || []
      setData(computeStats(localRecords))
    } catch {
      /* ignore */
    }

    // 2. 后台从云端拉取并合并（换设备恢复场景，失败静默）
    fetchCloudRecords().then((cloudRecords) => {
      if (!cloudRecords || cloudRecords.length === 0) return
      const merged = mergeRecords(localRecords, cloudRecords)
      if (merged.length > localRecords.length) {
        // 云端有本地缺失的记录（如换新设备），写回本地并刷新
        try {
          Taro.setStorageSync('train_records', merged.slice(0, 200))
        } catch {
          /* ignore */
        }
        setData(computeStats(merged))
      }
    })
  })

  const maxCount = Math.max(1, ...data.days.map((d) => d.count))

  const goTrain = () => {
    Taro.switchTab({ url: '/pages/puzzles/index' })
  }

  return (
    <View className="report-page">
      {/* 统计概览 */}
      <View className="card overview-card">
        <Text className="card-title">训练报告</Text>
        <Text className="card-subtitle">本周训练数据总览</Text>
        <View className="overview-grid">
          <View className="overview-item">
            <Text className="ov-num">{data.weekDone}</Text>
            <Text className="ov-label">本周题数</Text>
          </View>
          <View className="overview-item">
            <Text className="ov-num">{data.accuracy}%</Text>
            <Text className="ov-label">正确率</Text>
          </View>
          <View className="overview-item">
            <Text className="ov-num">{data.optimalRate}%</Text>
            <Text className="ov-label">最优率</Text>
          </View>
          <View className="overview-item">
            <Text className="ov-num">{data.total}</Text>
            <Text className="ov-label">累计练习</Text>
          </View>
        </View>
      </View>

      {/* 能力雷达 */}
      <View className="card radar-card">
        <Text className="card-title">能力雷达</Text>
        <Text className="card-subtitle">根据近期作答动态评估</Text>
        <View className="radar-wrap">
          <RadarChart values={data.radar} labels={RADAR_LABELS} size={280} />
        </View>
        <View className="radar-legend">
          {RADAR_LABELS.map((label, i) => (
            <View key={label} className="legend-item">
              <Text className="legend-dot" />
              <Text className="legend-label">{label}</Text>
              <Text className="legend-value">{data.radar[i]}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 能力趋势 */}
      <View className="card trend-card">
        <Text className="card-title">能力趋势</Text>
        <Text className="card-subtitle">最近7天做题数量</Text>
        <View className="chart-area">
          {data.days.map((d, i) => (
            <View key={i} className="chart-col">
              <View className="chart-bar-wrap">
                <View className="chart-bar" style={{ height: `${(d.count / maxCount) * 100}%` }} />
              </View>
              <Text className="chart-label">{d.date}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* AI 教练总结 */}
      <View className="card ai-card">
        <View className="ai-header">
          <View className="ai-avatar">
            <Text className="ai-avatar-text">🀄</Text>
          </View>
          <View className="ai-info">
            <Text className="ai-name">AI 教练总结</Text>
            <Text className="ai-status">基于本周训练数据生成</Text>
          </View>
        </View>
        <Text className="ai-summary">
          {data.weekDone > 0
            ? `本周完成 ${data.weekDone} 题，正确率 ${data.accuracy}%。${data.accuracy >= 70 ? '表现优秀，继续保持！建议尝试更高难度的题目。' : '基础拆搭还需要加强，建议每天完成10道基础题，重点关注进张数计算。'}`
            : '本周还没有训练记录。坚持每天练习，牌感提升看得见！'}
        </Text>
        <View className="ai-tips">
          <Text className="tips-title">下周训练建议</Text>
          <Text className="tip-line">· 每天完成 10 道拆搭题</Text>
          <Text className="tip-line">· 重点关注错题本中的题目</Text>
          <Text className="tip-line">· 练习前先复习向听数概念</Text>
        </View>
        <View className="btn-go" onClick={goTrain}>
          <Text className="btn-go-text">去训练</Text>
        </View>
      </View>
    </View>
  )
}
