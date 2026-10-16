import { useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button } from '@taroify/core'
import { Plus } from '@taroify/icons'
import MatchTrendChart from '../../components/match-trend-chart'
import MatchBadgeWall from '../../components/match-badge-wall'
import { getPreferUnit, listMatches, setPreferUnit, syncCloudMatchesToLocal } from '../../core/match-service'
import { updateMatchBadges, type MatchBadgeView } from '../../core/match-badge-service'
import { computeMatchStats, filterByRange, type StatsRange, type TrendSpan } from '../../core/match-stats-service'
import { formatDelta, getSelfDelta, type MatchRecord, type SettleUnit } from '../../core/match-types'
import { isLoggedIn } from '../../core/auth'
import './index.scss'

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: 'week', label: '本周' }, { value: 'month', label: '本月' },
  { value: 'quarter', label: '本季' }, { value: 'year', label: '本年' }, { value: 'all', label: '全部' },
]
const SPAN_OPTIONS: { value: TrendSpan; label: string }[] = [
  { value: 'week', label: '周' }, { value: 'month', label: '月' },
  { value: 'quarter', label: '季度' }, { value: 'half', label: '半年' },
  { value: 'year', label: '年度' }, { value: 'all', label: '全部' },
]

export default function RecordsPage() {
  const [range, setRange] = useState<StatsRange>('all')
  const [trendSpan, setTrendSpan] = useState<TrendSpan>('all')
  const [unit, setUnit] = useState<SettleUnit>(getPreferUnit())
  const [records, setRecords] = useState<MatchRecord[]>([])
  const [badges, setBadges] = useState<MatchBadgeView[]>([])
  const [expanded, setExpanded] = useState(false)
  const refresh = () => {
    const list = listMatches()
    setRecords(list)
    setBadges(updateMatchBadges(list))
  }
  useDidShow(() => {
    setUnit(getPreferUnit())
    refresh()
    if (isLoggedIn()) syncCloudMatchesToLocal().then(refresh)
  })
  const stats = useMemo(() => computeMatchStats(records, { range, trendSpan, unit }), [records, range, trendSpan, unit])
  const filtered = useMemo(() => filterByRange(records.filter((r) => r.settleUnit === unit), range), [records, range, unit])
  const goEdit = (id?: string) => Taro.navigateTo({ url: id ? `/pages/record-edit/index?id=${id}` : '/pages/record-edit/index' })
  const onPickRange = () => {
    Taro.showActionSheet({ itemList: RANGE_OPTIONS.map((o) => o.label), success: (res) => {
      const opt = RANGE_OPTIONS[res.tapIndex]
      if (opt) { setRange(opt.value); setExpanded(false) }
    } }).catch(() => {})
  }
  const switchUnit = () => {
    const next = unit === 'score' ? 'money' : 'score'
    setUnit(next)
    setPreferUnit(next)
    setExpanded(false)
  }
  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label || '全部'
  return (
    <View className="records-page">
      <View className="records-top">
        <View className="range-pill" onClick={onPickRange}><Text className="range-pill-text">{rangeLabel}战绩 · 筛选</Text></View>
        <View className="add-btn" onClick={() => goEdit()}><Plus size={18} color="#fff" /></View>
      </View>
      <View className="hero-card">
        <Text className="records-eyebrow">MY MAHJONG JOURNEY</Text>
        <View className="hero-unit" onClick={switchUnit}><Text className="hero-unit-text">{unit === 'score' ? '积分' : '金额'} · 点此切换</Text></View>
        <Text className="hero-cum-label">{rangeLabel}累计{unit === 'score' ? '积分' : '金额'}</Text>
        <Text className="hero-cum-value">{formatDelta(stats.cumulative, unit)}</Text>
        <View className="hero-grid">
          <View className="hero-grid-item"><Text className="hero-num">{stats.total}场</Text><Text className="hero-label">总场次</Text></View>
          <View className="hero-grid-item"><Text className="hero-num">{stats.wins}胜</Text><Text className="hero-label">胜利场次</Text></View>
          <View className="hero-grid-item"><Text className="hero-num">{stats.losses}负</Text><Text className="hero-label">失败场次</Text></View>
        </View>
        <View className="winrate-pill"><Text className="winrate-text">胜率 {stats.winRate}%</Text></View>
      </View>
      <View className="trend-card">
        <Text className="records-eyebrow">THE RISE & THE RALLY</Text>
        <View className="trend-heading"><Text className="trend-title">牌桌风云</Text><Text className="trend-subtitle">累计{unit === 'score' ? '积分' : '金额'}趋势</Text></View>
        <View className="trend-tabs">{SPAN_OPTIONS.map((o) => (
          <Text key={o.value} className={`trend-tab ${trendSpan === o.value ? 'active' : ''}`} onClick={() => setTrendSpan(o.value)}>{o.label}</Text>
        ))}</View>
        {stats.trend.points.length ? <MatchTrendChart trend={stats.trend} unit={unit} height={260} /> : (
          <View className="trend-no-data"><Text>这段时间还没有{unit === 'score' ? '积分' : '金额'}牌局</Text><Text className="trend-hint">换个时间范围，或记下新的一场</Text></View>
        )}
        {!!stats.trend.series.length && <View className="trend-totals">{stats.trend.series.map((s) => (
          <View key={s.id} className="trend-member"><View className="trend-member-dot" style={{ backgroundColor: s.color }} /><Text className="trend-member-name">{s.name}</Text><Text className="trend-member-value" style={{ color: s.color }}>{formatDelta(s.total, unit)}</Text></View>
        ))}</View>}
        <Text className="trend-hint">点击图例切换牌友 · 按住曲线查看战绩</Text>
      </View>
      <View className="section-card">
        <View className="section-head"><Text className="section-title">牌友榜</Text><Text className="ranking-scope">{rangeLabel} · {unit === 'score' ? '积分' : '金额'}</Text></View>
        {!stats.ranking.length && <Text className="records-empty-text">当前范围暂无排名</Text>}
        {stats.ranking.map((r, i) => (
          <View key={`${r.name}-${i}`} className={`rank-row ${r.isSelf ? 'self' : ''}`}>
            <View className={`rank-medal rank-medal-${Math.min(i + 1, 4)}`}><Text className="rank-medal-num">{i + 1}</Text></View>
            <View className="rank-main"><Text className="rank-name">{r.name}</Text><Text className="rank-games">{r.games} 场{r.isSelf ? ' · 本人' : ''}</Text></View>
            <Text className={`rank-total ${r.total >= 0 ? 'pos' : 'neg'}`}>{formatDelta(r.total, unit)}</Text>
          </View>
        ))}
      </View>
      {!!badges.length && <MatchBadgeWall badges={badges} />}
      <View className="section-card section-card-last">
        <View className="section-head"><Text className="section-title">牌局足迹</Text><Text className="ranking-scope">共 {filtered.length} 场</Text></View>
        {!filtered.length && <View className="records-list-empty"><Text className="records-empty-text">当前范围暂无牌局，记下下一场精彩</Text><Button color="primary" shape="round" onClick={() => goEdit()}>记一场牌局</Button></View>}
        {(expanded ? filtered : filtered.slice(0, 15)).map((m) => {
          const delta = getSelfDelta(m)
          const others = m.players.filter((p) => !p.isSelf).map((p) => p.name).join('、')
          const d = new Date(m.playedAt)
          const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          return <View key={m.id} className="match-row" onClick={() => goEdit(m.id)}>
            <View className="match-main"><Text className="match-date">{dateStr}</Text><Text className="match-meta">{m.location || '未填地点'} · {others || '未填牌友'}</Text>{m.note && <Text className="match-note">{m.note}</Text>}</View>
            <View className="match-right"><Text className={`match-result ${m.result === 'win' ? 'win' : m.result === 'loss' ? 'loss' : ''}`}>{m.result === 'win' ? '胜' : m.result === 'loss' ? '负' : '平'}</Text><Text className={`match-delta ${delta >= 0 ? 'pos' : 'neg'}`}>{formatDelta(delta, m.settleUnit)}</Text></View>
          </View>
        })}
        {filtered.length > 15 && <View className="records-expand" onClick={() => setExpanded((v) => !v)}><Text>{expanded ? '收起历史牌局' : `展开全部 ${filtered.length} 场牌局`}</Text></View>}
      </View>
    </View>
  )
}
