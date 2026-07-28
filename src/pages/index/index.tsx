import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Grid, Badge, Button } from '@taroify/core'
import {
  Checked,
  CalendarOutlined,
  Fire,
  Aim,
  Medal,
  Records,
  Star,
  ClockOutlined,
  BarChartOutlined,
  Lock,
} from '@taroify/icons'

import type { DiscardPuzzle } from '../../content/types'
import { getCachedPuzzles, loadPuzzles } from '../../core/puzzle-service'
import { isLoggedIn, syncCloudRecordsToLocal } from '../../core/auth'
import { computeTrainStats, type TrainStats } from '../../core/train-stats-service'
import { loadMistakes } from '../../core/mistake-service'
import { listFavorites } from '../../core/favorite-service'
import { listMatches } from '../../core/match-service'
import { computeMatchStats } from '../../core/match-stats-service'
import { formatDelta, type SettleUnit } from '../../core/match-types'
import { getPreferUnit } from '../../core/match-service'

import headerBanner from '../../assets/home/header-banner.jpg'
import coachBanner from '../../assets/home/coach-banner.jpg'
import tipBanner from '../../assets/home/tip-banner.jpg'

import './index.scss'

const BRAND = '#1a5c2e'
const comingSoon = () => Taro.showToast({ title: '即将上线', icon: 'none' })

const emptyStats: TrainStats = {
  todayDone: 0,
  todayGoal: 10,
  streak: 0,
  total: 0,
  donePuzzles: 0,
  accuracy: 0,
  xp: 0,
  level: 1,
  levelXp: 0,
  levelXpMax: 100,
  levelTitle: '新手',
}

