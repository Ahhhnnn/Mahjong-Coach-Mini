import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button } from '@taroify/core'
import { ensureLogin } from '../../core/auth'
import { FIXED_MATCH_PLAYERS, type PlayerName } from '../../core/match-types'
import { tableIdentityAction, type TableStatus } from '../../core/table-identity-service'
import { useTableIdentity } from '../../hooks/use-table-identity'
import './index.scss'

export default function IdentityPage() {
  const { identity } = useTableIdentity()
  const [status, setStatus] = useState<TableStatus>()
  const [selected, setSelected] = useState<PlayerName>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const refresh = async () => {
    setBusy(true)
    setError('')
    try {
      if (!await ensureLogin()) throw new Error('请联网完成微信登录')
      setStatus(await tableIdentityAction('status'))
    } catch (e) { setError(e instanceof Error ? e.message : '加载失败，请重试') }
    finally { setBusy(false) }
  }
  useDidShow(() => { void refresh() })
  const claim = async () => {
    if (!selected || busy || !status) return
    const confirmation = await Taro.showModal({ title: `认领 ${selected}`, content: '认领后立即关联你的战绩、荣誉和玄学档案。身份固定绑定，请确认这是你本人。', confirmText: '确认入座' })
    if (!confirmation.confirm) return
    setBusy(true)
    try {
      setStatus(await tableIdentityAction('claim', selected))
      setSelected(undefined)
      Taro.showToast({ title: '认领成功', icon: 'success' })
    } catch (e) {
      setError(e instanceof Error ? e.message : '认领失败，请重试')
      try { setStatus(await tableIdentityAction('status')) } catch { /* 保留错误提示 */ }
    } finally { setBusy(false) }
  }
  const release = async (name: PlayerName) => {
    const confirmation = await Taro.showModal({ title: `解除 ${name} 的绑定`, content: '解除后，原账号无法继续查看或修改牌局，这个身份可以重新认领。', confirmText: '解除绑定', confirmColor: '#a74e3a' })
    if (!confirmation.confirm) return
    setBusy(true)
    try { setStatus(await tableIdentityAction('release', name)); Taro.showToast({ title: '已解除绑定', icon: 'success' }) }
    catch (e) { setError(e instanceof Error ? e.message : '解除失败，请重试') }
    finally { setBusy(false) }
  }
  return <View className="identity-page">
    <View className="identity-heading">
      <Text className="identity-kicker">四人常聚 · 一桌同记</Text>
      <View className="identity-title-row"><Text className="identity-title">{identity ? '已入席，有你的牌程' : '这一席，是哪位？'}</Text><Text className="identity-stamp">入席簿</Text></View>
      <Text className="identity-description">{identity ? `${identity.playerName}，你的战绩、荣誉和玄学命簿已关联。` : '微信登录后，认领自己的名字。无需审核，即刻入座。'}</Text>
    </View>
    <View className="identity-seats">
      {FIXED_MATCH_PLAYERS.map((name, index) => {
        const slot = status?.players.find((player) => player.name === name)
        const mine = identity?.playerName === name
        const available = !!slot && !slot.claimed && !identity
        return <View key={name} className={`identity-seat ${mine || selected === name ? 'selected' : ''} ${slot?.claimed && !mine ? 'occupied' : ''}`}
          onClick={() => { if (available && !busy) setSelected(name) }} role="button" aria-label={`${name}，${mine ? '我的身份' : slot?.claimed ? '已认领' : '待认领'}`}>
          <View className="identity-seat-top"><Text className="identity-seat-number">第 {['一', '二', '三', '四'][index]} 席</Text><Text className="identity-seat-status">{mine ? '本人' : !status ? '加载中' : slot?.claimed ? '已认领' : '待认领'}</Text></View>
          <Text className="identity-seat-name">{name}</Text>
          <Text className="identity-seat-caption">{mine ? '此席与你相连' : slot?.claimed ? '牌友已入座' : identity ? '静候牌友入席' : '点击选择，这是我'}</Text>
          {identity?.role === 'admin' && slot?.claimed && !mine && <View className="identity-release" onClick={(e) => { e.stopPropagation(); if (!busy) void release(name) }}>解除绑定</View>}
        </View>
      })}
    </View>
    {!!error && <Text className="identity-error">{error}</Text>}
    {identity ? <Button color="primary" block shape="round" onClick={() => Taro.switchTab({ url: '/pages/records/index' })}>查看我的牌局</Button>
      : <Button color="primary" block shape="round" loading={busy} disabled={!selected || busy || !status} onClick={claim}>{selected ? `我是 ${selected} · 确认入座` : '选择自己的名字'}</Button>}
    <View className="identity-foot"><Text>每个名字只属于一个微信账号。认领后固定绑定，选错时请联系 HENING 解除。</Text><Text>四人共享牌局，均可录入与维护；个人荣誉和玄学按本人积分计算。</Text></View>
    <Button variant="text" block loading={busy} onClick={refresh}>刷新入席情况</Button>
  </View>
}
