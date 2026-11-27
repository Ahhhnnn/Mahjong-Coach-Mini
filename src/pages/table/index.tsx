import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { Button, Tabs } from '@taroify/core'
import { ArrowDown, Plus } from '@taroify/icons'
import MatchTrendChart from '../../components/match-trend-chart'
import MatchBadgeWall from '../../components/match-badge-wall'
import MatchMysticCard from '../../components/match-mystic-card'
import { getCachedUser } from '../../core/auth'
import { evaluateMatchBadges, updateMatchBadges } from '../../core/match-badge-service'
import { computeMatchMystic } from '../../core/match-mystic-service'
import {
  discardMatchConflict, getMatchSyncState, listMatches, MATCHES_CHANGED, syncCloudMatchesToLocal,
} from '../../core/match-service'
import {
  computeMatchStats, filterBySeason, getMatchSeasonAt, MATCH_SEASON_OPTIONS,
  type MatchSeason, type MatchSeasonPeriod,
} from '../../core/match-stats-service'
import { formatDelta, getSelfDelta } from '../../core/match-types'
import {
  dissolveTable, findVisibleTable, listMyTables, releaseSeat, tableContext, TABLES_CHANGED, type TableSummary,
} from '../../core/table-directory-service'
import './index.scss'

function ledgerKey(table: TableSummary): string | undefined {
  if (table.id === 'fixed-four') return undefined
  const openid = getCachedUser()?.openid
  return openid ? `match_table_v3:${openid}:${table.id}:${table.bindingId}` : undefined
}

