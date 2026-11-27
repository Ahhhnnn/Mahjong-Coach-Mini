import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Tabs } from '@taroify/core'
import { ArrowDown, Plus } from '@taroify/icons'
import MatchTrendChart from '../../components/match-trend-chart'
import MatchBadgeWall from '../../components/match-badge-wall'
import { ensureLogin, getCachedUser } from '../../core/auth'
import { discardSoloConflict, getSoloMatch, getSoloSyncState, listSoloMatches, SOLO_CHANGED, soloScope, syncCloudSoloToLocal } from '../../core/solo-match-service'
import { soloLedgerKey, updateSoloBadges } from '../../core/solo-badge-service'
import { listMatches, syncCloudMatchesToLocal, MATCHES_CHANGED } from '../../core/match-service'
import { evaluateMatchBadges } from '../../core/match-badge-service'
import {
  computeMatchStats, filterBySeason, getMatchSeasonAt, MATCH_SEASON_OPTIONS,
  type MatchSeason, type MatchSeasonPeriod,
} from '../../core/match-stats-service'
import { formatDelta, parseTableSoloId, SOLO_SELF_NAME, soloToMatchRecord } from '../../core/match-types'
import { computeSoloVenueMystic } from '../../core/solo-mystic-service'
import { MYSTIC_MIN_GAMES } from '../../core/match-mystic-service'
import { listMyTables, listVisibleTables, seedPersonalScores, tableContext, TABLES_CHANGED, type TableSummary } from '../../core/table-directory-service'
import './index.scss'

type Lens = 'solo' | 'four'
const LENS_KEY = 'records_lens'
const readLens = (): Lens => Taro.getStorageSync(LENS_KEY) === 'four' ? 'four' : 'solo'

