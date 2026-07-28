import { useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button } from '@taroify/core'
import { Plus } from '@taroify/icons'

import MatchTrendChart from '../../components/match-trend-chart'
import {
  getPreferUnit,
  listMatches,
  setPreferUnit,
  syncCloudMatchesToLocal,
} from '../../core/match-service'
import {
  computeMatchStats,
  type StatsRange,
  type TrendSpan,
} from '../../core/match-stats-service'
import { formatDelta, type SettleUnit } from '../../core/match-types'
import { isLoggedIn } from '../../core/auth'

import './index.scss'

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'quarter', label: '本季' },
  { value: 'year', label: '本年' },
  { value: 'all', label: '全部' },
]

const SPAN_OPTIONS: { value: TrendSpan; label: string }[] = [
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'quarter', label: '季度' },
  { value: 'half', label: '半年' },
  { value: 'year', label: '年度' },
]

export default function RecordsPage() {
  const [range, setRange] = useState<StatsRange>('month')
  const [trendSpan, setTrendSpan] = useState<TrendSpan>('week')
  const [unit, setUnit] = useState<SettleUnit>(getPreferUnit())
  const [tick, setTick] = useState(0)
  // const [showAiSheet, setShowAiSheet] = useState(false)

  useDidShow(() => {
    setUnit(getPreferUnit())
    setTick((t) => t + 1)
    if (isLoggedIn()) {
      syncCloudMatchesToLocal().then((n) => {
        if (n > 0) setTick((t) => t + 1)
      })
    }
  })

  const records = useMemo(() => listMatches(), [tick])
  const stats = useMemo(
    () => computeMatchStats(records, { range, trendSpan, unit }),
    [records, range, trendSpan, unit]
  )

  const goEdit = (id?: string) => {
    const url = id ? `/pages/record-edit/index?id=${id}` : '/pages/record-edit/index'
    Taro.navigateTo({ url })
  }

  const onPickRange = () => {
    Taro.showActionSheet({
      itemList: RANGE_OPTIONS.map((o) => o.label),
      success: (res) => {
        const opt = RANGE_OPTIONS[res.tapIndex]
        if (opt) setRange(opt.value)
      },
    }).catch(() => {})
  }

  const switchUnit = () => {
    const next: SettleUnit = unit === 'score' ? 'money' : 'score'
    setUnit(next)
    setPreferUnit(next)
  }

  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label || '本月'
  const cumLabel = unit === 'score' ? '累计积分' : '累计金额'
  const cumText = formatDelta(stats.cumulative, unit)

  const medalMeta = (i: number) =>
    [
      { rank: 1, label: '冠军' },
      { rank: 2, label: '亚军' },
      { rank: 3, label: '季军' },
    ][i]

  return (
    <View className="records-page">
      <View className="records-top">
        <View className="range-pill" onClick={onPickRange}>
          <Text className="range-pill-text">{rangeLabel}</Text>
        </View>
        <View className="add-btn" onClick={() => goEdit()}>
          <Plus size={18} color="#fff" />
        </View>
      </View>

      {/* Hero */}
      <View className="hero-card">
        <View className="hero-unit" onClick={switchUnit}>
          <Text className="hero-unit-text">{unit === 'score' ? '积分' : '金额'} · 点此切换</Text>
        </View>
        <Text className="hero-cum-label">{cumLabel}</Text>
        <Text className="hero-cum-value">{cumText}</Text>
        <View className="hero-grid">
          <View className="hero-grid-item">
            <Text className="hero-num">{stats.total}场</Text>
            <Text className="hero-label">总场次</Text>
          </View>
          <View className="hero-grid-item">
            <Text className="hero-num">{stats.wins}胜</Text>
            <Text className="hero-label">胜利场次</Text>
          </View>
          <View className="hero-grid-item">
            <Text className="hero-num">{stats.losses}负</Text>
            <Text className="hero-label">失败场次</Text>
          </View>
        </View>
        <View className="winrate-pill">
          <Text className="winrate-text">胜率 {stats.winRate}%</Text>
        </View>
      </View>

      {records.length === 0 && (
        <View className="empty-card">
          <Text className="empty-title">还没有牌局记录</Text>
          <Text className="empty-desc">打完一桌，花 30 秒记下结算，胜率趋势马上可见</Text>
          <Button color="primary" shape="round" onClick={() => goEdit()}>
            记第一场牌局
          </Button>
        </View>
      )}

      {records.length > 0 && (
        <>
          {/* 趋势 */}
          <View className="section-card">
            <View className="section-head">
              <Text className="section-title">战绩趋势</Text>
              <View className="span-row">
                {SPAN_OPTIONS.map((o) => (
                  <Text
                    key={o.value}
                    className={`span-btn ${trendSpan === o.value ? 'active' : ''}`}
                    onClick={() => setTrendSpan(o.value)}
                  >
                    {o.label}
                  </Text>
                ))}
              </View>
            </View>
            <MatchTrendChart points={stats.trend} height={200} />
          </View>

          {/* 排名：固定展示冠亚季三个席位 */}
          <View className="section-card">
            <Text className="section-title section-title-alone">我的排名</Text>
            {[0, 1, 2].map((i) => {
              const medal = medalMeta(i)!
              const r = stats.ranking[i]
              if (!r) {
                return (
                  <View key={`empty-${i}`} className="rank-row rank-row-empty">
                    <View className={`rank-medal rank-medal-${medal.rank}`}>
                      <Text className="rank-medal-num">{medal.rank}</Text>
                    </View>
                    <View className="rank-main">
                      <Text className="rank-name rank-name-empty">虚位以待</Text>
                      <Text className={`rank-tag rank-tag-${medal.rank}`}>{medal.label}</Text>
                    </View>
                    <Text className="rank-total muted-total">—</Text>
                  </View>
                )
              }
              return (
                <View key={`${r.name}-${i}`} className={`rank-row ${r.isSelf ? 'self' : ''}`}>
                  <View className={`rank-medal rank-medal-${medal.rank}`}>
                    <Text className="rank-medal-num">{medal.rank}</Text>
                  </View>
                  <View className="rank-main">
                    <Text className="rank-name">{r.name}</Text>
                    <Text className={`rank-tag rank-tag-${medal.rank}`}>{medal.label}</Text>
                  </View>
                  <Text className={`rank-total ${r.total >= 0 ? 'pos' : 'neg'}`}>
                    {formatDelta(r.total, unit)}
                  </Text>
                </View>
              )
            })}
          </View>

          {/* AI 模块暂时下线
          <View className="ai-card">
            <View className="ai-card-head">
              <View className="ai-badge">
                <Text className="ai-badge-text">AI</Text>
              </View>
              <View className="ai-head-text">
                <Text className="ai-title">牌觉 AI 教练</Text>
                <Text className="ai-sub">根据最近20场牌局分析</Text>
              </View>
            </View>
            <View className="ai-grid">
              <View className="ai-col">
                <Text className="ai-col-label">你的打法</Text>
                <Text className="ai-col-value">{stats.ai.style}</Text>
              </View>
              <View className="ai-col">
                <Text className="ai-col-label">优势</Text>
                {stats.ai.strengths.map((s) => (
                  <Text key={s} className="ai-col-line">
                    · {s}
                  </Text>
                ))}
              </View>
              <View className="ai-col">
                <Text className="ai-col-label">需要提升</Text>
                <Text className="ai-col-warn">· {stats.ai.weakness}</Text>
              </View>
            </View>
            <View
              className="ai-recommend"
              onClick={() => {
                const url = stats.ai.recommendUrl
                if (url.includes('/pages/puzzles')) Taro.switchTab({ url })
                else Taro.navigateTo({ url })
              }}
            >
              <Text className="ai-recommend-text">{stats.ai.recommend}</Text>
              <Arrow size={16} color="#1a5c2e" />
            </View>
            <Button
              className="ai-cta"
              color="primary"
              shape="round"
              block
              onClick={() => setShowAiSheet(true)}
            >
              查看 AI 复盘
            </Button>
          </View>
          */}

          {/* 近期列表 */}
          <View className="section-card section-card-last">
            <Text className="section-title section-title-alone">近期牌局</Text>
            {records.slice(0, 15).map((m) => {
              const self = m.players.find((p) => p.isSelf)
              const delta =
                self &&
                (m.settleUnit === 'score'
                  ? self.scoreDelta
                  : self.moneyDelta)
              const others = m.players.filter((p) => !p.isSelf).map((p) => p.name).join('、')
              const d = new Date(m.playedAt)
              const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
              return (
                <View key={m.id} className="match-row" onClick={() => goEdit(m.id)}>
                  <View className="match-main">
                    <Text className="match-date">{dateStr}</Text>
                    <Text className="match-meta">
                      {m.location || '未填地点'} · {others || '三人局'}
                    </Text>
                  </View>
                  <View className="match-right">
                    <Text
                      className={`match-result ${m.result === 'win' ? 'win' : m.result === 'loss' ? 'loss' : ''}`}
                    >
                      {m.result === 'win' ? '胜' : m.result === 'loss' ? '负' : '平'}
                    </Text>
                    <Text
                      className={`match-delta ${(delta || 0) >= 0 ? 'pos' : 'neg'}`}
                    >
                      {formatDelta(delta || 0, m.settleUnit)}
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        </>
      )}

      {/* AI 复盘弹层暂时下线
      {showAiSheet && (
        <View className="ai-sheet-mask" onClick={() => setShowAiSheet(false)}>
          <View className="ai-sheet" onClick={(e) => e.stopPropagation()}>
            <Text className="ai-sheet-title">AI 复盘摘要</Text>
            {stats.ai.summaryLines.map((line) => (
              <Text key={line} className="ai-sheet-line">
                {line}
              </Text>
            ))}
            <Button shape="round" color="primary" block onClick={() => setShowAiSheet(false)}>
              知道了
            </Button>
          </View>
        </View>
      )}
      */}
    </View>
  )
}
