import { useState } from 'react'
import { View, Text, Image, Button as WxButton, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Grid, Cell, Button } from '@taroify/core'
import {
  TodoListOutlined,
  Checked,
  CalendarOutlined,
  Aim,
  Records,
  Star,
  ClockOutlined,
  BarChartOutlined,
  SettingOutlined,
  QuestionOutlined,
  InfoOutlined,
} from '@taroify/icons'

import { getCachedPuzzles, loadPuzzles } from '../../core/puzzle-service'
import { ensureLogin, uploadAvatar, updateUserProfile, getCachedUser, isLoggedIn, type UserInfo } from '../../core/auth'
import { loadMistakes } from '../../core/mistake-service'
import { listFavorites } from '../../core/favorite-service'
import mascotImg from '../../assets/mascot/panda.png'

import './index.scss'

const BRAND = '#1a5c2e'
const comingSoon = () => Taro.showToast({ title: '即将上线', icon: 'none' })

export default function ProfilePage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(getCachedUser())
  const [loggedIn, setLoggedIn] = useState(isLoggedIn())
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [editingNickname, setEditingNickname] = useState(false)
  const [stats, setStats] = useState({
    practiced: 0,
    reasonable: 0,
    days: 0,
    total: 0,
    xp: 0,
    level: 1,
    mistakeCount: 0,
    favoriteCount: 0,
  })

  useDidShow(() => {
    setLoggedIn(isLoggedIn())
    setUserInfo(getCachedUser())

    const refreshStats = (puzzles = getCachedPuzzles()) => {
      try {
        const records = Taro.getStorageSync('train_records') || []
        const days = new Set(records.map((r: any) => new Date(r.time).toISOString().slice(0, 10))).size
        const reasonable = records.filter((r: any) => r.reasonable).length
        const practiced = new Set(records.map((r: any) => r.puzzleId).filter(Boolean)).size
        const xp = records.reduce((s: number, r: any) => s + (r.reasonable ? 10 : 3), 0)
        setStats({
          practiced,
          reasonable,
          days,
          total: records.length,
          xp,
          level: Math.max(1, Math.floor(xp / 100) + 1),
          mistakeCount: loadMistakes(puzzles).length,
          favoriteCount: listFavorites().length,
        })
      } catch { /* ignore */ }
    }

    refreshStats()
    loadPuzzles().then((puzzles) => refreshStats(puzzles))
  })

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

  const handleChooseAvatar = async (tempFilePath: string) => {
    if (!tempFilePath) return
    setAvatarUploading(true)
    Taro.showLoading({ title: '上传中…' })
    try {
      const fileID = await uploadAvatar(tempFilePath)
      if (!fileID) {
        Taro.showToast({ title: '头像上传失败', icon: 'none' })
        return
      }
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

  const levelProgress = (stats.xp % 100) / 100 * 100
  const displayName = loggedIn ? (userInfo?.nickname || '麻将学员') : '未登录'

  return (
    <View className="profile-page">
      <View className="profile-header">
        <View className="header-deco" />
        <View className="header-settings" onClick={comingSoon}>
          <SettingOutlined size={22} color="#ffffff" />
        </View>

        <View className="header-user">
          {loggedIn ? (
            <WxButton
              className="avatar-btn"
              openType="chooseAvatar"
              onChooseAvatar={(e) => handleChooseAvatar(e.detail.avatarUrl)}
              loading={avatarUploading}
            >
              <Image
                className="avatar-img"
                src={userInfo?.avatarUrl || mascotImg}
                mode="aspectFill"
              />
            </WxButton>
          ) : (
            <View className="avatar-static">
              <Image className="avatar-img" src={mascotImg} mode="aspectFill" />
            </View>
          )}

          <View className="user-info">
            {loggedIn ? (
              <>
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
                    <Text className="nickname-text" onClick={() => setEditingNickname(true)}>
                      {displayName}
                    </Text>
                  )}
                </View>
                <View className="level-tag">
                  <Text className="level-tag-text">Lv.{stats.level} 川麻入门</Text>
                </View>
                <View className="level-bar">
                  <View className="level-fill" style={{ width: `${levelProgress}%` }} />
                </View>
                <Text className="xp-meta">
                  训练 {stats.days} 天 · {stats.xp % 100}/100 经验
                </Text>
              </>
            ) : (
              <>
                <Text className="login-title">未登录</Text>
                <Text className="login-desc">登录后可云端保存训练进度</Text>
                <View className="login-btn" onClick={handleLogin}>
                  <Text className="login-btn-text">{loginLoading ? '登录中…' : '微信一键登录'}</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </View>

      <View className="coach-banner">
        <Image className="coach-mascot" src={mascotImg} mode="aspectFit" />
        <View className="coach-copy">
          <Text className="coach-title">你的专属川麻教练</Text>
          <Text className="coach-desc">陪你拆搭、听牌、猜牌，稳步提升牌技</Text>
        </View>
        <Button
          className="coach-cta-btn"
          size="mini"
          shape="round"
          color="primary"
          onClick={() => Taro.switchTab({ url: '/pages/puzzles/index' })}
        >
          去训练 ›
        </Button>
      </View>

      <View className="section-card">
        <Text className="section-title">学习数据</Text>
        <Grid className="data-grid" columns={4} bordered={false} centered>
          <Grid.Item
            icon={
              <View className="data-icon">
                <TodoListOutlined size={20} color={BRAND} />
              </View>
            }
            text={
              <View className="data-text">
                <Text className="data-num">{stats.practiced}</Text>
                <Text className="data-label">总练习</Text>
              </View>
            }
          />
          <Grid.Item
            icon={
              <View className="data-icon">
                <Checked size={20} color={BRAND} />
              </View>
            }
            text={
              <View className="data-text">
                <Text className="data-num">{stats.reasonable}</Text>
                <Text className="data-label">正确数</Text>
              </View>
            }
          />
          <Grid.Item
            icon={
              <View className="data-icon">
                <CalendarOutlined size={20} color={BRAND} />
              </View>
            }
            text={
              <View className="data-text">
                <Text className="data-num">{stats.days}</Text>
                <Text className="data-label">训练天数</Text>
              </View>
            }
          />
          <Grid.Item
            icon={
              <View className="data-icon">
                <Aim size={20} color={BRAND} />
              </View>
            }
            text={
              <View className="data-text">
                <Text className="data-num">{stats.total}</Text>
                <Text className="data-label">累计答题</Text>
              </View>
            }
          />
        </Grid>
      </View>

      <View className="section-card">
        <Text className="section-title">学习中心</Text>
        <Grid className="center-grid" columns={4} bordered={false} centered clickable>
          <Grid.Item onClick={() => Taro.navigateTo({ url: '/pages/mistakes/index' })}>
            <View className="center-icon center-icon-dark">
              <Records size={26} color="#fff" />
            </View>
            <Text className="center-name">错题本</Text>
            <Text className="center-sub">{stats.mistakeCount} 题</Text>
          </Grid.Item>
          <Grid.Item onClick={() => Taro.navigateTo({ url: '/pages/favorites/index' })}>
            <View className="center-icon center-icon-dark">
              <Star size={26} color="#fff" />
            </View>
            <Text className="center-name">收藏夹</Text>
            <Text className="center-sub">{stats.favoriteCount} 题</Text>
          </Grid.Item>
          <Grid.Item onClick={comingSoon}>
            <View className="center-icon center-icon-light">
              <ClockOutlined size={26} color={BRAND} />
            </View>
            <Text className="center-name">历史记录</Text>
            <Text className="center-sub">{stats.total} 题</Text>
          </Grid.Item>
          <Grid.Item onClick={() => Taro.switchTab({ url: '/pages/report/index' })}>
            <View className="center-icon center-icon-light">
              <BarChartOutlined size={26} color={BRAND} />
            </View>
            <Text className="center-name">练习统计</Text>
            <Text className="center-sub">查看</Text>
          </Grid.Item>
        </Grid>
      </View>

      <View className="section-card section-card-last">
        <Text className="section-title">更多服务</Text>
        <Cell.Group className="service-group">
          <Cell
            icon={<Image className="service-mascot" src={mascotImg} mode="aspectFill" />}
            title="我的教练"
            isLink
            onClick={comingSoon}
          >
            川麻教练
          </Cell>
          <Cell
            icon={<QuestionOutlined size={20} color={BRAND} />}
            title="帮助与反馈"
            isLink
            onClick={comingSoon}
          />
          <Cell
            icon={<InfoOutlined size={20} color={BRAND} />}
            title="关于 Mahjong Coach"
            isLink
            onClick={comingSoon}
            bordered={false}
          />
        </Cell.Group>
      </View>
    </View>
  )
}
