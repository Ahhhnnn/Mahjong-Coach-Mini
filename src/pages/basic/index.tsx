import { useMemo, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button } from '@taroify/core'
import { Arrow, Checked, Lock, Medal } from '@taroify/icons'

import type { DiscardPuzzle } from '../../content/types'
import { getCachedPuzzles, loadPuzzles } from '../../core/puzzle-service'
import { CHAPTERS, FREE_CHAPTERS } from '../../content/chapters'
import { computeTrainStats, getTrainRecords } from '../../core/train-stats-service'

import bgBasic from '../../assets/train/bg-basic.jpg'
import './index.scss'

type TrainRecordItem = { puzzleId: string; hit: boolean; reasonable: boolean; time: number }

const ICON_COLORS = [
  '#1a5c2e',
  '#2d8a4e',
  '#3a9a5e',
  '#4a7a9a',
  '#c47a2a',
  '#8a6a4a',
  '#5a6a8a',
  '#6a8a5a',
]

function levelLabel(accuracy: number, totalAttempts: number): string {
  if (totalAttempts === 0) return '新手'
  if (accuracy >= 80) return '优秀'
  if (accuracy >= 60) return '良好'
  return '需加强'
}

export default function BasicTrainPage() {
  const [puzzles, setPuzzles] = useState<DiscardPuzzle[]>(getCachedPuzzles())
  const [doneSet, setDoneSet] = useState<Set<string>>(new Set())
  const [accuracy, setAccuracy] = useState(0)
  const [attemptTotal, setAttemptTotal] = useState(0)
  const [lastChapterTitle, setLastChapterTitle] = useState('从第一章开始')

  useDidShow(() => {
    loadPuzzles().then(setPuzzles)
    try {
      const records: TrainRecordItem[] = (getTrainRecords() as TrainRecordItem[]) || []
      const done = new Set(records.map((r) => r.puzzleId).filter(Boolean))
      setDoneSet(done)

      const stats = computeTrainStats(records)
      setAccuracy(stats.accuracy)
      setAttemptTotal(stats.total)

      const sorted = [...records].sort((a, b) => (b.time || 0) - (a.time || 0))
      const lastId = sorted.find((r) => r.puzzleId)?.puzzleId
      if (lastId) {
        const ch = CHAPTERS.find((c) => c.puzzles.includes(lastId))
        setLastChapterTitle(ch?.title || '从第一章开始')
      } else {
        setLastChapterTitle('从第一章开始')
      }
    } catch { /* ignore */ }
  })

  const chapterDone = (chapterPuzzles: string[]) =>
    chapterPuzzles.filter((id) => doneSet.has(id)).length

  const isChapterUnlocked = (index: number) => {
    if (index < FREE_CHAPTERS) return true
    const prev = CHAPTERS[index - 1]
    return chapterDone(prev.puzzles) >= prev.puzzles.length
  }

  const totalDone = useMemo(
    () => puzzles.filter((p) => doneSet.has(p.id)).length,
    [puzzles, doneSet],
  )

  const goChapterTrain = (chapterIndex: number) => {
    if (!isChapterUnlocked(chapterIndex)) {
      Taro.showToast({ title: '完成上一章后解锁', icon: 'none' })
      return
    }
    const chapter = CHAPTERS[chapterIndex]
    const available = chapter.puzzles.filter((id) => puzzles.some((p) => p.id === id))
    if (available.length === 0) {
      Taro.showToast({ title: '题目暂不可用', icon: 'none' })
      return
    }
    let start = available.findIndex((id) => !doneSet.has(id))
    if (start < 0) start = 0
    const ids = encodeURIComponent(available.join(','))
    Taro.navigateTo({
      url: `/pages/train/index?ids=${ids}&start=${start}&from=chapter`,
    })
  }

  const continuePractice = () => {
    const records = (getTrainRecords() as TrainRecordItem[]) || []
    const sorted = [...records].sort((a, b) => (b.time || 0) - (a.time || 0))
    const lastId = sorted.find((r) => r.puzzleId)?.puzzleId
    const lastIdx = lastId
      ? CHAPTERS.findIndex((c) => c.puzzles.includes(lastId))
      : -1

    if (
      lastIdx >= 0 &&
      isChapterUnlocked(lastIdx) &&
      chapterDone(CHAPTERS[lastIdx].puzzles) < CHAPTERS[lastIdx].puzzles.length
    ) {
      goChapterTrain(lastIdx)
      return
    }

    const next = CHAPTERS.findIndex(
      (c, i) => isChapterUnlocked(i) && chapterDone(c.puzzles) < c.puzzles.length,
    )
    goChapterTrain(next >= 0 ? next : Math.max(0, lastIdx))
  }

  const level = levelLabel(accuracy, attemptTotal)

  return (
    <View className="basic-page">
      <View className="basic-hero">
        <Image className="basic-hero-bg" src={bgBasic} mode="aspectFill" />
        <View className="basic-hero-mask" />
        <View className="basic-hero-content">
          <View className="basic-hero-title-row">
            <Text className="basic-hero-title">基础拆搭</Text>
            <Text className="hub-tag hub-tag-green">入门必练</Text>
          </View>
          <Text className="basic-hero-desc">
            聚焦基础牌型与拆搭原则，通过系统练习建立正确的牌感与决策习惯
          </Text>
        </View>
      </View>

      <View className="stats-card">
        <View className="stats-item">
          <Text className="stats-num">{puzzles.length}</Text>
          <Text className="stats-label">题目总数</Text>
        </View>
        <View className="stats-divider" />
        <View className="stats-item">
          <Text className="stats-num">{totalDone}</Text>
          <Text className="stats-label">已完成</Text>
        </View>
        <View className="stats-divider" />
        <View className="stats-item">
          <Text className="stats-num">{attemptTotal > 0 ? `${accuracy}%` : '--'}</Text>
          <Text className="stats-label">正确率</Text>
        </View>
        <View className="stats-divider" />
        <View className="stats-item">
          <View className="stats-level">
            <Medal size={18} color="#1a5c2e" />
            <Text className="stats-num stats-num-sm">{level}</Text>
          </View>
          <Text className="stats-label">当前水平</Text>
        </View>
      </View>

      <View className="section-block">
        <Text className="section-title">训练内容</Text>
        <View className="chapter-list">
          {CHAPTERS.map((chapter, ci) => {
            const unlocked = isChapterUnlocked(ci)
            const done = chapterDone(chapter.puzzles)
            const total = chapter.puzzles.length
            const complete = unlocked && done >= total && total > 0
            const inProgress = unlocked && done > 0 && done < total
            const progress = total > 0 ? (done / total) * 100 : 0

            return (
              <View
                key={chapter.id}
                className={`chapter-row ${!unlocked ? 'locked' : ''}`}
                onClick={() => goChapterTrain(ci)}
              >
                <View
                  className="chapter-icon"
                  style={{ background: unlocked ? ICON_COLORS[ci % ICON_COLORS.length] : '#c8c8c8' }}
                >
                  <Text className="chapter-icon-text">{ci + 1}</Text>
                </View>
                <View className="chapter-main">
                  <Text className="chapter-title">{chapter.title}</Text>
                  <Text className="chapter-desc">{chapter.desc}</Text>
                </View>
                <View className="chapter-right">
                  {complete && (
                    <>
                      <Text className="chapter-count done">{done}/{total}</Text>
                      <Checked size={20} color="#1a5c2e" />
                    </>
                  )}
                  {inProgress && (
                    <>
                      <Text className="chapter-count">{done}/{total}</Text>
                      <View className="mini-bar">
                        <View className="mini-fill" style={{ width: `${progress}%` }} />
                      </View>
                    </>
                  )}
                  {unlocked && done === 0 && (
                    <>
                      <Text className="chapter-count muted">0/{total}</Text>
                      <Arrow size={16} color="#ccc" />
                    </>
                  )}
                  {!unlocked && (
                    <>
                      <Text className="chapter-count muted">0/{total}</Text>
                      <Lock size={18} color="#bbb" />
                    </>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      </View>

      <View className="basic-footer">
        <Button
          className="continue-btn"
          color="primary"
          shape="round"
          block
          onClick={continuePractice}
        >
          继续练习
        </Button>
        <Text className="continue-hint">上次练习到：{lastChapterTitle}</Text>
      </View>
    </View>
  )
}