export default function TablePage() {
  const [tableId, setTableId] = useState(() => Taro.getCurrentInstance()?.router?.params?.id || '')
  const [table, setTable] = useState<TableSummary | null>(null)
  const [missing, setMissing] = useState(false)
  const [currentSeason, setCurrentSeason] = useState<MatchSeason>(getMatchSeasonAt)
  const [season, setSeason] = useState<MatchSeason>(getMatchSeasonAt)
  const followCurrentSeason = useRef(true)
  const [expanded, setExpanded] = useState(false)
  const [version, setVersion] = useState(0)
  useLoad((opts) => { setTableId(opts?.id || '') })
  const load = async (id: string) => {
    if (!id) return
    try { await listMyTables() } catch { /* 离线继续用本地身份和已缓存的桌子 */ }
    const found = findVisibleTable(decodeURIComponent(id)) || null
    setTable(found)
    setMissing(!found)
    if (found?.id === 'fixed-four') void Taro.setNavigationBarTitle({ title: '我的牌局' })
    if (found) {
      const current = found.id === 'fixed-four' ? undefined : tableContext(found)
      await syncCloudMatchesToLocal(current)
      updateMatchBadges(listMatches(current), false, found.mySeat, ledgerKey(found), found.id === 'fixed-four' ? undefined : found.seats)
      setVersion((value) => value + 1)
    }
  }
  useEffect(() => { if (tableId) void load(tableId) }, [tableId])
  useDidShow(() => {
    const current = getMatchSeasonAt()
    setCurrentSeason(current)
    if (followCurrentSeason.current) setSeason(current)
    if (tableId) void load(tableId)
  })
  useEffect(() => {
    const update = () => setVersion((value) => value + 1)
    Taro.eventCenter.on(MATCHES_CHANGED, update)
    Taro.eventCenter.on(TABLES_CHANGED, update)
    return () => {
      Taro.eventCenter.off(MATCHES_CHANGED, update)
      Taro.eventCenter.off(TABLES_CHANGED, update)
    }
  }, [])
  const ctx = table && table.id !== 'fixed-four' ? tableContext(table) : undefined
  const records = useMemo(() => table ? listMatches(ctx) : [], [table, version])
  const stats = useMemo(() => table ? computeMatchStats(records, {
    season, playerName: table.mySeat, seats: table.id === 'fixed-four' ? undefined : table.seats,
  }) : undefined, [records, season, table])
  const mystic = useMemo(() => table ? computeMatchMystic(records, undefined, table.mySeat, table.id === 'fixed-four' ? undefined : table.seats) : undefined, [records, table])
  const badges = useMemo(() => table ? evaluateMatchBadges(records, table.mySeat, table.id === 'fixed-four' ? undefined : table.seats) : [], [records, table])
  const filtered = useMemo(() => filterBySeason(records, season), [records, season])
  const syncState = table ? getMatchSyncState(ctx) : { pending: 0, conflicts: [] }
  const seasonOption = MATCH_SEASON_OPTIONS.find((option) => option.value === season.period)!
  const years = useMemo(() => Array.from(new Set([
    currentSeason.year, season.year,
    ...records.map((record) => getMatchSeasonAt(record.playedAt).year).filter(Number.isFinite),
  ])).sort((a, b) => b - a), [records, currentSeason.year, season.year])
  const selectSeason = (next: MatchSeason) => {
    followCurrentSeason.current = next.year === currentSeason.year && next.period === currentSeason.period
    setSeason(next)
    setExpanded(false)
  }
  if (!table) return <View className="records-page"><Text className="records-empty-text">{missing ? '这张桌子不存在，或你还没有入座' : '正在打开桌子…'}</Text></View>
  const fixed = table.id === 'fixed-four'
  const goEdit = (id?: string) => Taro.navigateTo({ url: fixed
    ? (id ? `/pages/record-edit/index?id=${encodeURIComponent(id)}` : '/pages/record-edit/index')
    : `/pages/record-edit/index?tableId=${encodeURIComponent(table.id)}${id ? `&id=${encodeURIComponent(id)}` : ''}` })
  const seasonLabel = `${season.year} ${seasonOption.label}${season.period === 'all' ? '' : ' 赛季'}`
  const isCurrentSeason = season.year === currentSeason.year && season.period === currentSeason.period
  if (fixed) return (
    <View className="records-page">
      <View className="records-identity-row"><Text>{table.mySeat} · 我的牌局</Text><Text onClick={() => { void load(table.id) }}>刷新同步</Text></View>
      {(syncState.pending > 0 || syncState.conflicts.length > 0) && <View className="records-sync-note">
        {syncState.pending > 0 && <Text>{syncState.pending} 项变更待同步，联网后自动重试。</Text>}
        {syncState.conflicts.map((item) => <View className="records-conflict" key={item.id}><Text>{item.message}，本机草稿已保留。</Text><View>
          {(item.draft || records.some((record) => record.id === item.id)) && <Text onClick={() => Taro.navigateTo({ url: `/pages/record-edit/index?id=${encodeURIComponent(item.id)}&draft=1` })}>核对并重新编辑</Text>}
          <Text onClick={() => { void Taro.showModal({ title: '放弃本机草稿', content: '仅放弃未同步的修改，云端牌局不受影响。' }).then((result) => { if (result.confirm) { discardMatchConflict(item.id); setVersion((value) => value + 1) } }) }}>放弃草稿</Text>
        </View></View>)}
      </View>}
      <View className="records-top">
        <Picker mode="selector" range={years.map((year) => `${year} 年`)} value={Math.max(0, years.indexOf(season.year))}
          onChange={(event) => {
            const year = years[Number(event.detail.value)]
            if (year !== undefined) selectSeason({ ...season, year })
          }}>
          <View className="range-pill"><Text className="range-pill-text">{season.year} 年 · 切换年份</Text><ArrowDown size={12} color="#1a5c2e" /></View>
        </Picker>
        <Button className="add-btn" color="primary" shape="round" aria-label="记录牌局" onClick={() => goEdit()}><Plus size={18} color="#fff" /></Button>
      </View>
      <View className="season-selector">
        <Tabs className="season-tabs" value={season.period} bordered={false} swipeThreshold={5} onChange={(period: MatchSeasonPeriod) => selectSeason({ ...season, period })}>
          {MATCH_SEASON_OPTIONS.map((option) => <Tabs.TabPane key={option.value} value={option.value} title={option.label} />)}
        </Tabs>
        <View className="season-caption"><Text className="season-dates">{seasonOption.dates}</Text><Text className="season-status">{isCurrentSeason ? '当前赛季' : season.period === 'all' ? '年度总览' : '季度战绩'}</Text></View>
      </View>
      {stats && <View className="hero-card">
        <Text className="hero-season">{seasonLabel}</Text>
        <Text className="hero-cum-label">{season.period === 'all' ? '全年' : '赛季'}累计积分</Text>
        <Text className="hero-cum-value">{formatDelta(stats.cumulative)}</Text>
        <View className="hero-grid">
          <View className="hero-grid-item"><Text className="hero-num">{stats.total}场</Text><Text className="hero-label">总场次</Text></View>
          <View className="hero-grid-item"><Text className="hero-num">{stats.wins}胜</Text><Text className="hero-label">胜利场次</Text></View>
          <View className="hero-grid-item"><Text className="hero-num">{stats.losses}负</Text><Text className="hero-label">失败场次</Text></View>
        </View>
        <View className="winrate-pill"><Text className="winrate-text">胜率 {stats.winRate}%</Text></View>
      </View>}
      <View className="trend-card">
        <Text className="records-eyebrow">THE RISE & THE RALLY</Text>
        <View className="trend-heading"><Text className="trend-title">牌桌风云</Text><Text className="trend-subtitle">{seasonOption.label} · 累计积分</Text></View>
        {stats?.trend.points.length ? <MatchTrendChart trend={stats.trend} height={260} /> : (
          <View className="trend-no-data"><Text>{seasonLabel}还没有积分牌局</Text><Text className="trend-hint">切换赛季，或记下新的一场</Text></View>
        )}
        {!!stats?.trend.series.length && <View className="trend-totals">{stats.trend.series.map((series) => (
          <View key={series.id} className="trend-member"><View className="trend-member-dot" style={{ backgroundColor: series.color }} /><Text className="trend-member-name">{series.name}</Text><Text className="trend-member-value" style={{ color: series.color }}>{formatDelta(series.total)}</Text></View>
        ))}</View>}
        <Text className="trend-hint">点击图例切换牌友 · 按住曲线查看战绩</Text>
      </View>
      <View className="section-card">
        <View className="section-head"><Text className="section-title">牌友榜</Text><Text className="ranking-scope">{seasonLabel} · 积分</Text></View>
        {!stats?.ranking.length && <Text className="records-empty-text">当前赛季范围暂无排名</Text>}
        {stats?.ranking.map((row, index) => (
          <View key={row.name} className={`rank-row ${row.isSelf ? 'self' : ''}`}>
            <View className={`rank-medal rank-medal-${Math.min(index + 1, 4)}`}><Text className="rank-medal-num">{index + 1}</Text></View>
            <View className="rank-main"><Text className="rank-name">{row.name}</Text><Text className="rank-games">{row.games} 场{row.isSelf ? ' · 本人' : ''}</Text></View>
            <Text className={`rank-total ${row.total >= 0 ? 'pos' : 'neg'}`}>{formatDelta(row.total)}</Text>
          </View>
        ))}
      </View>
      {mystic && <MatchMysticCard stats={mystic} />}
      {!!badges.length && <MatchBadgeWall badges={badges} playerName={table.mySeat} />}
      <View className="section-card section-card-last">
        <View className="section-head"><Text className="section-title">牌局足迹</Text><Text className="ranking-scope">{seasonOption.label} · 共 {filtered.length} 场</Text></View>
        {!filtered.length && <View className="records-list-empty"><Text className="records-empty-text">{seasonLabel}暂无牌局，记下下一场精彩</Text><Button color="primary" shape="round" onClick={() => goEdit()}>记一场牌局</Button></View>}
        {(expanded ? filtered : filtered.slice(0, 15)).map((match) => {
          const delta = getSelfDelta(match)
          const others = match.players.filter((player) => !player.isSelf).map((player) => player.name).join('、')
          const date = new Date(match.playedAt)
          const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
          return <View key={match.id} className="match-row" onClick={() => goEdit(match.id)}>
            <View className="match-main"><Text className="match-date">{dateStr}</Text><Text className="match-meta">{match.location || '未填地点'} · {others || '未填牌友'}</Text>{match.note && <Text className="match-note">{match.note}</Text>}</View>
            <View className="match-right"><Text className={`match-result ${match.result === 'win' ? 'win' : match.result === 'loss' ? 'loss' : ''}`}>{match.result === 'win' ? '胜' : match.result === 'loss' ? '负' : '平'}</Text><Text className={`match-delta ${delta >= 0 ? 'pos' : 'neg'}`}>{formatDelta(delta)}</Text></View>
          </View>
        })}
        {filtered.length > 15 && <View className="records-expand" onClick={() => setExpanded((value) => !value)}><Text>{expanded ? '收起历史牌局' : `展开全部 ${filtered.length} 场牌局`}</Text></View>}
      </View>
    </View>
  )
  return (
    <View className="records-page">
      {table.id !== 'fixed-four' && <Text className="section-title">{table.name}</Text>}
      {!!table.inviteCode && table.id !== 'fixed-four' && <Text className="table-code" onClick={() => { void Taro.setClipboardData({ data: table.inviteCode || '' }) }}>邀请码 {table.inviteCode} · 点击复制</Text>}
      {table.role === 'admin' && table.id !== 'fixed-four' && table.players.filter((player) => player.claimed && player.name !== table.mySeat).map((player) => (
        <Text key={player.name} className="table-admin" onClick={() => { void releaseSeat(table.id, player.name).then(() => load(table.id)) }}>解除 {player.name} 的座位</Text>
      ))}
      {syncState.pending > 0 && <Text className="records-empty-text">{syncState.pending} 项变更待同步。</Text>}
      {syncState.conflicts.map((item) => <Text key={item.id} className="records-empty-text" onClick={() => { discardMatchConflict(item.id, ctx); setVersion((value) => value + 1) }}>{item.message} · 点此放弃草稿</Text>)}
      <View className="season-selector">
        <Tabs className="season-tabs" value={season.period} bordered={false} swipeThreshold={5} onChange={(period: MatchSeasonPeriod) => setSeason({ ...season, period })}>
          {MATCH_SEASON_OPTIONS.map((option) => <Tabs.TabPane key={option.value} value={option.value} title={option.label} />)}
        </Tabs>
      </View>
      {stats && <View className="hero-card">
        <Text className="hero-season">{season.year} {seasonOption.label}</Text>
        <Text className="hero-cum-label">我的本桌积分</Text>
        <Text className="hero-cum-value">{formatDelta(stats.cumulative)}</Text>
        <View className="hero-grid">
          <View className="hero-grid-item"><Text className="hero-num">{stats.total}场</Text><Text className="hero-label">总场次</Text></View>
          <View className="hero-grid-item"><Text className="hero-num">{stats.wins}胜</Text><Text className="hero-label">胜利场次</Text></View>
          <View className="hero-grid-item"><Text className="hero-num">{stats.losses}负</Text><Text className="hero-label">失败场次</Text></View>
        </View>
      </View>}
      <View className="trend-card">
        <View className="trend-heading"><Text className="trend-title">四人走势</Text><Button className="add-btn" color="primary" shape="round" aria-label="记录本桌牌局" onClick={() => goEdit()}>+</Button></View>
        {stats?.trend.points.length ? <MatchTrendChart trend={stats.trend} height={260} /> : <Text className="trend-hint">这张桌子还没有积分牌局</Text>}
      </View>
      <View className="section-card">
        <View className="section-head"><Text className="section-title">四人积分</Text></View>
        {stats?.ranking.map((row, index) => {
          const unlocked = evaluateMatchBadges(records, row.name, table.id === 'fixed-four' ? undefined : table.seats).filter((badge) => badge.unlockedAt).length
          return <View key={row.name} className={`rank-row ${row.isSelf ? 'self' : ''}`}>
            <View className={`rank-medal rank-medal-${Math.min(index + 1, 4)}`}><Text className="rank-medal-num">{index + 1}</Text></View>
            <View className="rank-main"><Text className="rank-name">{row.name}</Text><Text className="rank-games">{row.games} 场 · {unlocked} 枚荣誉{row.isSelf ? ' · 本人' : ''}</Text></View>
            <Text className={`rank-total ${row.total >= 0 ? 'pos' : 'neg'}`}>{formatDelta(row.total)}</Text>
          </View>
        })}
      </View>
      {mystic && <MatchMysticCard stats={mystic} />}
      {!!badges.length && <MatchBadgeWall badges={badges} playerName={table.mySeat} ledgerKey={ledgerKey(table)} title="本桌荣誉" intro="只统计这一桌的四人积分，不计入单人账本" />}
      <View className="section-card section-card-last">
        <View className="section-head"><Text className="section-title">本桌牌局</Text><Text className="ranking-scope">共 {filtered.length} 场</Text></View>
        {!filtered.length && <Button color="primary" shape="round" onClick={() => goEdit()}>记一场四人牌局</Button>}
        {(expanded ? filtered : filtered.slice(0, 15)).map((match) => {
          const delta = getSelfDelta(match)
          const date = new Date(match.playedAt)
          return <View key={match.id} className="match-row" onClick={() => goEdit(match.id)}>
            <View className="match-main"><Text className="match-date">{`${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`}</Text><Text className="match-meta">{match.location || '未填地点'}</Text></View>
            <Text className={`match-delta ${delta >= 0 ? 'pos' : 'neg'}`}>{formatDelta(delta)}</Text>
          </View>
        })}
        {filtered.length > 15 && <Text className="records-expand" onClick={() => setExpanded((value) => !value)}>{expanded ? '收起' : `展开全部 ${filtered.length} 场`}</Text>}
      </View>
      {table.role === 'admin' && table.id !== 'fixed-four' && <Text className="delete-link" onClick={() => {
        void Taro.showModal({ title: '解散空桌子', content: '已经有牌局的桌子不能解散。', success: (result) => {
          if (!result.confirm) return
          void dissolveTable(table.id).then(() => Taro.navigateBack()).catch((error) => Taro.showToast({ title: error instanceof Error ? error.message : '暂时不能解散', icon: 'none' }))
        } })
      }}>解散这张桌子</Text>}
    </View>
  )
}