export default function RecordsPage() {
  const [lens, setLens] = useState<Lens>(readLens)
  const [openid, setOpenid] = useState(getCachedUser()?.openid || '')
  const [syncState, setSyncState] = useState(getSoloSyncState)
  const [currentSeason, setCurrentSeason] = useState<MatchSeason>(getMatchSeasonAt)
  const [season, setSeason] = useState<MatchSeason>(getMatchSeasonAt)
  const followCurrentSeason = useRef(true)
  const [soloRecords, setSoloRecords] = useState(listSoloMatches)
  const [badges, setBadges] = useState(() => updateSoloBadges(listSoloMatches()))
  const [tables, setTables] = useState<TableSummary[]>(listVisibleTables)
  const [expanded, setExpanded] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const scope = soloScope(openid)
  const refresh = () => {
    const current = getCachedUser()?.openid || ''
    setOpenid(current)
    const records = listSoloMatches()
    setSoloRecords(records)
    setBadges(current ? updateSoloBadges(records) : [])
    setTables(listVisibleTables())
    setSyncState(getSoloSyncState())
  }
  const chooseLens = (next: Lens) => {
    setLens(next)
    Taro.setStorageSync(LENS_KEY, next)
    setExpanded(false)
  }
  useDidShow(() => {
    const current = getMatchSeasonAt()
    setCurrentSeason(current)
    if (followCurrentSeason.current) setSeason(current)
    refresh()
    if (getCachedUser()?.openid) {
      void seedPersonalScores().catch(() => undefined).then(() => syncCloudSoloToLocal()).then(refresh)
      void listMyTables().then(async () => {
        setTables(listVisibleTables())
        await Promise.all(next.map((table) => syncCloudMatchesToLocal(table.id === 'fixed-four' ? undefined : tableContext(table))))
        refresh()
      }).catch(() => { /* 离线继续看本地桌子和单人缓存 */ })
    }
  })
  useEffect(() => {
    refresh()
    const update = () => refresh()
    Taro.eventCenter.on(SOLO_CHANGED, update)
    Taro.eventCenter.on(MATCHES_CHANGED, update)
    Taro.eventCenter.on(TABLES_CHANGED, update)
    if (getCachedUser()?.openid) void syncCloudSoloToLocal().then(refresh)
    return () => {
      Taro.eventCenter.off(SOLO_CHANGED, update)
      Taro.eventCenter.off(MATCHES_CHANGED, update)
      Taro.eventCenter.off(TABLES_CHANGED, update)
    }
  }, [scope])
  const soloMatches = useMemo(() => soloRecords.map(soloToMatchRecord), [soloRecords])
  const stats = useMemo(() => computeMatchStats(soloMatches, { season, playerName: SOLO_SELF_NAME, seats: [SOLO_SELF_NAME] }), [soloMatches, season])
  const filtered = useMemo(() => filterBySeason(soloMatches, season), [soloMatches, season])
  const venueMystic = useMemo(() => computeSoloVenueMystic(soloRecords, season), [soloRecords, season])
  const years = useMemo(() => Array.from(new Set([
    currentSeason.year, season.year,
    ...soloRecords.map((record) => getMatchSeasonAt(record.playedAt).year).filter(Number.isFinite),
    ...tables.flatMap((table) => listMatches(table.id === 'fixed-four' ? undefined : tableContext(table)).map((record) => getMatchSeasonAt(record.playedAt).year)),
  ])).sort((a, b) => b - a), [soloRecords, tables, currentSeason.year, season.year])
  const selectSeason = (next: MatchSeason) => {
    followCurrentSeason.current = next.year === currentSeason.year && next.period === currentSeason.period
    setSeason(next)
    setExpanded(false)
  }
  const login = async () => {
    setLoggingIn(true)
    try {
      const user = await ensureLogin()
      if (!user?.openid) throw new Error('请联网完成微信登录')
      refresh()
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '登录失败，请重试', icon: 'none' })
    } finally { setLoggingIn(false) }
  }
  const goSoloEdit = (id?: string) => Taro.navigateTo({ url: id ? `/pages/record-edit/index?mode=solo&id=${id}` : '/pages/record-edit/index?mode=solo' })
  const openRecord = (id: string) => {
    const parsed = parseTableSoloId(id)
    if (!parsed) { goSoloEdit(id); return }
    const tableQuery = parsed.tableId === 'fixed-four' ? '' : `&tableId=${encodeURIComponent(parsed.tableId)}`
    Taro.navigateTo({ url: `/pages/record-edit/index?id=${encodeURIComponent(parsed.matchId)}${tableQuery}` })
  }
  const seasonOption = MATCH_SEASON_OPTIONS.find((option) => option.value === season.period)!
  const seasonLabel = `${season.year} ${seasonOption.label}${season.period === 'all' ? '' : ' 赛季'}`
  const isCurrentSeason = season.year === currentSeason.year && season.period === currentSeason.period
  if (!openid) return (
    <View className="records-page">
      <View className="section-card">
        <Text className="section-title">登录后记下分数</Text>
        <Text className="records-empty-text">单人分数会保存到云端。四人桌子也从这里进入。</Text>
        <Button color="primary" shape="round" loading={loggingIn} onClick={login}>微信登录</Button>
      </View>
    </View>
  )
  return (
    <View className="records-page">
      <View className="lens-switch" role="tablist">
        <Text className={`lens-option ${lens === 'solo' ? 'active' : ''}`} onClick={() => chooseLens('solo')}>单人</Text>
        <Text className={`lens-option ${lens === 'four' ? 'active' : ''}`} onClick={() => chooseLens('four')}>四人</Text>
      </View>
      <View className="records-identity-row">
        <Text>{lens === 'solo' ? '单人积分 · 云端保存' : '四人牌桌 · 选一桌查看'}</Text>
        <Text onClick={() => { void (lens === 'solo' ? syncCloudSoloToLocal() : listMyTables()).then(refresh) }}>刷新同步</Text>
      </View>
      {lens === 'solo' && (syncState.pending > 0 || syncState.conflicts.length > 0) && <View className="records-sync-note">
        {syncState.pending > 0 && <Text>{syncState.pending} 项单人分数待同步，联网后会写入云端。</Text>}
        {syncState.conflicts.map((item) => <View className="records-conflict" key={item.id}><Text>{item.message}，本机草稿已保留。</Text><View>
          {(item.draft || getSoloMatch(item.id)) && <Text onClick={() => Taro.navigateTo({ url: `/pages/record-edit/index?mode=solo&id=${encodeURIComponent(item.id)}&draft=1` })}>核对并重新编辑</Text>}
          <Text onClick={() => { void Taro.showModal({ title: '放弃本机草稿', content: '只放弃还没同步到云端的修改。' }).then((result) => { if (result.confirm) { discardSoloConflict(item.id); refresh() } }) }}>放弃草稿</Text>
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
        <Button className="add-btn" color="primary" shape="round" aria-label={lens === 'solo' ? '记录单人分数' : '添加桌子'} onClick={() => lens === 'solo' ? goSoloEdit() : Taro.navigateTo({ url: '/pages/table-create/index' })}><Plus size={18} color="#fff" /></Button>
      </View>
      <View className="season-selector">
        <Tabs className="season-tabs" value={season.period} bordered={false} swipeThreshold={5}
          onChange={(period: MatchSeasonPeriod) => selectSeason({ ...season, period })}>
          {MATCH_SEASON_OPTIONS.map((option) => <Tabs.TabPane key={option.value} value={option.value} title={option.label} />)}
        </Tabs>
        <View className="season-caption"><Text className="season-dates">{seasonOption.dates}</Text><Text className="season-status">{isCurrentSeason ? '当前赛季' : season.period === 'all' ? '年度总览' : '季度战绩'}</Text></View>
      </View>
      {lens === 'four' ? <FourTables season={season} seasonLabel={seasonLabel} tables={tables} /> : <>
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
          <Text className="records-eyebrow">MY SCORE</Text>
          <View className="trend-heading"><Text className="trend-title">单人走势</Text><Text className="trend-subtitle">{seasonOption.label} · 累计积分</Text></View>
          {stats.trend.points.length ? <MatchTrendChart trend={stats.trend} height={260} /> : (
            <View className="trend-no-data"><Text>{seasonLabel}还没有单人分数</Text><Text className="trend-hint">记下自己的一场，分数会同步到云端</Text></View>
          )}
        </View>
        <View className="section-card">
          <View className="section-head"><Text className="section-title">棋牌室玄学</Text><Text className="ranking-scope">{seasonLabel} · 胜率</Text></View>
          <Text className="records-empty-text">{venueMystic.luckyVenues.length ? `福地 ${venueMystic.luckyVenues.join('、')}` : `填上棋牌室，满 ${MYSTIC_MIN_GAMES} 场后标出胜率最高的福地`}</Text>
          {!venueMystic.venues.length && <Text className="trend-hint">还没有可比较的棋牌室。</Text>}
          {venueMystic.venues.map((venue) => <View key={venue.name} className="seat-row">
            <View className="seat-main">
              <Text className="seat-rate">{venue.name}</Text>
              <Text className="seat-meta">{venue.wins + venue.losses ? `胜率 ${venue.winRate}% · ${venue.games} 场 · ${venue.wins}胜${venue.losses}负` : `${venue.games} 场 · 还没分出胜负`}</Text>
            </View>
            <View className="seat-side">
              <Text className={`seat-total ${venue.total >= 0 ? 'pos' : 'neg'}`}>{formatDelta(venue.total)}</Text>
              {venueMystic.luckyVenues.includes(venue.name) && <Text className="seat-tag lucky">福地</Text>}
              {venueMystic.unluckyVenues.includes(venue.name) && <Text className="seat-tag unlucky">雷区</Text>}
              {!venue.eligible && <Text className="seat-tag">待观察</Text>}
            </View>
          </View>)}
          <Text className="trend-hint">没填棋牌室的 {venueMystic.games - venueMystic.placedGames} 场只计入总积分。胜率不含平局，福地和雷区至少 {MYSTIC_MIN_GAMES} 场。</Text>
        </View>
        {!!badges.length && <MatchBadgeWall key={scope} badges={badges} playerName={SOLO_SELF_NAME} ledgerKey={soloLedgerKey(openid)} title="单人荣誉" intro="按你自己的分数累计。四人牌局里你的分数也会记进这里" />}
        <View className="section-card section-card-last">
          <View className="section-head"><Text className="section-title">单人足迹</Text><Text className="ranking-scope">{seasonOption.label} · 共 {filtered.length} 场</Text></View>
          {!filtered.length && <View className="records-list-empty"><Text className="records-empty-text">{seasonLabel}暂无单人记录</Text><Button color="primary" shape="round" onClick={() => goSoloEdit()}>记一场分数</Button></View>}
          {(expanded ? filtered : filtered.slice(0, 15)).map((match) => {
            const source = soloRecords.find((record) => record.id === match.id)
            const delta = source?.scoreDelta || 0
            const date = new Date(match.playedAt)
            const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
            return <View key={match.id} className="match-row" onClick={() => openRecord(match.id)}>
              <View className="match-main"><Text className="match-date">{dateStr}</Text><Text className="match-meta">{[source?.origin === 'table' ? '四人牌局' : '', match.location || '未填棋牌室'].filter(Boolean).join(' · ')}</Text>{match.note && <Text className="match-note">{match.note}</Text>}</View>
              <View className="match-right"><Text className={`match-result ${match.result === 'win' ? 'win' : match.result === 'loss' ? 'loss' : ''}`}>{match.result === 'win' ? '胜' : match.result === 'loss' ? '负' : '平'}</Text><Text className={`match-delta ${delta >= 0 ? 'pos' : 'neg'}`}>{formatDelta(delta)}</Text></View>
            </View>
          })}
          {filtered.length > 15 && <View className="records-expand" onClick={() => setExpanded((value) => !value)}><Text>{expanded ? '收起历史记录' : `展开全部 ${filtered.length} 场`}</Text></View>}
        </View>
      </>}
    </View>
  )
}

function FourTables({ season, seasonLabel, tables }: { season: MatchSeason; seasonLabel: string; tables: TableSummary[] }) {
  return (
    <View className="section-card section-card-last">
      <View className="section-head"><Text className="section-title">我的桌子</Text><Text className="ranking-scope">{seasonLabel}</Text></View>
      {!tables.length && <View className="records-list-empty">
        <Text className="records-empty-text">还没有入座。可以新建一桌，或用邀请码加入朋友的桌子。</Text>
        <Button color="primary" shape="round" onClick={() => Taro.navigateTo({ url: '/pages/table-create/index' })}>添加桌子</Button>
      </View>}
      {tables.map((table) => {
        const ctx = table.id === 'fixed-four' ? undefined : tableContext(table)
        const records = listMatches(ctx)
        const stats = computeMatchStats(records, { season, playerName: table.mySeat, seats: table.id === 'fixed-four' ? undefined : table.seats })
        const mine = evaluateMatchBadges(records, table.mySeat, table.id === 'fixed-four' ? undefined : table.seats).filter((badge) => badge.unlockedAt).length
        return <View key={table.id} className="table-card" onClick={() => Taro.navigateTo({ url: `/pages/table/index?id=${encodeURIComponent(table.id)}` })}>
          <View className="table-card-main">
            <Text className="table-card-name">{table.name}</Text>
            <Text className="table-card-seats">{table.seats.join(' · ')}</Text>
            <Text className="table-card-meta">我是 {table.mySeat} · {mine} 枚本桌荣誉</Text>
          </View>
          <Text className={`table-card-score ${stats.cumulative >= 0 ? 'pos' : 'neg'}`}>{formatDelta(stats.cumulative)}</Text>
        </View>
      })}
      {!!tables.length && <View className="records-expand" onClick={() => Taro.navigateTo({ url: '/pages/table-create/index' })}><Text>添加桌子或输入邀请码</Text></View>}
    </View>
  )
}
