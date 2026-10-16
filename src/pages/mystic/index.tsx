import { useMemo, useState } from 'react'
import { Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Popup, Tabs } from '@taroify/core'
import { Arrow, ArrowDown, Cross } from '@taroify/icons'
import { isLoggedIn } from '../../core/auth'
import { listMatches, syncCloudMatchesToLocal } from '../../core/match-service'
import {
  computeMatchMystic, formatMysticRate, formatMysticScore, MYSTIC_MIN_GAMES,
} from '../../core/match-mystic-service'
import { getMatchSeasonAt, MATCH_SEASON_OPTIONS, type MatchSeason } from '../../core/match-stats-service'
import { getPlayerDelta, getSelfDelta, type MatchRecord } from '../../core/match-types'
import './index.scss'

type Evidence = { kind: 'opponent' | 'location'; name: string }

function playedAtLabel(time: number): string {
  const date = new Date(time + 8 * 3600000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

export default function MysticPage() {
  const [records, setRecords] = useState<MatchRecord[]>([])
  const [season, setSeason] = useState<MatchSeason>()
  const [tab, setTab] = useState('opponents')
  const [evidence, setEvidence] = useState<Evidence>()
  useDidShow(() => {
    const refresh = () => setRecords(listMatches())
    refresh()
    if (isLoggedIn()) void syncCloudMatchesToLocal().then(refresh)
  })
  const stats = useMemo(() => computeMatchMystic(records, season), [records, season])
  const periods = useMemo(() => {
    const years = Array.from(new Set([
      getMatchSeasonAt().year,
      ...records.map((record) => getMatchSeasonAt(record.playedAt).year).filter(Number.isFinite),
      ...(season ? [season.year] : []),
    ])).sort((a, b) => b - a)
    return [
      { label: '全部历史', season: undefined as MatchSeason | undefined },
      ...years.flatMap((year) => MATCH_SEASON_OPTIONS.map((option) => ({
        label: `${year} · ${option.label}`, season: { year, period: option.value },
      }))),
    ]
  }, [records, season])
  const periodIndex = Math.max(0, periods.findIndex((item) => item.season?.year === season?.year
    && item.season?.period === season?.period))
  const scopeLabel = periods[periodIndex].label
  const selectedEntry = evidence?.kind === 'opponent'
    ? stats.opponents.find((entry) => entry.name === evidence.name)
    : stats.locations.find((entry) => entry.name === evidence?.name)
  const evidenceIds = new Set(selectedEntry?.matchIds || [])
  const evidenceRecords = records.filter((record) => evidenceIds.has(record.id))
  const lucky = stats.locations.find((place) => stats.luckyPlaces.includes(place.name))
  const unlucky = stats.locations.find((place) => stats.unluckyPlaces.includes(place.name))
  const goEdit = (id?: string) => Taro.navigateTo({
    url: `/pages/record-edit/index${id ? `?id=${encodeURIComponent(id)}` : ''}`,
  })
  return (
    <View className="mystic-page">
      <View className="mystic-book-header">
        <View className="mystic-book-meta"><Text>我的牌桌命簿</Text><Text>以牌为记 · 以局为据</Text></View>
        <View className="mystic-book-title-row">
          <View><Text className="mystic-book-title">牌桌玄学</Text><Text className="mystic-book-subtitle">冤家有路，福地有门。</Text></View>
          <View className="mystic-book-stamp"><Text>牌桌</Text><Text>有缘</Text></View>
        </View>
        <Picker mode="selector" range={periods.map((item) => item.label)} value={periodIndex}
          onChange={(event) => {
            const next = periods[Number(event.detail.value)]
            if (next) { setSeason(next.season); setEvidence(undefined) }
          }}>
          <View className="mystic-period"><View><Text className="mystic-period-label">{scopeLabel}</Text><Text className="mystic-period-count">共 {stats.games} 场有效牌局</Text></View><ArrowDown size={16} /></View>
        </Picker>
      </View>

      <Tabs className="mystic-tabs" value={tab} bordered={false} onChange={(value: string) => setTab(value)}>
        <Tabs.TabPane title="牌友相克" value="opponents" />
        <Tabs.TabPane title="福地雷区" value="locations" />
      </Tabs>

      {!stats.games ? (
        <View className="mystic-empty">
          <Text className="mystic-empty-mark">待续</Text>
          <Text className="mystic-empty-title">这一页命簿，尚未落笔</Text>
          <Text className="mystic-body-note">{scopeLabel}还没有有效积分牌局，切换范围或记下下一场。</Text>
          <Button color="primary" shape="round" onClick={() => goEdit()}>记一场牌局</Button>
        </View>
      ) : tab === 'opponents' ? (
        <View className="mystic-chapter">
          <View className="mystic-chapter-heading"><Text className="mystic-chapter-number">壹</Text><View><Text className="mystic-chapter-title">谁是我的头号冤家</Text><Text className="mystic-body-note">同场见高低，冤家也有迹可循</Text></View></View>
          <View className="mystic-verdict rival">
            <Text className="mystic-verdict-label">{stats.nemeses.length > 1 ? '并列头号冤家' : '头号冤家'}</Text>
            <Text className="mystic-verdict-name">{stats.nemeses.join('、') || (stats.games < MYSTIC_MIN_GAMES ? '还在观察中' : '暂无明显克星')}</Text>
            <Text className="mystic-verdict-note">{stats.nemeses.length ? '同场压制率最高，超过一半场次积分高于我。' : `至少 ${MYSTIC_MIN_GAMES} 场，且超过一半场次积分高于我，才认这位冤家。`}</Text>
          </View>
          <Text className="mystic-list-heading">三位牌友 · 逐一过招</Text>
          {stats.opponents.map((person, index) => (
            <View className="mystic-person" key={person.name} onClick={() => setEvidence({ kind: 'opponent', name: person.name })} role="button" aria-label={`查看与 ${person.name} 的牌局`}>
              <View className="mystic-entry-heading"><View className="mystic-person-identity"><Text className="mystic-person-index">0{index + 1}</Text><Text className="mystic-entry-name">{person.name}</Text></View><View className="mystic-entry-tag-row">{!person.eligible ? <Text className="mystic-tag">待观察</Text> : stats.nemeses.includes(person.name) && <Text className="mystic-tag red">头号冤家</Text>}<Arrow size={14} /></View></View>
              <View className="mystic-pressure"><Text className="mystic-pressure-value">{formatMysticRate(person.pressureRate)}</Text><Text className="mystic-body-note">压制率 · 同场 {person.games} 场</Text></View>
              <View className="mystic-pressure-bar"><View className="mystic-pressure-fill" style={{ width: `${person.pressureRate}%` }} /></View>
              <View className="mystic-person-counts"><Text>压我 <Text className="mystic-count">{person.ahead}</Text> 场</Text><Text>我领先 <Text className="mystic-count">{person.behind}</Text> 场</Text><Text>同分 <Text className="mystic-count">{person.tied}</Text> 场</Text></View>
              <View className="mystic-entry-foot"><Text>场均积分差 {formatMysticScore(person.averageGap)}</Text><Text>对方 − 我</Text></View>
            </View>
          ))}
        </View>
      ) : (
        <View className="mystic-chapter">
          <View className="mystic-chapter-heading"><Text className="mystic-chapter-number">贰</Text><View><Text className="mystic-chapter-title">哪里是我的风水宝地</Text><Text className="mystic-body-note">同一副牌，不同地方的手气</Text></View></View>
          <View className="mystic-place-verdicts">
            <View className="mystic-verdict lucky"><Text className="mystic-verdict-label">{stats.luckyPlaces.length > 1 ? '并列福地' : '熟悉的福地'}</Text><Text className="mystic-verdict-name">{stats.luckyPlaces.join('、') || '尚待发现'}</Text><Text className="mystic-verdict-note">{lucky ? `场均 ${formatMysticScore(lucky.average)}` : '五场以上，场均正分最高'}</Text></View>
            <View className="mystic-verdict rival"><Text className="mystic-verdict-label">{stats.unluckyPlaces.length > 1 ? '并列雷区' : '目前的雷区'}</Text><Text className="mystic-verdict-name">{stats.unluckyPlaces.join('、') || '暂无雷区'}</Text><Text className="mystic-verdict-note">{unlucky ? `场均 ${formatMysticScore(unlucky.average)}` : '五场以上，场均负分最低'}</Text></View>
          </View>
          <Text className="mystic-list-heading">地点手记 · {stats.locations.length} 处</Text>
          {!stats.locations.length && <View className="mystic-place-empty"><Text className="mystic-body-note">这些牌局还没有填写地点，补充后就能看看哪里更旺你。</Text></View>}
          {stats.locations.map((place) => (
            <View className="mystic-place" key={place.name} onClick={() => setEvidence({ kind: 'location', name: place.name })} role="button" aria-label={`查看 ${place.name} 的牌局`}>
              <View className="mystic-entry-heading"><Text className="mystic-entry-name">{place.name}</Text><View className="mystic-entry-tag-row">{!place.eligible ? <Text className="mystic-tag">待观察 · {place.games}/{MYSTIC_MIN_GAMES} 场</Text> : stats.luckyPlaces.includes(place.name) ? <Text className="mystic-tag green">福地</Text> : stats.unluckyPlaces.includes(place.name) ? <Text className="mystic-tag red">雷区</Text> : null}<Arrow size={14} /></View></View>
              <View className="mystic-place-metrics"><View><Text className={`mystic-place-average ${place.average >= 0 ? 'positive' : 'negative'}`}>{formatMysticScore(place.average)}</Text><Text className="mystic-body-note">场均积分</Text></View><View className="mystic-place-secondary"><Text>{place.games} 场 · 正分率 {formatMysticRate(place.positiveRate)}</Text><Text>累计 {formatMysticScore(place.total)}</Text></View></View>
            </View>
          ))}
          <Text className="mystic-sample-note">地点至少 {MYSTIC_MIN_GAMES} 场才参与福地与雷区评选，未填写地点的牌局不参与地点分析。</Text>
        </View>
      )}
      <View className="mystic-colophon"><View className="mystic-colophon-rule" /><Text>玄学有趣，牌局有据</Text><Text className="mystic-method">压制率＝对方最终积分高于我的场次 ÷ 同场场次，同分单列。仅比较同场最终积分，不代表两人间的实际输赢流水。</Text></View>

      <Popup className="mystic-evidence-popup" open={!!evidence} placement="bottom" rounded onClose={() => setEvidence(undefined)}>
        <Popup.Backdrop />
        <View className="mystic-evidence-header"><View><Text className="mystic-chapter-title">{evidence?.name} · 牌局手记</Text><Text className="mystic-body-note">{scopeLabel} · {evidenceRecords.length} 场 · 按发生时间排列</Text></View><Button className="mystic-close" variant="text" aria-label="关闭牌局手记" onClick={() => setEvidence(undefined)}><Cross size={20} /></Button></View>
        <ScrollView scrollY className="mystic-evidence-scroll">
          {!evidenceRecords.length && <Text className="mystic-body-note">当前范围已无相关牌局。</Text>}
          {evidenceRecords.map((record) => {
            const other = record.players.find((player) => player.name === evidence?.name)
            return <View className="mystic-evidence-row" key={record.id} role="button" onClick={() => goEdit(record.id)}>
              <Text className="mystic-evidence-date">{playedAtLabel(record.playedAt)}</Text>
              <View className="mystic-entry-heading"><Text className="mystic-evidence-location">{record.location?.trim() || '未填地点'}</Text><Arrow size={13} /></View>
              <View className="mystic-evidence-scores"><Text>我 {formatMysticScore(getSelfDelta(record))}</Text>{other && <Text>{other.name} {formatMysticScore(getPlayerDelta(other))}</Text>}</View>
            </View>
          })}
          <Text className="mystic-evidence-hint">点击牌局查看或编辑记录</Text>
        </ScrollView>
      </Popup>
    </View>
  )
}
