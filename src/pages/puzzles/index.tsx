import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Arrow, Lock } from '@taroify/icons'

import { getCachedPuzzles, loadPuzzles } from '../../core/puzzle-service'
import { computeTrainStats } from '../../core/train-stats-service'

import bgBasic from '../../assets/train/bg-basic.jpg'
import bgAdvanced from '../../assets/train/bg-advanced.jpg'
import bgGuess from '../../assets/train/bg-guess.jpg'

import './index.scss'

export default function TrainHubPage() {
  const [donePuzzles, setDonePuzzles] = useState(0)
  const [puzzleTotal, setPuzzleTotal] = useState(0)

  useDidShow(() => {
    const refresh = () => {
      const list = getCachedPuzzles()
      const stats = computeTrainStats()
      setPuzzleTotal(list.length)
      setDonePuzzles(stats.donePuzzles)
    }
    refresh()
    loadPuzzles().then(refresh)
  })

  const basicProgress = puzzleTotal > 0
    ? Math.min(100, (donePuzzles / puzzleTotal) * 100)
    : 0

  const goBasic = () => Taro.navigateTo({ url: '/pages/basic/index' })
  const comingSoon = () => Taro.showToast({ title: '敬请期待', icon: 'none' })

  return (
    <View className="train-hub">
      <View className="hub-header">
        <Text className="hub-title">全部训练</Text>
        <Text className="hub-desc">科学训练，循序渐进提升你的牌技水平</Text>
      </View>

      <View className="hub-list">
        <View className="hub-card" onClick={goBasic}>
          <Image className="hub-card-bg" src={bgBasic} mode="aspectFill" />
          <View className="hub-card-body">
            <View className="hub-card-left">
              <View className="hub-title-row">
                <Text className="hub-card-title">基础拆搭</Text>
                <Text className="hub-tag hub-tag-green">入门必练</Text>
              </View>
              <Text className="hub-card-sub">打好基础，稳扎稳打</Text>
              <View className="hub-progress">
                <View className="hub-bar">
                  <View className="hub-fill" style={{ width: `${basicProgress}%` }} />
                </View>
                <Text className="hub-progress-text">{donePuzzles}/{puzzleTotal || 0} 题</Text>
              </View>
            </View>
            <View className="hub-arrow hub-arrow-green">
              <Arrow size={18} color="#fff" />
            </View>
          </View>
        </View>

        <View className="hub-card" onClick={comingSoon}>
          <Image className="hub-card-bg" src={bgAdvanced} mode="aspectFill" />
          <View className="hub-card-body">
            <View className="hub-card-left">
              <View className="hub-title-row">
                <Text className="hub-card-title">进阶拆搭</Text>
                <View className="hub-tag hub-tag-orange">
                  <Lock size={12} color="#c47a2a" />
                  <Text className="hub-tag-text">进阶提升</Text>
                </View>
              </View>
              <Text className="hub-card-sub">提升技巧，灵活应变</Text>
              <View className="hub-lock-row">
                <Lock size={16} color="#b89a78" />
                <Text className="hub-lock-text">敬请期待</Text>
              </View>
            </View>
            <View className="hub-arrow hub-arrow-orange">
              <Arrow size={18} color="#fff" />
            </View>
          </View>
        </View>

        <View className="hub-card" onClick={comingSoon}>
          <Image className="hub-card-bg" src={bgGuess} mode="aspectFill" />
          <View className="hub-card-body">
            <View className="hub-card-left">
              <View className="hub-title-row">
                <Text className="hub-card-title">猜测对手</Text>
                <View className="hub-tag hub-tag-blue">
                  <Lock size={12} color="#4a7a9a" />
                  <Text className="hub-tag-text">高手进阶</Text>
                </View>
              </View>
              <Text className="hub-card-sub">读懂牌局，先发制人</Text>
              <View className="hub-lock-row">
                <Lock size={16} color="#8aa0b0" />
                <Text className="hub-lock-text">敬请期待</Text>
              </View>
            </View>
            <View className="hub-arrow hub-arrow-blue">
              <Arrow size={18} color="#fff" />
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
