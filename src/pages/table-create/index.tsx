import { useState } from 'react'
import { Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@taroify/core'
import { validateTableDraft } from '../../core/match-types'
import { claimSeat, createTable, previewTable, type TablePreview } from '../../core/table-directory-service'
import './index.scss'

export default function TableCreatePage() {
  const [name, setName] = useState('')
  const [seats, setSeats] = useState(['', '', '', ''])
  const [mine, setMine] = useState(0)
  const [code, setCode] = useState('')
  const [preview, setPreview] = useState<TablePreview | null>(null)
  const [createdCode, setCreatedCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const updateSeat = (index: number, value: string) => setSeats((current) => current.map((seat, seatIndex) => seatIndex === index ? value : seat))
  const create = async () => {
    const message = validateTableDraft(name, seats, seats[mine] || '')
    if (message) { setError(message); return }
    setBusy(true)
    setError('')
    try {
      const table = await createTable({ name: name.trim(), seats: seats.map((seat) => seat.trim()), mySeat: seats[mine].trim() })
      setCreatedCode(table.inviteCode || '')
      Taro.showToast({ title: '桌子已建好', icon: 'success' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '建桌失败，请重试')
    } finally { setBusy(false) }
  }
  const lookup = async () => {
    setBusy(true)
    setError('')
    try { setPreview(await previewTable(code)) }
    catch (reason) { setPreview(null); setError(reason instanceof Error ? reason.message : '没有找到这张桌子') }
    finally { setBusy(false) }
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
    } finally { setBusy(false) }
  }
  return (
    <View className="table-create-page">
      <View className="table-create-card">
        <Text className="table-create-title">新建一桌</Text>
        <Input className="table-create-input" value={name} maxlength={16} placeholder="桌名，例如周五局" onInput={(event) => setName(event.detail.value)} />
        {seats.map((seat, index) => <View key={index} className="table-create-seat">
          <Input className="table-create-input" value={seat} maxlength={12} placeholder={`座位 ${index + 1}`} onInput={(event) => updateSeat(index, event.detail.value)} />
          <Text className="table-create-check" onClick={() => setMine(index)}>{mine === index ? '我的座位' : '设为我'}</Text>
        </View>)}
        <Button color="primary" block shape="round" loading={busy} onClick={create}>创建并生成邀请码</Button>
        {!!createdCode && <Text className="table-create-code" onClick={() => { void Taro.setClipboardData({ data: createdCode }) }}>{createdCode}</Text>}
        {!!createdCode && <Button block shape="round" onClick={() => Taro.navigateBack()}>返回我的桌子</Button>}
      </View>
      <View className="table-create-card">
        <Text className="table-create-title">用邀请码加入</Text>
        <Input className="table-create-input" value={code} maxlength={6} placeholder="6 位邀请码" onInput={(event) => setCode(event.detail.value.toUpperCase())} />
        <Button block shape="round" loading={busy} onClick={lookup}>查看这张桌子</Button>
        {preview && <View>
          <Text className="table-create-title">{preview.name}</Text>
          {preview.players.map((player) => <View key={player.name} className="table-create-seat">
            <Text>{player.name}</Text>
            {player.claimed ? <Text>已入座</Text> : <Text className="table-create-check" onClick={() => { if (!busy) void join(player.name) }}>我坐这里</Text>}
          </View>)}
        </View>}
      </View>
      {!!error && <Text className="table-create-error">{error}</Text>}
    </View>
  )
}
