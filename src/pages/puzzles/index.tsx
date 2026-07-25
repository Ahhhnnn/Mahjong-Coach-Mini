import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'

import type { DiscardPuzzle } from '../../content/types'
import { getCachedPuzzles, loadPuzzles } from '../../core/puzzle-service'
import { CHAPTERS, FREE_CHAPTERS } from '../../content/chapters'

import './index.scss'

type TrainRecordItem = { puzzleId: string; hit: boolean; reasonable: boolean; time: number }

export default function PuzzlesPage() {
  const [puzzles, setPuzzles] = useState<DiscardPuzzle[]>(getCachedPuzzles())
  const [expandedChapter, setExpandedChapter] = useState<string | null>('ch1')
  const [doneSet, setDoneSet] = useState<Set<string>>(new Set())
  const [bestScores, setBestScores] = useState<Record<string, number>>({})

  useDidShow(() => {
    loadPuzzles().then(setPuzzles)
    try {
      const records: TrainRecordItem[] = Taro.getStorageSync('train_records') || []
      const done = new Set(records.map((r) => r.puzzleId))
      setDoneSet(done)

      // 每题最高表现: hit=2, reasonable=1
      const scores: Record<string, number> = {}
      for (const r of records) {
        const s = r.hit ? 2 : r.reasonable ? 1 : 0
        if (!scores[r.puzzleId] || s > scores[r.puzzleId]) {
          scores[r.puzzleId] = s
        }
      }
      setBestScores(scores)
    } catch { /* ignore */ }
  })

  const chapterDone = (chapterPuzzles: string[]) =>
    chapterPuzzles.filter((id) => doneSet.has(id)).length

  const isChapterUnlocked = (index: number) => {
    if (index < FREE_CHAPTERS) return true
    const prev = CHAPTERS[index - 1]
    return chapterDone(prev.puzzles) >= prev.puzzles.length
  }

  const toggleChapter = (chapterId: string, index: number) => {
    if (!isChapterUnlocked(index)) {
      Taro.showToast({ title: '完成上一章后解锁', icon: 'none' })
      return
    }
    setExpandedChapter(expandedChapter === chapterId ? null : chapterId)
  }

  const goTrain = (puzzleId: string) => {
    const idx = puzzles.findIndex((p) => p.id === puzzleId)
    if (idx >= 0) Taro.navigateTo({ url: `/pages/train/index?index=${idx}` })
  }

  const getPuzzleStatus = (puzzleId: string) => {
    if (!doneSet.has(puzzleId)) return { text: '未练习', cls: 'none' }
    const s = bestScores[puzzleId]
    if (s === 2) return { text: '优秀', cls: 'excellent' }
    if (s === 1) return { text: '良好', cls: 'good' }
    return { text: '需加强', cls: 'poor' }
  }

  const totalDone = puzzles.filter((p) => doneSet.has(p.id)).length

  return (
    <View className="puzzles-page">
      {/* 头部统计 */}
      <View className="page-header">
        <View className="header-top">
          <Text className="header-title">AI 拆搭训练</Text>
          <Text className="header-count">{totalDone}/{puzzles.length} 题</Text>
        </View>
        <Text className="header-desc">专注拆搭练习，AI 实时解析你的每一步决策</Text>
      </View>

      {/* 章节列表 */}
      <View className="chapter-list">
        {CHAPTERS.map((chapter, ci) => {
          const unlocked = isChapterUnlocked(ci)
          const expanded = expandedChapter === chapter.id
          const done = chapterDone(chapter.puzzles)
          const progress = (done / chapter.puzzles.length) * 100
          const chapterPuzzles = chapter.puzzles
            .map((id) => puzzles.find((p) => p.id === id))
            .filter(Boolean) as DiscardPuzzle[]

          return (
            <View key={chapter.id} className={`chapter-card ${!unlocked ? 'locked' : ''}`}>
              {/* 章节头部 */}
              <View className="chapter-header" onClick={() => toggleChapter(chapter.id, ci)}>
                <View className="chapter-index">
                  <Text className="chapter-index-text">{ci + 1}</Text>
                </View>
                <View className="chapter-info">
                  <View className="chapter-title-row">
                    <Text className="chapter-title">{chapter.title}</Text>
                    {!unlocked && <Text className="lock-icon">🔒</Text>}
                  </View>
                  <Text className="chapter-desc">{chapter.desc}</Text>
                  <View className="chapter-progress">
                    <View className="chapter-bar">
                      <View className="chapter-bar-fill" style={{ width: `${progress}%` }} />
                    </View>
                    <Text className="chapter-progress-text">{done}/{chapter.puzzles.length}</Text>
                  </View>
                </View>
                <Text className={`chapter-arrow ${expanded ? 'expanded' : ''}`}>›</Text>
              </View>

              {/* 展开的题目列表 */}
              {expanded && unlocked && (
                <View className="puzzle-items">
                  {chapterPuzzles.map((p, pi) => {
                    const status = getPuzzleStatus(p.id)
                    return (
                      <View key={p.id} className="puzzle-item" onClick={() => goTrain(p.id)}>
                        <View className="puzzle-left">
                          <Text className="puzzle-name">
                            {pi + 1}. {p.title || '拆搭训练'}
                          </Text>
                          <Text className="puzzle-difficulty">{'★'.repeat(p.difficulty)}</Text>
                        </View>
                        <Text className={`puzzle-status ${status.cls}`}>{status.text}</Text>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}
