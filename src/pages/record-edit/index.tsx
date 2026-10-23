import { useEffect, useMemo, useState } from 'react'
import { View, Text, Input, Picker, Textarea } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { Button } from '@taroify/core'
import {
  NotesOutlined,
  CalendarOutlined,
  LocationOutlined,
  AppsOutlined,
  FriendsOutlined,
  BarChartOutlined,
} from '@taroify/icons'

import {
  getMatch,
  listRecentLocations,
  removeMatch,
  upsertMatch,
  getMatchConflict,
  discardMatchConflict,
  syncCloudMatchesToLocal,
} from '../../core/match-service'
import {
  PERFORMANCE_OPTIONS,
  FIXED_MATCH_PLAYERS,
  PLAYER_AVATAR_COLORS,
  REASON_OPTIONS,
  VARIANT_LABELS,
  SELF_PLAYER_NAME,
  type MatchPerformance,
  type MatchReason,
  type MatchVariant,
} from '../../core/match-types'

import { useTableIdentity } from '../../hooks/use-table-identity'
import { identityScope } from '../../core/table-identity-service'
import TableIdentityGate from '../../components/table-identity-gate'

import './index.scss'

const BRAND = '#1a5c2e'
const DAY_SPAN = 60

type PlayerDraft = {
  name: string
  isSelf: boolean
  delta: string
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function buildDayOptions(earliest?: number) {
  const today = startOfToday()
  const days: { label: string; time: number }[] = []
  const span = Math.max(DAY_SPAN, earliest ? Math.ceil((today.getTime() - earliest) / 86400000) + 2 : DAY_SPAN)
  for (let i = span - 1; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const label =
      i === 0
        ? '今天'
        : i === 1
          ? '昨天'
          : `${d.getMonth() + 1}/${d.getDate()}`
    days.push({ label, time: d.getTime() })
  }
  return days
}

function formatDisplayTime(ts: number) {
  const d = new Date(ts)
  const today = startOfToday()
  const dayStart = new Date(d)
  dayStart.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - dayStart.getTime()) / 86400000)
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  if (diffDays === 0) return `今天 ${hm}`
  if (diffDays === 1) return `昨天 ${hm}`
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

function emptyPlayers(selfName: string = SELF_PLAYER_NAME): PlayerDraft[] {
  return FIXED_MATCH_PLAYERS.map((name) => ({ name, isSelf: name === selfName, delta: '' }))
}

const LAST_PLAYER_INDEX = 3

