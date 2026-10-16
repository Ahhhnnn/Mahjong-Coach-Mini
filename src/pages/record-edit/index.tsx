import { useMemo, useState } from 'react'
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
  listRecentPlayerNames,
  removeMatch,
  upsertMatch,
  getPreferUnit,
} from '../../core/match-service'
import {
  PERFORMANCE_OPTIONS,
  PLAYER_AVATAR_COLORS,
  REASON_OPTIONS,
  VARIANT_LABELS,
  type MatchPerformance,
  type MatchReason,
  type MatchVariant,
  type SettleUnit,
} from '../../core/match-types'

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

function emptyPlayers(): PlayerDraft[] {
  return [
    { name: '我的', isSelf: true, delta: '' },
    { name: '', isSelf: false, delta: '' },
    { name: '', isSelf: false, delta: '' },
    { name: '', isSelf: false, delta: '' },
  ]
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
  const [settleUnit, setSettleUnit] = useState<SettleUnit>(getPreferUnit())
  const [players, setPlayers] = useState<PlayerDraft[]>(emptyPlayers)
  const [performance, setPerformance] = useState<MatchPerformance | undefined>('good')
  const [reasons, setReasons] = useState<MatchReason[]>([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const recentNames = useMemo(() => listRecentPlayerNames(), [])
  const recentLocations = useMemo(() => listRecentLocations(), [])

  const multiValue = useMemo(() => {
    const d = new Date(playedAt)
    const dayStart = new Date(d)
    dayStart.setHours(0, 0, 0, 0)
    let dayIdx = dayOptions.findIndex((x) => x.time === dayStart.getTime())
    if (dayIdx < 0) dayIdx = dayOptions.length - 1
    return [dayIdx, d.getHours(), d.getMinutes()]
  }, [playedAt, dayOptions])

  useLoad((opts) => {
    const id = opts?.id as string | undefined
    if (!id) return
    const record = getMatch(id)
    if (!record) return
    setEditId(record.id)
    setDayOptions(buildDayOptions(record.playedAt))
    setPlayedAt(record.playedAt)
    setNote(record.note || '')
    setLocation(record.location || '')
    setSettleUnit(record.settleUnit)
    setPerformance(record.performance)
    setReasons(record.reasons || [])
    const drafts: PlayerDraft[] = record.players.slice(0, 4).map((p) => {
      const v = settleUnitField(p, record.settleUnit)
      return {
        name: p.isSelf ? p.name || '我的' : p.name,
        isSelf: p.isSelf,
        delta: v === undefined || v === null ? '' : String(v),
      }
    })
    while (drafts.length < 4) {
      drafts.push({ name: '', isSelf: false, delta: '' })
    }
    if (!drafts.some((p) => p.isSelf)) drafts[0].isSelf = true
    setPlayers(withAutoLastDelta(drafts))
    Taro.setNavigationBarTitle({ title: '编辑牌局' })
  })

  const unitLabel = settleUnit === 'score' ? '分' : '元'
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

  const handleSave = () => {
    if (saving) return

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
      let name = p.name.trim()
      if (p.isSelf) name = name || '我'
      else if (!name || name === '玩家') name = `玩家${i + 1}`
      return {
        name,
        isSelf: p.isSelf,
        scoreDelta: settleUnit === 'score' ? num : undefined,
        moneyDelta: settleUnit === 'money' ? num : undefined,
      }
    })

    if (!parsed.some((p) => p.isSelf)) {
      Taro.showToast({ title: '需要标记「我」', icon: 'none' })
      return
    }

    setSaving(true)
    try {
      upsertMatch({
        id: editId,
        playedAt,
        variant,
        location,
        settleUnit,
        players: parsed,
        performance,
        reasons,
        note,
      })
      Taro.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 400)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    if (!editId) return
    Taro.showModal({
      title: '删除牌局',
      content: '删除后不可恢复，确认删除？',
      success: (res) => {
        if (!res.confirm) return
        removeMatch(editId)
        Taro.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => Taro.navigateBack(), 400)
      },
    })
  }

  return (
    <View className="record-edit-page">
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
        <View className="unit-switch">
          <Text
            className={`unit-btn ${settleUnit === 'score' ? 'active' : ''}`}
            onClick={() => setSettleUnit('score')}
          >
            记分
          </Text>
          <Text
            className={`unit-btn ${settleUnit === 'money' ? 'active' : ''}`}
            onClick={() => setSettleUnit('money')}
          >
            记金额
          </Text>
        </View>
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
                  {p.isSelf ? (
                    <Text className="player-name">我的</Text>
                  ) : (
                    <Input
                      className="player-name-input"
                      value={p.name}
                      placeholder={`玩家${i}`}
                      onInput={(e) => updatePlayer(i, { name: e.detail.value })}
                    />
                  )}
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
        {recentNames.length > 0 && (
          <View className="chip-row">
            <Text className="chip-hint">常用：</Text>
            {recentNames.slice(0, 6).map((n) => (
              <Text
                key={n}
                className="chip"
                onClick={() => {
                  const idx = players.findIndex((p) => !p.isSelf && !p.name.trim())
                  if (idx >= 0) updatePlayer(idx, { name: n })
                  else Taro.showToast({ title: '请先清空一个玩家名', icon: 'none' })
                }}
              >
                {n}
              </Text>
            ))}
          </View>
        )}
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
          <Text className="section-title">本场复盘</Text>
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
        <Text className="sub-label">牌局备注</Text>
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

function settleUnitField(
  p: { scoreDelta?: number; moneyDelta?: number },
  unit: SettleUnit
): number | undefined {
  return unit === 'score' ? p.scoreDelta : p.moneyDelta
}
