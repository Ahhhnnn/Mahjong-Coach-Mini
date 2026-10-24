import { useCallback, useEffect, useRef, useState } from 'react'
import { Input, Picker, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Switch } from '@taroify/core'
import { ArrowDown, CalendarOutlined } from '@taroify/icons'
import TableIdentityGate from '../../components/table-identity-gate'
import { useTableIdentity } from '../../hooks/use-table-identity'
import { useVenueStatus } from '../../hooks/use-venue-status'
import { useVenueDrawAnimation } from '../../hooks/use-venue-draw-animation'
import { identityScope } from '../../core/table-identity-service'
import { drawVenue, fetchVenueStatus, fetchVenueHistory, formatVenueDrawTime, saveVenues, type Venue, type VenueConfig, type VenueDraw } from '../../core/venue-service'
import './index.scss'

const messageOf = (error: unknown) => error instanceof Error ? error.message : '操作失败，请稍后重试'

export default function VenuePage() {
  const { identity, scope } = useTableIdentity()
  const [selectedDate, setSelectedDate] = useState<string>()
  const { status, calendar, loading, error, refresh } = useVenueStatus(scope, selectedDate)
  const animation = useVenueDrawAnimation(scope, selectedDate)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [actionError, setActionError] = useState('')
  const [draft, setDraft] = useState<VenueConfig>()
  const [editing, setEditing] = useState(false)
  const [history, setHistory] = useState<VenueDraw[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [historyScope, setHistoryScope] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const historySequence = useRef(0)
  const loadHistory = useCallback(async (before?: string) => {
    if (!scope || identityScope() !== scope) return
    const id = ++historySequence.current
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const result = await fetchVenueHistory(before)
      if (id !== historySequence.current || identityScope() !== scope) return
      setHistory((previous) => before ? [...previous, ...result.items.filter((item) => !previous.some((old) => old.date === item.date))] : result.items)
      setCursor(result.nextCursor)
      setHistoryScope(scope)
    } catch (e) { if (id === historySequence.current && identityScope() === scope) setHistoryError(messageOf(e)) }
    finally { if (id === historySequence.current) setHistoryLoading(false) }
  }, [scope])
  useEffect(() => {
    setSelectedDate(undefined); setEditing(false); setDraft(undefined); setActionError(''); setHistory([]); setCursor(null); setHistoryScope('')
    void loadHistory()
    return () => { historySequence.current++ }
  }, [scope, loadHistory])
  useDidShow(() => { void loadHistory() })
  const candidates = status?.config.venues.filter((venue) => venue.enabled) || []
  const runDraw = async () => {
    if (lock.current || !status?.canDraw || status.draw || loading || !candidates.length) return
    lock.current = true
    setBusy(true); setActionError('')
    try {
      const confirmation = await Taro.showModal({ title: `为 ${status.date} 的牌局抽签`, content: `${candidates.length === 1 ? '当前只有一家候选。' : `当前有 ${candidates.length} 家候选，等概率抽取。`}将使用今天全桌唯一的抽取机会，此牌局日期抽定后不可重抽。`, confirmText: '确认抽取', confirmColor: '#1a5c2e' })
      if (!confirmation.confirm || identityScope() !== scope) return
      const result = await animation.play(status.date, candidates, async () => (await drawVenue(status.date)).draw)
      if (!result || identityScope() !== scope) return
      await Promise.all([refresh(), loadHistory()])
    } catch (e) { if (identityScope() === scope) setActionError(messageOf(e)) }
    finally { lock.current = false; setBusy(false) }
  }
  const startEdit = async () => {
    if (lock.current) return
    lock.current = true; setBusy(true)
    try {
      if (editing) {
        const confirmation = await Taro.showModal({ title: '重新加载名单', content: '将放弃尚未保存的修改，加载云端最新名单。', confirmText: '重新加载' })
        if (!confirmation.confirm || identityScope() !== scope) return
      }
      // 刷新失败时保留正在编辑的草稿。
      const latest = await fetchVenueStatus()
      if (identityScope() !== scope) return
      setDraft({ version: latest.config.version, venues: latest.config.venues.map((v) => ({ ...v })) })
      setEditing(true); setActionError('')
    } catch (e) { if (identityScope() === scope) setActionError(messageOf(e)) }
    finally { lock.current = false; setBusy(false) }
  }
  const changeVenue = (index: number, patch: Partial<Venue>) => setDraft((current) => current && ({ ...current, venues: current.venues.map((v, i) => i === index ? { ...v, ...patch } : v) }))
  const moveVenue = (index: number, offset: number) => setDraft((current) => {
    if (!current || index + offset < 0 || index + offset >= current.venues.length) return current
    const venues = [...current.venues]
    ;[venues[index], venues[index + offset]] = [venues[index + offset], venues[index]]
    return { ...current, venues }
  })
  const save = async () => {
    if (lock.current || !draft) return
    lock.current = true; setBusy(true); setActionError('')
    try {
      await saveVenues(draft)
      if (identityScope() !== scope) return
      setEditing(false); setDraft(undefined)
      await refresh()
      Taro.showToast({ title: '名单已保存', icon: 'success' })
    } catch (e) { if (identityScope() === scope) setActionError(messageOf(e)) }
    finally { lock.current = false; setBusy(false) }
  }
  if (!identity) return <TableIdentityGate />
  const frame = animation.frame
  const draw = frame ? undefined : animation.result || status?.draw
  const displayDate = frame?.date || draw?.date || selectedDate || status?.date
  const displayCandidates = frame?.candidates || draw?.candidates || candidates
  const chooseDate = (date?: string) => {
    if (lock.current || busy) return
    animation.reset()
    setActionError(''); setSelectedDate(date)
    if (date === selectedDate) void refresh()
  }
  return <View className="venue-page">
    <View className="venue-heading"><Text className="venue-kicker">四人常聚 · 提前定签</Text><Text className="venue-title">为下一场，定个去处</Text><Text className="venue-description">先选打牌的日期，再把相聚的地点交给这一签。</Text></View>
    <View className="venue-date-card">
      <View className="venue-date-heading"><Text>牌局日期</Text><Button size="small" variant="text" disabled={busy || !calendar} onClick={() => chooseDate()}>选今天</Button></View>
      <Picker mode="date" value={displayDate || calendar?.today || ''} end={calendar?.maxDate} disabled={busy || !calendar?.today}
        onChange={(event) => chooseDate(event.detail.value)}>
        <View className="venue-date-picker"><CalendarOutlined size={22} color="#1a5c2e" /><Text>{displayDate || '正在获取日期…'}</Text><ArrowDown size={16} color="#1a5c2e" /></View>
      </Picker>
      <Text className="venue-muted">可提前 30 天选店；历史日期只查看，不补抽。</Text>
    </View>
    <View className={`venue-ticket ${frame ? 'is-drawing' : draw ? 'is-drawn' : ''} ${animation.result ? 'just-revealed' : ''}`}>
      <View className="venue-ticket-top"><Text>{displayDate || '所选日期'} · 牌局</Text><Text className="venue-stamp">{frame ? '抽签中' : draw ? '已定' : loading ? '查签' : '待抽'}</Text></View>
      <Text className="venue-result-label">{frame ? frame.phase === 'rolling' ? '好去处，正在轮换' : frame.phase === 'slowing' ? '慢慢落定，准备揭晓' : '正在确认这一签…' : draw ? '这场相聚于' : '这场目的地，等待揭晓'}</Text>
      {frame ? <View className={`venue-reel phase-${frame.phase}`} aria-label="正在抽取棋牌室，请稍候">
        <View className="venue-reel-track" />
        <View className="venue-reel-window"><Text key={frame.turn} className="venue-reel-name">{frame.candidate.name}</Text></View>
        <View className="venue-reel-dots"><View /><View /><View /></View>
        <Text className="venue-reel-caption">{frame.candidates.length === 1 ? '一间好去处，也认真定个签' : `${frame.candidates.length} 间好去处 · 等一个相聚的答案`}</Text>
      </View> : <Text className="venue-result-name">{draw ? draw.venue.name : '一签定去处'}</Text>}
      <Text className="venue-result-meta">{frame ? '签在路上，稍等片刻' : draw ? `${draw.drawnBy} · ${formatVenueDrawTime(draw.drawnAt)} 抽取` : '四个人，一个共同的结果'}</Text>
      <View className="venue-ticket-rule"><Text>{frame ? '正在为这场牌局定签，请等待结果揭晓。' : draw ? '这个牌局日期已定签，换一天来查看也不能重抽。' : status?.unavailableReason || '每天全桌最多发起一次；每个牌局日期仅可定签一次。'}</Text></View>
      {!draw && <Button color="primary" block shape="round" loading={busy} disabled={busy || loading || !status?.canDraw || !candidates.length} onClick={runDraw}>{frame ? '正在抽签，静候揭晓' : !status ? '正在查询该日签…' : !status.canDraw ? '当前不可抽取' : !candidates.length ? '等待管理员添加棋牌室' : `抽取 ${status.date} 的地点`}</Button>}
    </View>
    {!frame && status?.dailyDraw && <View className="venue-daily-note"><Text>今天的抽取机会已用于 {status.dailyDraw.targetDate} 的牌局。</Text>{displayDate !== status.dailyDraw.targetDate && <Button variant="text" size="small" disabled={busy} onClick={() => chooseDate(status.dailyDraw!.targetDate)}>查看该签</Button>}</View>}
    {!frame && !!(error || actionError) && <Text className="venue-error">{actionError || error}</Text>}
    <Button variant="text" block loading={loading} disabled={busy || loading} onClick={() => { animation.reset(); void refresh(); void loadHistory() }}>刷新所选日期结果</Button>
    <View className="venue-section">
      <View className="venue-section-head"><Text className="venue-section-title">{draw ? '本次候选' : '候选棋牌室'}</Text><Text className="venue-muted">{draw ? `${draw.candidates.length} 家 · 抽取时名单` : `${displayCandidates.length} 家 · 等概率`}</Text></View>
      <View className="venue-candidates">{displayCandidates.map((venue, i) => <View key={venue.id} className={`venue-candidate ${draw?.venue.id === venue.id ? 'chosen' : ''} ${frame?.candidate.id === venue.id ? 'is-rolling' : ''}`}><Text className="venue-candidate-number">{String(i + 1).padStart(2, '0')}</Text><Text>{venue.name}</Text>{draw?.venue.id === venue.id && <Text className="venue-chosen-mark">本场</Text>}{frame?.candidate.id === venue.id && <View className="venue-candidate-pulse" />}</View>)}</View>
      {status && !draw && !candidates.length && <Text className="venue-muted">还没有启用的棋牌室，请联系 HENING 维护名单。</Text>}
      {identity.role === 'admin' && <Button variant="text" block disabled={busy} onClick={startEdit}>{editing ? '重新加载名单' : '管理棋牌室名单'}</Button>}
    </View>
    {editing && draft && identity.role === 'admin' && <View className="venue-section">
      <View className="venue-section-head"><Text className="venue-section-title">维护名单</Text><Text className="venue-muted">{draft.venues.length} / 50</Text></View>
      <Text className="venue-muted venue-help">改名、停用不影响已抽取的结果。关闭开关即可停用；上下调整仅影响展示顺序。</Text>
      {draft.venues.map((venue, i) => <View className="venue-editor-row" key={venue.id || `new-${i}`}>
        <Input className="venue-name-input" value={venue.name} maxlength={100} placeholder="填写棋牌室名称" disabled={busy} onInput={(e) => changeVenue(i, { name: e.detail.value })} />
        <View className="venue-editor-tools"><View className="venue-switch"><Text>{venue.enabled ? '已启用' : '已停用'}</Text><Switch checked={venue.enabled} disabled={busy} size={20} onChange={(enabled) => changeVenue(i, { enabled })} /></View>
          <View className="venue-order"><Button size="small" variant="text" disabled={busy || i === 0} onClick={() => moveVenue(i, -1)}>上移</Button><Button size="small" variant="text" disabled={busy || i === draft.venues.length - 1} onClick={() => moveVenue(i, 1)}>下移</Button>
            {!venue.id && <Button size="small" variant="text" disabled={busy} onClick={() => setDraft({ ...draft, venues: draft.venues.filter((_, index) => index !== i) })}>移除</Button>}</View>
        </View>
      </View>)}
      <Button block variant="outlined" disabled={busy || draft.venues.length >= 50} onClick={() => setDraft({ ...draft, venues: [...draft.venues, { id: '', name: '', enabled: true }] })}>添加棋牌室</Button>
      <View className="venue-save-row"><Button block shape="round" color="primary" loading={busy} disabled={busy} onClick={save}>保存名单</Button><Button block variant="text" disabled={busy} onClick={() => { setEditing(false); setDraft(undefined); setActionError('') }}>取消编辑</Button></View>
      {!!actionError && <Text className="venue-error">{actionError}</Text>}
    </View>}
    <View className="venue-section">
      <View className="venue-section-head"><Text className="venue-section-title">相聚签簿</Text><Text className="venue-muted">按牌局日期排列 · 点击查看</Text></View>
      {(historyScope === scope ? history : []).filter((item) => !frame || item.date !== frame.date).map((item) => <View className="venue-history-row" key={item.date} role="button" aria-label={`查看 ${item.date} 的牌局抽签结果`} onClick={() => { if (!busy) { chooseDate(item.date); void Taro.pageScrollTo({ scrollTop: 0, duration: 200 }) } }}><View><Text className="venue-history-date">{item.date} · 牌局</Text><Text className="venue-history-name">{item.venue.name}</Text><Text className="venue-muted">{item.drawnBy} · {formatVenueDrawTime(item.drawnAt)} 抽取</Text></View><Text className="venue-history-stamp">查看</Text></View>)}
      {!history.length && !historyLoading && !historyError && <Text className="venue-muted">签簿还是空的，等下一次相聚。</Text>}
      {!!historyError && <Text className="venue-error">{historyError}</Text>}
      <Button variant="text" block loading={historyLoading} disabled={historyLoading || busy} onClick={() => { void loadHistory(historyError ? undefined : cursor || undefined) }}>{historyError ? '重试加载签簿' : cursor ? '查看更早的签' : '刷新签簿'}</Button>
    </View>
    <Text className="venue-footnote">按北京时间计算每日机会。选中的日期是打牌日，抽取时间会单独记录。若遇满房或停业，可自行商量去处，录分时填写实际地点；已定的签保持不变。</Text>
  </View>
}