function parseDeltaInput(raw: string): number | null {
  const t = raw.trim()
  if (t === '' || t === '-' || t === '.' || t === '-.') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function withAutoLastDelta(list: PlayerDraft[]): PlayerDraft[] {
  const next = list.map((p) => ({ ...p }))
  const firstThree = [0, 1, 2].map((i) => parseDeltaInput(next[i]?.delta ?? ''))
  if (firstThree.every((v) => v !== null)) {
    const auto = -(firstThree[0]! + firstThree[1]! + firstThree[2]!)
    // 避免 -0
    const normalized = Object.is(auto, -0) ? 0 : auto
    next[LAST_PLAYER_INDEX] = {
      ...next[LAST_PLAYER_INDEX],
      delta: String(normalized),
    }
  } else if (next[LAST_PLAYER_INDEX]) {
    next[LAST_PLAYER_INDEX] = { ...next[LAST_PLAYER_INDEX], delta: '' }
  }
  return next
}

export default function RecordEditPage() {
  const { identity, scope } = useTableIdentity()
  const [route, setRoute] = useState<{ id?: string; draft?: string }>({})
  const [loadedRevision, setLoadedRevision] = useState<number>()
  const [loadedScope, setLoadedScope] = useState('')
  const [loadError, setLoadError] = useState('')
  const [dayOptions, setDayOptions] = useState(() => buildDayOptions())
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => pad2(i)), [])
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => pad2(i)), [])
  const multiRange = useMemo(
    () => [dayOptions.map((d) => d.label), hours, minutes],
    [dayOptions, hours, minutes]
  )

  const [editId, setEditId] = useState<string | undefined>()
  const [playedAt, setPlayedAt] = useState(Date.now())
  const [variant] = useState<MatchVariant>('xuezhan')
  const [location, setLocation] = useState('家庭局')
  const [players, setPlayers] = useState<PlayerDraft[]>(() => emptyPlayers(identity?.playerName))
  const [performance, setPerformance] = useState<MatchPerformance | undefined>('good')
  const [reasons, setReasons] = useState<MatchReason[]>([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const recentLocations = useMemo(() => listRecentLocations(), [])

  const multiValue = useMemo(() => {
    const d = new Date(playedAt)
    const dayStart = new Date(d)
    dayStart.setHours(0, 0, 0, 0)
    let dayIdx = dayOptions.findIndex((x) => x.time === dayStart.getTime())
    if (dayIdx < 0) dayIdx = dayOptions.length - 1
    return [dayIdx, d.getHours(), d.getMinutes()]
  }, [playedAt, dayOptions])

  useLoad((opts) => { setRoute({ id: opts?.id, draft: opts?.draft }) })
  useEffect(() => {
    let active = true
    setLoadedScope('')
    setLoadError('')
    if (!identity) return
    const load = async () => {
      if (route.id) await syncCloudMatchesToLocal()
      if (!active || identityScope() !== scope) return
      const record = route.id ? getMatch(route.id) : undefined
      const draft = route.draft && route.id ? getMatchConflict(route.id)?.draft : undefined
      if (route.id && !record && !draft) { setLoadError('这场牌局已不存在，请返回刷新'); return }
      const source = draft || record
      setEditId(record?.id)
      setLoadedRevision(record?.revision)
      setPlayedAt(source?.playedAt || Date.now())
      if (source) setDayOptions(buildDayOptions(source.playedAt))
      setNote(source?.note || '')
      setLocation(source?.location || '家庭局')
      setPerformance(source?.performance)
      setReasons(source?.reasons || [])
      setPlayers(source ? withAutoLastDelta(source.players.map((p) => ({ name: p.name, isSelf: p.name === identity.playerName, delta: String(p.scoreDelta ?? '') }))) : emptyPlayers(identity.playerName))
      setLoadedScope(scope)
      Taro.setNavigationBarTitle({ title: record ? '编辑共享牌局' : '记录共享牌局' })
    }
    void load()
    return () => { active = false }
  }, [scope, route.id, route.draft])

  const unitLabel = '分'
  const scoreSumPreview = useMemo(() => {
    const vals = players.map((p) => parseDeltaInput(p.delta))
    const nums = vals.filter((v): v is number => v !== null)
    if (nums.length !== players.length) return null
    return nums.reduce((s, v) => s + v, 0)
  }, [players])

  const updatePlayer = (index: number, patch: Partial<PlayerDraft>) => {
    setPlayers((prev) => {
      const next = prev.map((p, i) => (i === index ? { ...p, ...patch } : p))
      if (typeof patch.delta === 'string' && index !== LAST_PLAYER_INDEX) {
        return withAutoLastDelta(next)
      }
      return next
    })
  }

  const updatePlayerDelta = (index: number, raw: string) => {
    if (index === LAST_PLAYER_INDEX) return
    updatePlayer(index, { delta: raw.replace(/[^\d.-]/g, '') })
  }

  const toggleReason = (r: MatchReason) => {
    setReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
  }

  const onDateTimeChange = (e: any) => {
    const [dayIdx, hourIdx, minuteIdx] = e.detail.value as number[]
    const day = dayOptions[dayIdx] || dayOptions[dayOptions.length - 1]
    const next = new Date(day.time)
    next.setHours(hourIdx, minuteIdx, 0, 0)
    setPlayedAt(next.getTime())
  }

  const handleSave = async () => {
    if (saving) return
    if (!loadedScope || identityScope() !== loadedScope) { Taro.showToast({ title: '身份已变化，请重新打开', icon: 'none' }); return }

    const deltas = players.map((p) => parseDeltaInput(p.delta))
    const nums = deltas.filter((v): v is number => v !== null)
    if (nums.length !== players.length) {
      Taro.showToast({ title: '请先录完前三家分数', icon: 'none' })
      return
    }

    const sum = nums.reduce((s, v) => s + v, 0)
    if (Math.abs(sum) > 1e-6) {
      Taro.showToast({ title: `比分合计须为 0，当前 ${sum > 0 ? '+' : ''}${sum}`, icon: 'none' })
      return
    }

    const parsed = players.map((p, i) => {
      const num = nums[i]
      return {
        name: p.name,
        isSelf: p.isSelf,
        scoreDelta: num,
      }
    })

    if (!parsed.some((p) => p.isSelf)) {
      Taro.showToast({ title: '需要标记「我」', icon: 'none' })
      return
    }

    if (route.draft && !editId) {
      const confirmation = await Taro.showModal({ title: '另存为新牌局', content: '云端已不存在原牌局。确认这是一场需要单独录入的对局后，将以新 ID 保存，不恢复原记录。' })
      if (!confirmation.confirm) return
    }
    setSaving(true)
    try {
      upsertMatch({
        id: editId,
        revision: loadedRevision,
        playedAt,
        variant,
        location,
        settleUnit: 'score',
        players: parsed,
        performance,
        reasons,
        note,
      })
      if (route.draft && route.id) discardMatchConflict(route.id)
      Taro.showToast({ title: '已保存，等待同步', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 400)
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : '保存失败，请重试', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    if (!editId) return
    Taro.showModal({
      title: '删除牌局',
      content: '删除会同步影响四个人的战绩，确认删除这场公共牌局？',
      success: (res) => {
        if (!res.confirm) return
        if (identityScope() !== loadedScope) return
        try { removeMatch(editId, loadedRevision) } catch (e) { Taro.showToast({ title: e instanceof Error ? e.message : '删除失败', icon: 'none' }); return }
        Taro.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => Taro.navigateBack(), 400)
      },
    })
  }

  if (!identity) return <TableIdentityGate />
  if (loadError || loadedScope !== scope) return <View className="record-edit-page"><Text>{loadError || '正在读取牌局…'}</Text></View>
  return (
    <View className="record-edit-page">
      {route.draft && <Text className="hint-text">正在核对本机草稿。{editId ? '保存会提交到当前云端版本。' : '原牌局已不存在，保存将另建一场，请先确认是否需要。'}</Text>}
      <Text className="hint-text">{identity.playerName} · 四人共享牌局，修改将同步给所有人</Text>
      <View className="section-card">
        <View className="section-head">
          <NotesOutlined size={18} color={BRAND} />
          <Text className="section-title">基础信息</Text>
        </View>
        <View className="basic-cols">
          <Picker mode="multiSelector" range={multiRange} value={multiValue} onChange={onDateTimeChange}>
            <View className="basic-col">
              <CalendarOutlined size={22} color={BRAND} />
              <Text className="basic-label">日期</Text>
              <Text className="basic-value">{formatDisplayTime(playedAt)}</Text>
            </View>
          </Picker>
          <View className="basic-divider" />
          <View className="basic-col">
            <AppsOutlined size={22} color={BRAND} />
            <Text className="basic-label">玩法</Text>
            <Text className="basic-value">{VARIANT_LABELS[variant]}</Text>
          </View>
          <View className="basic-divider" />
          <View className="basic-col">
            <LocationOutlined size={22} color={BRAND} />
            <Text className="basic-label">地点</Text>
            <Input
              className="basic-input"
              value={location}
              placeholder="家庭局"
              onInput={(e) => setLocation(e.detail.value)}
            />
          </View>
        </View>

        {recentLocations.length > 0 && (
          <View className="chip-row">
            {recentLocations.slice(0, 4).map((loc) => (
              <Text key={loc} className="chip" onClick={() => setLocation(loc)}>
                {loc}
              </Text>
            ))}
          </View>
        )}

      </View>

      <View className="section-card">
        <View className="section-head">
          <FriendsOutlined size={18} color={BRAND} />
          <Text className="section-title">本局玩家</Text>
        </View>
        {players.map((p, i) => {
          const isAuto = i === LAST_PLAYER_INDEX
          const deltaNum = parseDeltaInput(p.delta)
          const deltaClass =
            deltaNum !== null && deltaNum < 0 ? 'neg' : deltaNum !== null && deltaNum > 0 ? 'pos' : ''
          return (
            <View key={i} className="player-row">
              <View
                className="player-avatar"
                style={{ background: PLAYER_AVATAR_COLORS[i % PLAYER_AVATAR_COLORS.length] }}
              >
                <Text className="player-avatar-text">{(p.name || '?').slice(0, 1)}</Text>
              </View>
              <View className="player-main">
                <View className="player-name-row">
                  <Text className="player-name">{p.name}{p.isSelf ? '（我）' : ''}</Text>
                  {isAuto && <Text className="auto-badge">自动</Text>}
                </View>
              </View>
              {isAuto ? (
                <Text className={`player-delta player-delta-auto ${deltaClass}`}>
                  {p.delta === '' ? `待计算` : `${Number(p.delta) > 0 ? '+' : ''}${p.delta}${unitLabel}`}
                </Text>
              ) : (
                <Input
                  className={`player-delta ${deltaClass}`}
                  type="text"
                  value={p.delta}
                  placeholder={`0${unitLabel}`}
                  onInput={(e) => updatePlayerDelta(i, e.detail.value)}
                />
              )}
            </View>
          )
        })}
        <Text className="hint-text">
          前三家录入后，第四家自动平衡；四人合计须为 0
          {scoreSumPreview === null
            ? ''
            : scoreSumPreview === 0
              ? ' · 当前合计 0 ✓'
              : ` · 当前合计 ${scoreSumPreview > 0 ? '+' : ''}${scoreSumPreview}`}
        </Text>
      </View>

      <View className="section-card">
        <View className="section-head">
          <BarChartOutlined size={18} color={BRAND} />
          <Text className="section-title">本场复盘 · 仅自己可见</Text>
        </View>
        <Text className="sub-label">你的表现如何？</Text>
        <View className="perf-row">
          {PERFORMANCE_OPTIONS.map((opt) => (
            <View
              key={opt.value}
              className={`perf-btn ${performance === opt.value ? 'active' : ''}`}
              onClick={() => setPerformance(opt.value)}
            >
              <Text className="perf-emoji">{opt.emoji}</Text>
              <Text className="perf-text">{opt.label}</Text>
            </View>
          ))}
        </View>
        <Text className="sub-label">主要原因（可多选）</Text>
        <View className="reason-grid">
          {REASON_OPTIONS.map((opt) => (
            <View
              key={opt.value}
              className={`reason-chip ${reasons.includes(opt.value) ? 'active' : ''}`}
              onClick={() => toggleReason(opt.value)}
            >
              <Text className="reason-emoji">{opt.emoji}</Text>
              <Text className="reason-text">{opt.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="section-card">
        <Text className="sub-label">公共备注 · 四人可见</Text>
        <Textarea className="record-note-input" value={note} maxlength={500} placeholder="记下这场牌局的故事…" onInput={(event) => setNote(event.detail.value)} />
      </View>

      <View className="ai-tip">
        <View className="ai-tip-badge">
          <Text className="ai-tip-badge-text">AI</Text>
        </View>
        <Text className="ai-tip-text">AI 教练会根据你的牌局记录，持续分析你的打法和弱点</Text>
      </View>

      <Button className="save-btn" color="primary" block shape="round" loading={saving} onClick={handleSave}>
        保存牌局
      </Button>
      {editId && (
        <Text className="delete-link" onClick={handleDelete}>
          删除此牌局
        </Text>
      )}
    </View>
  )
}
