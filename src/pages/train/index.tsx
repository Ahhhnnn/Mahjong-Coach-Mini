import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'

import { sortTiles, tileLabel, type Tile } from '../../core/tiles'
import { ukeire } from '../../core/shanten'
import { getTileImage } from '../../core/tile-images'
import { makeRecordId, syncRecordToCloud, type TrainRecord } from '../../core/cloud'
import { scoreDiscard, type ScoreResult } from '../../core/scoring'
import type { DiscardPuzzle } from '../../content/types'
import puzzlesData from '../../content/puzzles.json'
import { CoachPanel } from '../../components/coach-panel'

import './index.scss'

const puzzles = puzzlesData as DiscardPuzzle[]

type Phase = 'select' | 'result'

export default function TrainPage() {
  const router = useRouter()
  const initIndex = Number(router.params.index || 0)
  const [currentIndex, setCurrentIndex] = useState(initIndex)
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null)
  const [phase, setPhase] = useState<Phase>('select')
  const [tipsLeft, setTipsLeft] = useState(5)
  const [showTip, setShowTip] = useState(false)
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [showCoach, setShowCoach] = useState(false)

  const puzzle = puzzles[currentIndex]
  const sortedHand = sortTiles(puzzle.hand)
  const fixedMelds = puzzle.melds?.length ?? 0

  const liveStats = (() => {
    const u = ukeire(puzzle.hand, undefined, fixedMelds)
    return { shanten: u.shanten, ukeireTotal: u.total }
  })()

  const handleSelectTile = (tile: Tile) => {
    if (phase !== 'select') return
    setSelectedTile(tile === selectedTile ? null : tile)
  }

  const handleSubmit = () => {
    if (!selectedTile) {
      Taro.showToast({ title: '请先选择一张牌', icon: 'none' })
      return
    }

    const sr = scoreDiscard(puzzle, selectedTile, fixedMelds)
    const hit = puzzle.recommendedDiscards.includes(selectedTile)

    setResult(sr)
    setPhase('result')

    // 保存记录（本地优先 + 后台同步云端）
    const record: TrainRecord = {
      id: makeRecordId(puzzle.id),
      puzzleId: puzzle.id,
      tile: selectedTile,
      hit,
      reasonable: sr.tier !== 'poor',
      time: Date.now(),
    }
    try {
      const records = Taro.getStorageSync('train_records') || []
      records.unshift(record)
      Taro.setStorageSync('train_records', records.slice(0, 200))
    } catch { /* ignore */ }
    // 后台同步到云端（不阻塞 UI，离线/未配置时静默失败）
    syncRecordToCloud(record)
  }

  const handleSkip = () => {
    nextPuzzle()
  }

  const handleTip = () => {
    if (tipsLeft <= 0) {
      Taro.showToast({ title: '提示次数已用完', icon: 'none' })
      return
    }
    setTipsLeft(tipsLeft - 1)
    setShowTip(true)
  }

  const nextPuzzle = () => {
    if (currentIndex < puzzles.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setPhase('select')
      setSelectedTile(null)
      setResult(null)
      setShowTip(false)
    } else {
      Taro.showToast({ title: '全部完成！🎉', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1500)
    }
  }

  const retry = () => {
    setPhase('select')
    setSelectedTile(null)
    setResult(null)
    setShowTip(false)
  }

  return (
    <View className="train-page">
      {/* 顶部进度 */}
      <View className="top-bar">
        <Text className="progress-text">第{currentIndex + 1}题 / 共{puzzles.length}题</Text>
        <View className="progress-bar">
          <View className="progress-fill" style={{ width: `${((currentIndex + 1) / puzzles.length) * 100}%` }} />
        </View>
      </View>

      {/* 题目信息卡 */}
      <View className="info-card">
        <View className="info-row">
          <Text className="info-label">题目</Text>
          <Text className="info-value">{puzzle.title}</Text>
        </View>
        <View className="info-row">
          <Text className="info-label">向听数</Text>
          <Text className="info-value">{liveStats.shanten === -1 ? '已听牌' : `${liveStats.shanten}向听`}</Text>
        </View>
        <View className="info-row">
          <Text className="info-label">进张数</Text>
          <Text className="info-value">{liveStats.ukeireTotal} 张</Text>
        </View>
      </View>

      {/* 手牌区域 */}
      <View className="hand-card">
        <Text className="hand-title">你的手牌（{puzzle.hand.length}张）</Text>
        <View className="tiles-row">
          {sortedHand.map((tile, i) => {
            const isSelected = selectedTile === tile
            const isRecommended = phase === 'result' && puzzle.recommendedDiscards.includes(tile)
            const isDiscussable = phase === 'result' && (puzzle.discussableDiscards ?? []).includes(tile)
            return (
              <View
                key={`${tile}-${i}`}
                className={`tile ${isSelected ? 'selected' : ''} ${isRecommended ? 'correct' : ''} ${isDiscussable ? 'acceptable' : ''}`}
                onClick={() => handleSelectTile(tile)}
              >
                <Image className="tile-img" src={getTileImage(tile)} mode="aspectFit" />
              </View>
            )
          })}
        </View>
        <Text className="hand-hint">
          {phase === 'select'
            ? selectedTile ? `已选：${tileLabel(selectedTile)}（可切换）` : '点击选择要打出的牌'
            : `你打出了：${tileLabel(selectedTile!)}`}
        </Text>
      </View>

      {/* 提示区域 */}
      {showTip && puzzle.analysis.tip && phase === 'select' && (
        <View className="tip-card">
          <Text className="tip-text">💡 {puzzle.analysis.tip}</Text>
        </View>
      )}

      {/* 问教练浮动按钮 */}
      <View className="coach-fab" onClick={() => setShowCoach(true)}>
        <Text className="coach-fab-icon">💬</Text>
        <Text className="coach-fab-text">问教练</Text>
      </View>

      {/* 选择阶段：底部操作 */}
      {phase === 'select' && (
        <View className="bottom-actions">
          <View className="action-btns">
            <View className="btn-hint" onClick={handleTip}>
              <Text className="btn-hint-text">提示（{tipsLeft}）</Text>
            </View>
            <View className="btn-skip" onClick={handleSkip}>
              <Text className="btn-skip-text">跳过本题</Text>
            </View>
          </View>
          <View className={`btn-submit ${selectedTile ? 'active' : ''}`} onClick={handleSubmit}>
            <Text className="btn-submit-text">提交答案</Text>
          </View>
        </View>
      )}

      {/* 结果阶段：页内解析 */}
      {phase === 'result' && result && (
        <View className="result-section">
          {/* 判定结果 */}
          <View className={`judge-row ${result.tier}`}>
            <Text className="judge-badge">
              {result.tier === 'excellent' ? '✓ 最优解' : result.tier === 'good' ? '△ 可讨论' : '✗ 非最优'}
            </Text>
            <Text className="judge-desc">
              {result.tier === 'excellent'
                ? '牌效判断准确，这就是最佳选择！'
                : result.tier === 'good'
                ? '思路合理，不过还有更高效的打法。'
                : '这手牌有更优的选择，看看下面的推荐弃牌。'}
            </Text>
          </View>

          {/* 牌效对比 */}
          <View className="efficiency-card">
            <View className="eff-row">
              <Text className="eff-label">你的选择</Text>
              <Text className="eff-value">
                {result.myShanten === -1 ? '已听牌' : `${result.myShanten}向听`} · 进张 {result.myUkeire} 张
              </Text>
            </View>
            {result.tier !== 'excellent' && (
              <View className="eff-row best">
                <Text className="eff-label">最优牌效</Text>
                <Text className="eff-value">
                  {result.bestShanten === -1 ? '已听牌' : `${result.bestShanten}向听`} · 进张 {result.bestUkeire} 张
                </Text>
              </View>
            )}
          </View>

          {/* 推荐答案 */}
          <View className="recommend-row">
            <Text className="recommend-label">推荐弃牌</Text>
            {puzzle.recommendedDiscards.map((t) => (
              <Image key={t} className="recommend-tile" src={getTileImage(t)} mode="aspectFit" />
            ))}
          </View>

          {/* AI 解析 */}
          <View className="analysis-card">
            <Text className="analysis-title">AI 详细解析</Text>
            <View className="point-item">
              <Text className="point-check">✓</Text>
              <Text className="point-text">{puzzle.analysis.summary}</Text>
            </View>
            {puzzle.analysis.lines.map((line, i) => (
              <View key={i} className="point-item">
                <Text className="point-check">✓</Text>
                <Text className="point-text">{line}</Text>
              </View>
            ))}
          </View>

          {/* 操作按钮 */}
          <View className="result-actions">
            <View className="btn-retry" onClick={retry}>
              <Text className="btn-retry-text">重新作答</Text>
            </View>
            <View className="btn-coach-ask" onClick={() => setShowCoach(true)}>
              <Text className="btn-coach-ask-text">追问教练</Text>
            </View>
            <View className="btn-next" onClick={nextPuzzle}>
              <Text className="btn-next-text">{currentIndex < puzzles.length - 1 ? '继续下一题' : '完成'}</Text>
            </View>
          </View>
        </View>
      )}

      {/* AI 教练聊天面板 */}
      <CoachPanel
        open={showCoach}
        onClose={() => setShowCoach(false)}
        puzzleId={puzzle.id}
        selectedTile={selectedTile}
        submitted={phase === 'result'}
        attempt={phase === 'result' && result ? {
          discard: selectedTile || undefined,
          reasonable: result.tier !== 'poor',
          hitRecommended: result.tier === 'excellent',
        } : null}
        puzzle={puzzle}
      />
    </View>
  )
}
