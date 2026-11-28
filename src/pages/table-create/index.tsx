import { useState } from 'react'
import { Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@taroify/core'
import { AddOutlined, Arrow, Checked, Qr, ShareOutlined, Star } from '@taroify/icons'
import { isSeatGender, validateTableDraft, type SeatGender } from '../../core/match-types'
import { claimSeat, createTable, previewTable, type TablePreview } from '../../core/table-directory-service'
import { getCachedUser } from '../../core/table-identity-service'
import './index.scss'

type CreateMode = 'create' | 'join'

const SEAT_WIND_LABELS = ['东', '南', '西', '北']
const QUICK_TABLE_NAMES = ['周末血战局', '老友常聚', '宿舍夜战', '茶馆固定桌']

export default function TableCreatePage() {
  const [mode, setMode] = useState<CreateMode>('create')
  const [name, setName] = useState('')
  const [seats, setSeats] = useState(['', '', '', ''])
  const [genders, setGenders] = useState<SeatGender[]>(() => {
    const mineGender = getCachedUser()?.gender
    return [isSeatGender(mineGender) ? mineGender : 'male', 'male', 'female', 'female']
  })
  const [mine, setMine] = useState(0)
  const [code, setCode] = useState('')
  const [preview, setPreview] = useState<TablePreview | null>(null)
  const [createdTable, setCreatedTable] = useState<{ id: string; name: string; code: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const switchMode = (next: CreateMode) => {
    setMode(next)
    setError('')
  }

  const updateSeat = (index: number, value: string) => {
    setSeats((current) => current.map((seat, seatIndex) => seatIndex === index ? value : seat))
  }

  const updateGender = (index: number, gender: SeatGender) => {
    setGenders((current) => current.map((item, seatIndex) => seatIndex === index ? gender : item))
  }

  const create = async () => {
    const message = validateTableDraft(name, seats, seats[mine] || '')
    if (message) {
      setError(message)
      return
    }
    setBusy(true)
    setError('')
    try {
      const cleanedSeats = seats.map((seat) => seat.trim())
      const seatGenders: Record<string, SeatGender> = {}
      cleanedSeats.forEach((seatName, idx) => { seatGenders[seatName] = genders[idx] || 'male' })
      const table = await createTable({
        name: name.trim(),
        seats: cleanedSeats,
        mySeat: cleanedSeats[mine],
        seatGenders,
      })
      setCreatedTable({ id: table.id, name: table.name, code: table.inviteCode || '' })
      Taro.showToast({ title: '牌桌已建好', icon: 'success' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '建桌失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  const copyCode = (inviteCode: string) => {
    void Taro.setClipboardData({
      data: inviteCode,
      success: () => { Taro.showToast({ title: '已复制邀请码', icon: 'success' }) },
    })
  }

  const lookup = async () => {
    if (!code.trim()) {
      setError('请输入 6 位邀请码')
      return
    }
    setBusy(true)
    setError('')
    try {
      setPreview(await previewTable(code))
    } catch (reason) {
      setPreview(null)
      setError(reason instanceof Error ? reason.message : '没有找到这张桌子')
    } finally {
      setBusy(false)
    }
  }

  const join = async (playerName: string) => {
    if (!preview) return
    setBusy(true)
    setError('')
    try {
      const table = await claimSeat(preview.id, playerName)
      Taro.showToast({ title: '已入座', icon: 'success' })
      setTimeout(() => Taro.redirectTo({ url: `/pages/table/index?id=${encodeURIComponent(table.id)}` }), 400)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '入座失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  const nameLength = [...name].length
  const claimedCount = preview ? preview.players.filter((player) => player.claimed).length : 0

  return (
    <View className="table-create-page">
      <View className="tc-mode-switch" role="tablist">
        <View className={`tc-mode-option ${mode === 'create' ? 'active' : ''}`} onClick={() => switchMode('create')}>
          <AddOutlined size={16} color={mode === 'create' ? '#f6e7c1' : '#6b7468'} />
          <Text className="tc-mode-text">新建一桌</Text>
        </View>
        <View className={`tc-mode-option ${mode === 'join' ? 'active' : ''}`} onClick={() => switchMode('join')}>
          <Qr size={16} color={mode === 'join' ? '#f6e7c1' : '#6b7468'} />
          <Text className="tc-mode-text">邀请码加入</Text>
        </View>
      </View>

      {!!error && (
        <View className="tc-error-banner">
          <Text className="tc-error-text">{error}</Text>
        </View>
      )}

      {mode === 'create' ? (
        <>
          {createdTable ? (
            <View className="tc-invite-card">
              <Text className="tc-invite-eyebrow">TABLE INVITE</Text>
              <Text className="tc-invite-title">「{createdTable.name}」已开好</Text>
              <Text className="tc-invite-sub">把邀请码发给三位牌友，入座后即可共同记分</Text>
              <View className="tc-invite-code-box" onClick={() => copyCode(createdTable.code)}>
                {createdTable.code.split('').map((char, idx) => (
                  <View key={idx} className="tc-code-char">
                    <Text className="tc-code-char-text">{char}</Text>
                  </View>
                ))}
              </View>
              <View className="tc-copy-pill" onClick={() => copyCode(createdTable.code)}>
                <ShareOutlined size={14} color="#2c2414" />
                <Text className="tc-copy-pill-text">复制邀请码</Text>
              </View>
              <View className="tc-invite-actions">
                <Button
                  className="tc-btn-enter"
                  color="primary"
                  block
                  shape="round"
                  onClick={() => Taro.redirectTo({ url: `/pages/table/index?id=${encodeURIComponent(createdTable.id)}` })}
                >
                  直接进入牌桌
                </Button>
                <View className="tc-back-link" onClick={() => Taro.navigateBack()}>
                  <Text className="tc-back-link-text">返回牌局列表</Text>
                </View>
              </View>
            </View>
          ) : (
            <>
              <View className="tc-card">
                <View className="tc-card-head">
                  <Text className="tc-card-title">牌桌名称</Text>
                  <Text className="tc-card-count">{nameLength} / 16</Text>
                </View>
                <Input
                  className="tc-name-input"
                  value={name}
                  maxlength={16}
                  placeholder="起个响亮的桌名，如：周末血战局"
                  onInput={(event) => { setName(event.detail.value); setError('') }}
                />
                <View className="tc-quick-chips">
                  {QUICK_TABLE_NAMES.map((preset) => (
                    <View
                      key={preset}
                      className={`tc-chip ${name.trim() === preset ? 'active' : ''}`}
                      onClick={() => { setName(preset); setError('') }}
                    >
                      <Text className="tc-chip-text">{preset}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className="tc-card">
                <View className="tc-card-head">
                  <Text className="tc-card-title">四人座位</Text>
                  <Text className="tc-card-hint">设置性别并标出自己</Text>
                </View>
                <View className="tc-seats-list">
                  {seats.map((seat, index) => {
                    const isMine = mine === index
                    const seatGender = genders[index]
                    return (
                      <View key={index} className={`tc-seat-row ${isMine ? 'is-mine' : ''}`}>
                        <View className={`tc-seat-wind ${isMine ? 'is-mine' : ''}`}>
                          <Text className="tc-seat-wind-text">{SEAT_WIND_LABELS[index]}</Text>
                        </View>
                        <Input
                          className="tc-seat-input"
                          value={seat}
                          maxlength={12}
                          placeholder={`第 ${index + 1} 位称呼`}
                          onInput={(event) => { updateSeat(index, event.detail.value); setError('') }}
                        />
                        <View className="tc-gender-pill" role="radiogroup">
                          <Text
                            className={`tc-gender-opt ${seatGender === 'male' ? 'active male' : ''}`}
                            onClick={() => updateGender(index, 'male')}
                          >
                            男
                          </Text>
                          <Text
                            className={`tc-gender-opt ${seatGender === 'female' ? 'active female' : ''}`}
                            onClick={() => updateGender(index, 'female')}
                          >
                            女
                          </Text>
                        </View>
                        <View
                          className={`tc-seat-pick ${isMine ? 'active' : ''}`}
                          onClick={() => setMine(index)}
                        >
                          {isMine && <Star size={11} color="#6b4d12" />}
                          <Text className="tc-seat-pick-text">{isMine ? '我' : '设为我'}</Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
                <Text className="tc-card-footnote">座位性别用于牌桌围坐人物展示；牌友在「我的」设置个人性别后将自动优先显示。</Text>
              </View>

              <View className="tc-submit-wrap">
                <Button className="tc-primary-btn" color="primary" block shape="round" loading={busy} onClick={create}>
                  创建牌桌并生成邀请码
                </Button>
              </View>
            </>
          )}
        </>
      ) : (
        <>
          <View className="tc-card">
            <View className="tc-card-head">
              <Text className="tc-card-title">输入 6 位邀请码</Text>
              <Text className="tc-card-hint">自动转大写</Text>
            </View>
            <Input
              className="tc-code-input"
              value={code}
              maxlength={6}
              placeholder="例如 A8K3Q9"
              onInput={(event) => { setCode(event.detail.value.toUpperCase().trim()); setError('') }}
            />
            <Button className="tc-primary-btn" color="primary" block shape="round" loading={busy} onClick={lookup}>
              查找这张桌子
            </Button>
          </View>

          {preview && (
            <View className="tc-preview-card">
              <View className="tc-preview-head">
                <View>
                  <Text className="tc-preview-name">{preview.name}</Text>
                  <Text className="tc-preview-sub">邀请码 {preview.inviteCode} · 已入座 {claimedCount}/{preview.players.length}</Text>
                </View>
                <View className="tc-preview-pill">
                  <Text className="tc-preview-pill-text">选座入桌</Text>
                </View>
              </View>
              <Text className="tc-preview-tip">点击下方空闲座位即可认领并查看战绩</Text>
              <View className="tc-preview-grid">
                {preview.players.map((player, index) => (
                  <View
                    key={player.name}
                    className={`tc-preview-seat ${player.claimed ? 'is-claimed' : 'is-open'}`}
                    onClick={() => { if (!player.claimed && !busy) void join(player.name) }}
                  >
                    <View className="tc-preview-seat-top">
                      <Text className="tc-preview-wind">{SEAT_WIND_LABELS[index] || `${index + 1}`}</Text>
                      {player.claimed ? (
                        <View className="tc-claimed-tag">
                          <Checked size={12} color="#8b9488" />
                          <Text className="tc-claimed-tag-text">已入座</Text>
                        </View>
                      ) : (
                        <View className="tc-open-tag">
                          <Text className="tc-open-tag-text">空位</Text>
                        </View>
                      )}
                    </View>
                    <View className="tc-preview-player-row">
                      <Text className="tc-preview-player">{player.name}</Text>
                      <Text className={`tc-preview-gender ${player.gender === 'female' ? 'female' : 'male'}`}>
                        {player.gender === 'female' ? '女' : '男'}
                      </Text>
                    </View>
                    <View className="tc-preview-action">
                      <Text className={`tc-preview-action-text ${player.claimed ? 'muted' : ''}`}>
                        {player.claimed ? '已被认领' : '我坐这里'}
                      </Text>
                      {!player.claimed && <Arrow size={12} color="#1a5c2e" />}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </View>
  )
}
