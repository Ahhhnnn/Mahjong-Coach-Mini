import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Tabs } from '@taroify/core'
import { ArrowDown, Plus } from '@taroify/icons'
import MatchTrendChart from '../../components/match-trend-chart'
import MatchBadgeWall from '../../components/match-badge-wall'
import MatchMysticCard from '../../components/match-mystic-card'
import { computeMatchMystic } from '../../core/match-mystic-service'
import { listMatches, syncCloudMatchesToLocal, getMatchSyncState, discardMatchConflict, MATCHES_CHANGED } from '../../core/match-service'
import { updateMatchBadges, type MatchBadgeView } from '../../core/match-badge-service'
import {
  computeMatchStats, filterBySeason, getMatchSeasonAt, MATCH_SEASON_OPTIONS,
  type MatchSeason, type MatchSeasonPeriod,
} from '../../core/match-stats-service'
import { formatDelta, getSelfDelta, type MatchRecord } from '../../core/match-types'
import { useTableIdentity } from '../../hooks/use-table-identity'
import TableIdentityGate from '../../components/table-identity-gate'
import { getTableIdentity, identityScope } from '../../core/table-identity-service'
import './index.scss'

export default function RecordsPage() {
  const { identity, scope } = useTableIdentity()
  const [syncState, setSyncState] = useState(getMatchSyncState)
  const [currentSeason, setCurrentSeason] = useState<MatchSeason>(getMatchSeasonAt)
  const [season, setSeason] = useState<MatchSeason>(getMatchSeasonAt)
  const followCurrentSeason = useRef(true)
  const [storedRecords, setRecords] = useState<MatchRecord[]>([])
  const [storedBadges, setBadges] = useState<MatchBadgeView[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loadedScope, setLoadedScope] = useState('')
  const records = loadedScope === scope ? storedRecords : []
  const badges = loadedScope === scope ? storedBadges : []
  const refresh = () => {
    const currentIdentity = getTableIdentity()
    const list = listMatches()
    setLoadedScope(identityScope())
    setRecords(list)
    setBadges(currentIdentity ? updateMatchBadges(list, false, currentIdentity.playerName) : [])
    setSyncState(getMatchSyncState())
  }
  useDidShow(() => {
    const current = getMatchSeasonAt()
    setCurrentSeason(current)
    if (followCurrentSeason.current) setSeason(current)
    refresh()
    if (identity) syncCloudMatchesToLocal().then(refresh)
  })
  useEffect(() => {
    refresh()
    const update = () => refresh()
    Taro.eventCenter.on(MATCHES_CHANGED, update)
    if (identity) void syncCloudMatchesToLocal().then(refresh)
    return () => { Taro.eventCenter.off(MATCHES_CHANGED, update) }
  }, [scope])
  const stats = useMemo(() => computeMatchStats(records, { season, playerName: identity?.playerName }), [records, season, identity?.playerName])
  const mystic = useMemo(() => computeMatchMystic(records, undefined, identity?.playerName), [records, identity?.playerName])
  const filtered = useMemo(() => filterBySeason(records, season), [records, season])
  const years = useMemo(() => Array.from(new Set([
    currentSeason.year, season.year,
    ...records.map((record) => getMatchSeasonAt(record.playedAt).year).filter(Number.isFinite),
  ])).sort((a, b) => b - a), [records, currentSeason.year, season.year])
  const selectSeason = (next: MatchSeason) => {
    followCurrentSeason.current = next.year === currentSeason.year && next.period === currentSeason.period
    setSeason(next)
    setExpanded(false)
  }
  const goEdit = (id?: string) => Taro.navigateTo({ url: id ? `/pages/record-edit/index?id=${id}` : '/pages/record-edit/index' })
  const seasonOption = MATCH_SEASON_OPTIONS.find((option) => option.value === season.period)!
  const seasonLabel = `${season.year} ${seasonOption.label}${season.period === 'all' ? '' : ' 赛季'}`
  const isCurrentSeason = season.year === currentSeason.year && season.period === currentSeason.period
  if (!identity) return <TableIdentityGate />
  return (
    <View className="records-page">
      <View className="records-identity-row"><Text>{identity.playerName} · 我的牌局</Text><Text onClick={() => { void syncCloudMatchesToLocal().then(refresh) }}>刷新同步</Text></View>
      {(syncState.pending > 0 || syncState.conflicts.length > 0) && <View className="records-sync-note">
        {syncState.pending > 0 && <Text>{syncState.pending} 项变更待同步，联网后自动重试。</Text>}
        {syncState.conflicts.map((item) => <View className="records-conflict" key={item.id}><Text>{item.message}，本机草稿已保留。</Text><View>
          {(item.draft || records.some((r) => r.id === item.id)) && <Text onClick={() => Taro.navigateTo({ url: `/pages/record-edit/index?id=${encodeURIComponent(item.id)}&draft=1` })}>核对并重新编辑</Text>}
          <Text onClick={() => { void Taro.showModal({ title: '放弃本机草稿', content: '仅放弃未同步的修改，云端牌局不受影响。' }).then((r) => { if (r.confirm) { discardMatchConflict(item.id); refresh() } }) }}>放弃草稿</Text>
        </View></View>)}
      </View>}
      <View className="records-top">
        <Picker mode="selector" range={years.map((year) => `${year} 年`)} value={years.indexOf(season.year)}
          onChange={(event) => {
            const year = years[Number(event.detail.value)]
            if (year !== undefined) selectSeason({ ...season, year })
          }}>
          <View className="range-pill"><Text className="range-pill-text">{season.year} 年 · 切换年份</Text><ArrowDown size={12} color="#1a5c2e" /></View>
        </Picker>
        <Button className="add-btn" color="primary" shape="round" aria-label="记录牌局" onClick={() => goEdit()}><Plus size={18} color="#fff" /></Button>
      </View>
      <View className="season-selector">
        <Tabs className="season-tabs" value={season.period} bordered={false} swipeThreshold={5}
          onChange={(period: MatchSeasonPeriod) => selectSeason({ ...season, period })}>
          {MATCH_SEASON_OPTIONS.map((option) => <Tabs.TabPane key={option.value} value={option.value} title={option.label} />)}
        </Tabs>
        <View className="season-caption"><Text className="season-dates">{seasonOption.dates}</Text><Text className="season-status">{isCurrentSeason ? '当前赛季' : season.period === 'all' ? '年度总览' : '季度战绩'}</Text></View>
      </View>
      <View className="hero-card">
        <Text className="hero-season">{seasonLabel}</Text>
        <Text className="hero-cum-label">{season.period === 'all' ? '全年' : '赛季'}累计积分</Text>
        <Text className="hero-cum-value">{formatDelta(stats.cumulative)}</Text>
        <View className="hero-grid">
          <View className="hero-grid-item"><Text className="hero-num">{stats.total}场</Text><Text className="hero-label">总场次</Text></View>
          <View className="hero-grid-item"><Text className="hero-num">{stats.wins}胜</Text><Text className="hero-label">胜利场次</Text></View>
          <View className="hero-grid-item"><Text className="hero-num">{stats.losses}负</Text><Text className="hero-label">失败场次</Text></View>
        </View>
        <View className="winrate-pill"><Text className="winrate-text">胜率 {stats.winRate}%</Text></View>
      </View>
      <View className="trend-card">
        <Text className="records-eyebrow">THE RISE & THE RALLY</Text>
        <View className="trend-heading"><Text className="trend-title">牌桌风云</Text><Text className="trend-subtitle">{seasonOption.label} · 累计积分</Text></View>
        {stats.trend.points.length ? <MatchTrendChart trend={stats.trend} height={260} /> : (
          <View className="trend-no-data"><Text>{seasonLabel}还没有积分牌局</Text><Text className="trend-hint">切换赛季，或记下新的一场</Text></View>
        )}
        {!!stats.trend.series.length && <View className="trend-totals">{stats.trend.series.map((s) => (
          <View key={s.id} className="trend-member"><View className="trend-member-dot" style={{ backgroundColor: s.color }} /><Text className="trend-member-name">{s.name}</Text><Text className="trend-member-value" style={{ color: s.color }}>{formatDelta(s.total)}</Text></View>
        ))}</View>}
        <Text className="trend-hint">点击图例切换牌友 · 按住曲线查看战绩</Text>
      </View>
      <View className="section-card">
        <View className="section-head"><Text className="section-title">牌友榜</Text><Text className="ranking-scope">{seasonLabel} · 积分</Text></View>
        {!stats.ranking.length && <Text className="records-empty-text">当前赛季范围暂无排名</Text>}
        {stats.ranking.map((r, i) => (
          <View key={`${r.name}-${i}`} className={`rank-row ${r.isSelf ? 'self' : ''}`}>
            <View className={`rank-medal rank-medal-${Math.min(i + 1, 4)}`}><Text className="rank-medal-num">{i + 1}</Text></View>
            <View className="rank-main"><Text className="rank-name">{r.name}</Text><Text className="rank-games">{r.games} 场{r.isSelf ? ' · 本人' : ''}</Text></View>
            <Text className={`rank-total ${r.total >= 0 ? 'pos' : 'neg'}`}>{formatDelta(r.total)}</Text>
          </View>
        ))}
      </View>
      <MatchMysticCard stats={mystic} />
      {!!badges.length && <MatchBadgeWall key={scope} badges={badges} playerName={identity.playerName} />}
      <View className="section-card section-card-last">
        <View className="section-head"><Text className="section-title">牌局足迹</Text><Text className="ranking-scope">{seasonOption.label} · 共 {filtered.length} 场</Text></View>
        {!filtered.length && <View className="records-list-empty"><Text className="records-empty-text">{seasonLabel}暂无牌局，记下下一场精彩</Text><Button color="primary" shape="round" onClick={() => goEdit()}>记一场牌局</Button></View>}
        {(expanded ? filtered : filtered.slice(0, 15)).map((m) => {
          const delta = getSelfDelta(m)
          const others = m.players.filter((p) => !p.isSelf).map((p) => p.name).join('、')
          const d = new Date(m.playedAt)
          const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          return <View key={m.id} className="match-row" onClick={() => goEdit(m.id)}>
            <View className="match-main"><Text className="match-date">{dateStr}</Text><Text className="match-meta">{m.location || '未填地点'} · {others || '未填牌友'}</Text>{m.note && <Text className="match-note">{m.note}</Text>}</View>
            <View className="match-right"><Text className={`match-result ${m.result === 'win' ? 'win' : m.result === 'loss' ? 'loss' : ''}`}>{m.result === 'win' ? '胜' : m.result === 'loss' ? '负' : '平'}</Text><Text className={`match-delta ${delta >= 0 ? 'pos' : 'neg'}`}>{formatDelta(delta)}</Text></View>
          </View>
        })}
        {filtered.length > 15 && <View className="records-expand" onClick={() => setExpanded((v) => !v)}><Text>{expanded ? '收起历史牌局' : `展开全部 ${filtered.length} 场牌局`}</Text></View>}
      </View>
    </View>
  )
}