export default function DashboardPage() {
  const [puzzles, setPuzzles] = useState<DiscardPuzzle[]>(getCachedPuzzles())
  const [stats, setStats] = useState<TrainStats>(emptyStats)
  const [mistakeCount, setMistakeCount] = useState(0)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [matchBrief, setMatchBrief] = useState({ total: 0, winRate: 0, cumText: '+0分' })

  useDidShow(() => {
    const refresh = (list = getCachedPuzzles()) => {
      setPuzzles(list)
      setStats(computeTrainStats())
      setMistakeCount(loadMistakes(list).length)
      setFavoriteCount(listFavorites().length)
      const unit: SettleUnit = getPreferUnit()
      const ms = computeMatchStats(listMatches(), { range: 'month', unit })
      setMatchBrief({
        total: ms.total,
        winRate: ms.winRate,
        cumText: formatDelta(ms.cumulative, unit),
      })
    }

    refresh()
    loadPuzzles().then(refresh)

    if (isLoggedIn()) {
      syncCloudRecordsToLocal().then((added) => {
        if (added > 0) refresh()
      })
    }
  })

  const goPuzzles = () => Taro.switchTab({ url: '/pages/puzzles/index' })
  const goReport = () => Taro.switchTab({ url: '/pages/report/index' })
  const goRecords = () => Taro.switchTab({ url: '/pages/records/index' })
  const goRecordEdit = () => Taro.navigateTo({ url: '/pages/record-edit/index' })
  const puzzleTotal = Math.max(puzzles.length, 1)
  const basicProgress = Math.min(100, (stats.donePuzzles / puzzleTotal) * 100)
  const levelProgress = (stats.levelXp / stats.levelXpMax) * 100

  return (
    <View className="home-page">
      {/* 1. Header */}
      <View className="home-header">
        <Image className="header-banner" src={headerBanner} mode="aspectFill" />
        <View className="header-mask" />
        <View className="header-brand">
          <Text className="brand-name">Mahjong Coach</Text>
          <Text className="brand-sub">川麻训练 · 提升你的胜率</Text>
        </View>
        <View className="header-level">
          <View className="level-pill">
            <Text className="level-pill-text">
              Lv.{stats.level} {stats.levelTitle}
            </Text>
          </View>
          <View className="xp-row">
            <Text className="xp-label">
              训练经验 {stats.levelXp}/{stats.levelXpMax}
            </Text>
            <View className="xp-bar">
              <View className="xp-fill" style={{ width: `${levelProgress}%` }} />
            </View>
          </View>
        </View>
      </View>

      {/* 2. 今日训练 */}
      <View className="section-card today-card">
        <View className="section-head">
          <View className="section-head-left">
            <Checked size={18} color={BRAND} />
            <Text className="section-title">今日训练</Text>
          </View>
          <Text className="section-link" onClick={goReport}>
            查看详情 ›
          </Text>
        </View>
        <Grid className="today-grid" columns={4} bordered={false} centered>
          <Grid.Item
            icon={
              <View className="stat-icon stat-icon-green">
                <CalendarOutlined size={20} color={BRAND} />
              </View>
            }
            text={
              <View className="stat-text">
                <Text className="stat-num">
                  {stats.todayDone}/{stats.todayGoal}
                </Text>
                <Text className="stat-label">今日题数</Text>
              </View>
            }
          />
          <Grid.Item
            icon={
              <View className="stat-icon stat-icon-orange">
                <Fire size={20} color="#e67e22" />
              </View>
            }
            text={
              <View className="stat-text">
                <Text className="stat-num">{stats.streak}天</Text>
                <Text className="stat-label">连续训练</Text>
              </View>
            }
          />
          <Grid.Item
            icon={
              <View className="stat-icon stat-icon-green">
                <Aim size={20} color={BRAND} />
              </View>
            }
            text={
              <View className="stat-text">
                <Text className="stat-num">{stats.total}题</Text>
                <Text className="stat-label">累计训练</Text>
              </View>
            }
          />
          <Grid.Item
            icon={
              <View className="stat-icon stat-icon-gold">
                <Medal size={20} color="#c9a227" />
              </View>
            }
            text={
              <View className="stat-text">
                <Text className="stat-num">{stats.accuracy}%</Text>
                <Text className="stat-label">正确率</Text>
              </View>
            }
          />
        </Grid>
      </View>

      {/* 牌局战绩入口 */}
      <View className="match-banner">
        <View className="match-banner-copy">
          <Text className="match-banner-title">我的牌局战绩</Text>
          <Text className="match-banner-desc">
            {matchBrief.total > 0
              ? `本月 ${matchBrief.total} 场 · 胜率 ${matchBrief.winRate}% · ${matchBrief.cumText}`
              : '记下每一桌，看清你的胜率与趋势'}
          </Text>
          <View className="match-banner-actions">
            <Button
              className="match-banner-cta"
              size="mini"
              shape="round"
              color="primary"
              onClick={goRecords}
            >
              查看战绩 ›
            </Button>
            <Button
              className="match-banner-cta match-banner-cta-ghost"
              size="mini"
              shape="round"
              onClick={goRecordEdit}
            >
              记一笔
            </Button>
          </View>
        </View>
      </View>

      {/* 3. 专属教练 */}
      <View className="coach-banner">
        <Image className="coach-bg" src={coachBanner} mode="aspectFill" />
        <View className="coach-copy">
          <Text className="coach-title">你的专属川麻教练</Text>
          <Text className="coach-desc">拆搭指导 · 牌型分析 · 实战提升</Text>
          <Button
            className="coach-cta"
            size="mini"
            shape="round"
            color="primary"
            onClick={comingSoon}
          >
            去咨询教练 ›
          </Button>
        </View>
      </View>

      {/* 4. 训练中心 */}
      <View className="train-center">
        <View className="section-head section-head-pad">
          <Text className="section-title section-title-alone">训练中心</Text>
          <Text className="section-link">全部训练 ›</Text>
        </View>
        <View className="mode-row">
          <View className="mode-card mode-card-basic" onClick={goPuzzles}>
            <View className="mode-top">
              <Text className="mode-title">基础拆搭</Text>
              <Text className="mode-sub">打好基础，稳扎稳打</Text>
            </View>
            <View className="mode-progress">
              <Text className="mode-progress-text">
                {stats.donePuzzles}/{puzzles.length || 0}
              </Text>
              <View className="mode-bar">
                <View className="mode-fill" style={{ width: `${basicProgress}%` }} />
              </View>
            </View>
          </View>

          <View className="mode-card mode-card-adv">
            <View className="mode-top">
              <Text className="mode-title">进阶拆搭</Text>
              <Text className="mode-sub">提升技巧，灵活应变</Text>
            </View>
            <View className="mode-lock">
              <Lock size={18} color="#9a8f7a" />
              <Text className="mode-lock-text">敬请期待</Text>
            </View>
          </View>

          <View className="mode-card mode-card-guess">
            <View className="mode-top">
              <Text className="mode-title">猜测对手</Text>
              <Text className="mode-sub">读懂牌局，先发制人</Text>
            </View>
            <View className="mode-lock">
              <Lock size={18} color="#7a8fa0" />
              <Text className="mode-lock-text">敬请期待</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 5. 学习工具 */}
      <View className="section-card tools-card">
        <Text className="section-title section-title-alone tools-title">学习工具</Text>
        <Grid className="tools-grid" columns={4} bordered={false} centered clickable>
          <Grid.Item onClick={() => Taro.navigateTo({ url: '/pages/mistakes/index' })}>
            <Badge content={mistakeCount > 0 ? mistakeCount : undefined} max={99}>
              <View className="tool-icon">
                <Records size={26} color={BRAND} />
              </View>
            </Badge>
            <Text className="tool-name">错题本</Text>
          </Grid.Item>
          <Grid.Item onClick={() => Taro.navigateTo({ url: '/pages/favorites/index' })}>
            <Badge content={favoriteCount > 0 ? favoriteCount : undefined} max={99}>
              <View className="tool-icon">
                <Star size={26} color={BRAND} />
              </View>
            </Badge>
            <Text className="tool-name">收藏夹</Text>
          </Grid.Item>
          <Grid.Item onClick={goRecords}>
            <View className="tool-icon">
              <ClockOutlined size={26} color={BRAND} />
            </View>
            <Text className="tool-name">我的牌局</Text>
          </Grid.Item>
          <Grid.Item onClick={goReport}>
            <View className="tool-icon">
              <BarChartOutlined size={26} color={BRAND} />
            </View>
            <Text className="tool-name">数据统计</Text>
          </Grid.Item>
        </Grid>
      </View>

      {/* 6. 底部提示 */}
      <View className="tip-banner">
        <Image className="tip-img" src={tipBanner} mode="widthFix" />
      </View>
    </View>
  )
}
