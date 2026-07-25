import { useState } from 'react'
import { View, Text, Image, Button, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'

import type { DiscardPuzzle } from '../../content/types'
import { getCachedPuzzles, loadPuzzles } from '../../core/puzzle-service'
import { ensureLogin, uploadAvatar, updateUserProfile, getCachedUser, isLoggedIn, type UserInfo } from '../../core/auth'

import './index.scss'

export default function ProfilePage() {
  const [puzzles, setPuzzles] = useState<DiscardPuzzle[]>(getCachedPuzzles())
  const [userInfo, setUserInfo] = useState<UserInfo | null>(getCachedUser())
  const [loggedIn, setLoggedIn] = useState(isLoggedIn())
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [editingNickname, setEditingNickname] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    reasonable: 0,
    days: 0,
    xp: 0,
    level: 1,
    mistakes: [] as { puzzle: DiscardPuzzle; time: number }[],
  })

  useDidShow(() => {
    // 刷新登录状态
    setLoggedIn(isLoggedIn())
    setUserInfo(getCachedUser())
    loadPuzzles().then(setPuzzles)
    try {
      const records = Taro.getStorageSync('train_records') || []
      const days = new Set(records.map((r: any) => new Date(r.time).toISOString().slice(0, 10))).size
      const reasonable = records.filter((r: any) => r.reasonable).length
      const xp = records.reduce((s: number, r: any) => s + (r.reasonable ? 10 : 3), 0)

      const wrongRecords = records.filter((r: any) => !r.hit && !r.skipped)
      const seen = new Set<string>()
      const mistakes: { puzzle: DiscardPuzzle; time: number }[] = []
      for (const r of wrongRecords) {
        if (seen.has(r.puzzleId)) continue
        seen.add(r.puzzleId)
        const p = puzzles.find((pp) => pp.id === r.puzzleId)
        if (p) mistakes.push({ puzzle: p, time: r.time })
      }

      setStats({ total: records.length, reasonable, days, xp, level: Math.max(1, Math.floor(xp / 100) + 1), mistakes: mistakes.slice(0, 5) })
    } catch { /* ignore */ }
  })

  // 手动登录（用户主动点击）
  const handleLogin = async () => {
    setLoginLoading(true)
    try {
      const user = await ensureLogin()
      if (user) {
        setUserInfo(user)
        setLoggedIn(true)
        Taro.showToast({ title: '登录成功', icon: 'success' })
      } else {
        Taro.showToast({ title: '登录失败，请检查网络', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
    } finally {
      setLoginLoading(false)
    }
  }

  // 选择头像：微信头像选择器回调
  const handleChooseAvatar = async (tempFilePath: string) => {
    if (!tempFilePath) return
    setAvatarUploading(true)
    Taro.showLoading({ title: '上传中…' })
    try {
      // 上传到云存储
      const fileID = await uploadAvatar(tempFilePath)
      if (!fileID) {
        Taro.showToast({ title: '头像上传失败', icon: 'none' })
        return
      }
      // 更新云数据库
      const updated = await updateUserProfile({ avatarUrl: fileID })
      if (updated) {
        setUserInfo(updated)
        Taro.showToast({ title: '头像已更新', icon: 'success' })
      }
    } catch {
      Taro.showToast({ title: '更新失败，请重试', icon: 'none' })
    } finally {
      setAvatarUploading(false)
      Taro.hideLoading()
    }
  }

  // 昵称输入完成
  const handleNicknameConfirm = async (nickname: string) => {
    const name = nickname.trim()
    if (!name) return
    Taro.showLoading({ title: '保存中…' })
    try {
      const updated = await updateUserProfile({ nickname: name })
      if (updated) {
        setUserInfo(updated)
        Taro.showToast({ title: '昵称已保存', icon: 'success' })
      }
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const goTrain = (puzzleId: string) => {
    const idx = puzzles.findIndex((p) => p.id === puzzleId)
    if (idx >= 0) Taro.navigateTo({ url: `/pages/train/index?index=${idx}` })
  }

  const levelProgress = (stats.xp % 100) / 100 * 100

  return (
    <View className="profile-page">
      {/* 个人信息头部 */}
      <View className="profile-header">
        {loggedIn ? (
          <>
            {/* 已登录：头像 + 昵称编辑 */}
            <Button
              className="avatar-btn"
              openType="chooseAvatar"
              onChooseAvatar={(e) => handleChooseAvatar(e.detail.avatarUrl)}
              loading={avatarUploading}
            >
              {userInfo?.avatarUrl ? (
                <Image
                  className="avatar-img"
                  src={userInfo.avatarUrl}
                  mode="aspectFill"
                />
              ) : (
                <View className="avatar-placeholder">
                  <Text className="avatar-icon">📷</Text>
                  <Text className="avatar-tip">选择头像</Text>
                </View>
              )}
            </Button>
            <View className="user-info">
              <View className="nickname-row">
                {editingNickname || !userInfo?.nickname ? (
                  <Input
                    className="nickname-input"
                    type="nickname"
                    value={userInfo?.nickname || ''}
                    placeholder="点击获取微信昵称"
                    maxlength={20}
                    confirmType="done"
                    focus={editingNickname}
                    onConfirm={(e) => {
                      handleNicknameConfirm(e.detail.value)
                      setEditingNickname(false)
                    }}
                    onBlur={(e) => {
                      const val = e.detail.value?.trim()
                      if (val && val !== userInfo?.nickname) handleNicknameConfirm(val)
                      setEditingNickname(false)
                    }}
                  />
                ) : (
                  <Text className="nickname-text" onClick={() => setEditingNickname(true)}>{userInfo.nickname}</Text>
                )}
              </View>
              <View className="level-row">
                <Text className="level-tag">Lv.{stats.level} 川麻入门</Text>
                <Text className="xp-text">{stats.xp % 100}/100</Text>
              </View>
              <View className="level-bar">
                <View className="level-fill" style={{ width: `${levelProgress}%` }} />
              </View>
            </View>
          </>
        ) : (
          <>
            {/* 未登录：显示登录引导 */}
            <View className="avatar-placeholder-static">
              <Text className="avatar-icon-static">🀄</Text>
            </View>
            <View className="user-info">
              <Text className="login-title">未登录</Text>
              <Text className="login-desc">登录后可云端保存训练进度，换设备也不丢失</Text>
              <View className="login-btn" onClick={handleLogin}>
                <Text className="login-btn-text">{loginLoading ? '登录中…' : '微信一键登录'}</Text>
              </View>
              <Text className="login-skip" onClick={() => Taro.showToast({ title: '可随时在“我的”页面登录', icon: 'none' })}>暂不登录</Text>
            </View>
          </>
        )}
      </View>

      {/* 数据概览 */}
      <View className="stats-card">
        <View className="stat-item">
          <Text className="stat-num">{stats.total}</Text>
          <Text className="stat-label">总练习</Text>
        </View>
        <View className="stat-item">
          <Text className="stat-num">{stats.reasonable}</Text>
          <Text className="stat-label">正确数</Text>
        </View>
        <View className="stat-item">
          <Text className="stat-num">{stats.days}</Text>
          <Text className="stat-label">训练天数</Text>
        </View>
        <View className="stat-item">
          <Text className="stat-num">{stats.xp}</Text>
          <Text className="stat-label">我的积分</Text>
        </View>
      </View>

      {/* 错题本 */}
      <View className="section-card">
        <View className="section-header">
          <Text className="section-title">错题本</Text>
          <Text className="section-extra">{stats.mistakes.length} 题</Text>
        </View>
        {stats.mistakes.length === 0 ? (
          <Text className="section-empty">暂无错题，继续加油！</Text>
        ) : (
          stats.mistakes.map((m) => (
            <View key={m.puzzle.id} className="list-item" onClick={() => goTrain(m.puzzle.id)}>
              <View className="item-info">
                <Text className="item-title">{m.puzzle.title || '拆搭训练'}</Text>
                <Text className="item-sub">基础拆搭 · {new Date(m.time).toLocaleDateString()}</Text>
              </View>
              <Text className="item-arrow">›</Text>
            </View>
          ))
        )}
      </View>

      {/* 功能菜单 */}
      <View className="section-card">
        <View className="section-header">
          <Text className="section-title">常用功能</Text>
        </View>
        <View className="list-item">
          <Text className="item-title">收藏题库</Text>
          <Text className="item-arrow">›</Text>
        </View>
        <View className="list-item">
          <Text className="item-title">个性化设置</Text>
          <Text className="item-arrow">›</Text>
        </View>
        <View className="list-item">
          <Text className="item-title">帮助与反馈</Text>
          <Text className="item-arrow">›</Text>
        </View>
        <View className="list-item">
          <Text className="item-title">关于 Mahjong Coach</Text>
          <Text className="item-arrow">›</Text>
        </View>
      </View>
    </View>
  )
}
