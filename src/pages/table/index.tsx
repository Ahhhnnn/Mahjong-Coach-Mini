import { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { Button, Tabs } from '@taroify/core'
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
  dissolveTable, listCachedTables, listMyTables, releaseSeat, tableContext, TABLES_CHANGED, type TableSummary,
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
  const [season, setSeason] = useState<MatchSeason>(getMatchSeasonAt)
  const [expanded, setExpanded] = useState(false)
  const [version, setVersion] = useState(0)
  useLoad((opts) => { setTableId(opts?.id || '') })
  const load = async (id: string) => {
    if (!id) return
    let found = listCachedTables().find((item) => item.id === id) || null
    try {
      const tables = await listMyTables()
      found = tables.find((item) => item.id === id) || found
    } catch { /* 离线使用缓存 */ }
    setTable(found)
    setMissing(!found)
    if (found) {
      const current = found.id === 'fixed-four' ? undefined : tableContext(found)
      await syncCloudMatchesToLocal(current)
      updateMatchBadges(listMatches(current), false, found.mySeat, ledgerKey(found), found.id === 'fixed-four' ? undefined : found.seats)
      setVersion((value) => value + 1)
    }
  }
  useEffect(() => { if (tableId) void load(tableId) }, [tableId])
  useDidShow(() => { if (tableId) void load(tableId) })
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
  if (!table) return <View className="records-page"><Text className="records-empty-text">{missing ? '这张桌子不存在，或你还没有入座' : '正在打开桌子…'}</Text></View>
  const goEdit = (id?: string) => Taro.navigateTo({ url: `/pages/record-edit/index?tableId=${encodeURIComponent(table.id)}${id ? `&id=${encodeURIComponent(id)}` : ''}` })
  return (
    <View className="records-page">
      <Text className="section-title">{table.name}</Text>
      <Text className="records-empty-text">我是 {table.mySeat} · {table.seats.join('、')}</Text>
      {!!table.inviteCode && table.id !== 'fixed-four' && <Text className="table-code" onClick={() => { void Taro.setClipboardData({ data: table.inviteCode || '' }) }}>邀请码 {table.inviteCode} · 点击复制</Text>}
      {table.id === 'fixed-four' && <Text className="table-admin" onClick={() => Taro.navigateTo({ url: '/pages/identity/index' })}>常聚牌桌的座位在身份页管理</Text>}
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
