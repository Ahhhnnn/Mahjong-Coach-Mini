import { useMemo, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'

import { PuzzleListItem } from '../../components/puzzle-list-item'
import { CHAPTERS } from '../../content/chapters'
import type { DiscardPuzzle } from '../../content/types'
import {
  buildPracticeIds,
  filterMistakes,
  getDifficultyLabel,
  getMistakeStats,
  getMistakeStatusLabel,
  loadMistakes,
  type MistakeFilters,
  type MistakeItem,
  type MistakeStatus,
} from '../../core/mistake-service'
import { getCachedPuzzles, loadPuzzles } from '../../core/puzzle-service'

import heroImg from '../../assets/mistakes/hero.jpg'
import './index.scss'

const STATUS_CLASS: Record<MistakeStatus, string> = {
  review: 'badge-review',
  reinforce: 'badge-reinforce',
  mastered: 'badge-mastered',
  repeat: 'badge-repeat',
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

export default function MistakesPage() {
  const router = useRouter()
  const initialChapter =
    typeof router.params?.chapterId === 'string' && router.params.chapterId
      ? router.params.chapterId
      : 'all'

  const [puzzles, setPuzzles] = useState<DiscardPuzzle[]>(getCachedPuzzles())
  const [items, setItems] = useState<MistakeItem[]>([])
  const [filters, setFilters] = useState<MistakeFilters>({
    chapterId: initialChapter,
    difficulty: 'all',
    timeRange: 'all',
  })
  const [filterOpen, setFilterOpen] = useState<'chapter' | 'difficulty' | 'time' | null>(null)

  useDidShow(() => {
    const chapterParam = router.params?.chapterId
    if (typeof chapterParam === 'string' && chapterParam) {
      setFilters((f) => ({ ...f, chapterId: chapterParam }))
    }

    const cached = getCachedPuzzles()
    if (cached.length) {
      setPuzzles(cached)
      setItems(loadMistakes(cached))
    }
    loadPuzzles().then((list) => {
      setPuzzles(list)
      setItems(loadMistakes(list))
    })
  })

  const filtered = useMemo(() => filterMistakes(items, filters), [items, filters])
  const stats = useMemo(() => getMistakeStats(items), [items])

  const startPractice = () => {
    if (filtered.length === 0) {
      Taro.showToast({ title: '暂无错题可练', icon: 'none' })
      return
    }
    const ids = encodeURIComponent(buildPracticeIds(filtered).join(','))
    Taro.navigateTo({ url: `/pages/train/index?ids=${ids}&start=0&from=mistakes` })
  }

  const chapterLabel =
    filters.chapterId === 'all'
      ? '题型'
      : CHAPTERS.find((c) => c.id === filters.chapterId)?.title || '题型'
  const difficultyLabel =
    filters.difficulty === 'all' ? '难度' : getDifficultyLabel(filters.difficulty as number)
  const timeLabel =
    filters.timeRange === 'all'
      ? '时间'
      : filters.timeRange === '7d'
        ? '近7天'
        : '近30天'

  return (
    <View className="mistakes-page">
      <View className="hero-card">
        <Image className="hero-bg" src={heroImg} mode="aspectFill" />
        <View className="hero-overlay">
          <View className="ring-wrap">
            <View className="ring-track">
              <View
                className="ring-fill"
                style={{
                  background: `conic-gradient(#f5c542 0deg ${stats.masteryRate * 3.6}deg, transparent ${stats.masteryRate * 3.6}deg 360deg)`,
                }}
              />
              <View className="ring-inner">
                <Text className="ring-num">{stats.masteryRate}%</Text>
                <Text className="ring-label">错题掌握率</Text>
              </View>
            </View>
          </View>
          <Text className="hero-desc">
            共 {stats.total} 题错题，已掌握 {stats.mastered} 题
          </Text>
        </View>
      </View>

      <View className="stats-row">
        <View className="stat-cell">
          <Text className="stat-num">{stats.total}</Text>
          <Text className="stat-label">错题总数</Text>
        </View>
        <View className="stat-cell">
          <Text className="stat-num">{stats.mastered}</Text>
          <Text className="stat-label">已掌握</Text>
        </View>
        <View className="stat-cell">
          <Text className="stat-num">{stats.repeat}</Text>
          <Text className="stat-label">反复出错</Text>
        </View>
        <View className="stat-cell">
          <Text className="stat-num">{stats.review}</Text>
          <Text className="stat-label">待复习</Text>
        </View>
      </View>

      <View className="filter-bar">
        <View
          className={`chip ${filters.chapterId === 'all' && filters.difficulty === 'all' && filters.timeRange === 'all' ? 'active' : ''}`}
          onClick={() => {
            setFilters({ chapterId: 'all', difficulty: 'all', timeRange: 'all' })
            setFilterOpen(null)
          }}
        >
          <Text className="chip-text">全部</Text>
        </View>
        <View
          className={`chip ${filters.chapterId !== 'all' ? 'active' : ''}`}
          onClick={() => setFilterOpen(filterOpen === 'chapter' ? null : 'chapter')}
        >
          <Text className="chip-text">{chapterLabel} ▾</Text>
        </View>
        <View
          className={`chip ${filters.difficulty !== 'all' ? 'active' : ''}`}
          onClick={() => setFilterOpen(filterOpen === 'difficulty' ? null : 'difficulty')}
        >
          <Text className="chip-text">{difficultyLabel} ▾</Text>
        </View>
        <View
          className={`chip ${filters.timeRange !== 'all' ? 'active' : ''}`}
          onClick={() => setFilterOpen(filterOpen === 'time' ? null : 'time')}
        >
          <Text className="chip-text">{timeLabel} ▾</Text>
        </View>
      </View>

      {filterOpen === 'chapter' && (
        <View className="filter-panel">
          <View
            className="filter-option"
            onClick={() => {
              setFilters((f) => ({ ...f, chapterId: 'all' }))
              setFilterOpen(null)
            }}
          >
            <Text>全部题型</Text>
          </View>
          {CHAPTERS.map((ch) => (
            <View
              key={ch.id}
              className="filter-option"
              onClick={() => {
                setFilters((f) => ({ ...f, chapterId: ch.id }))
                setFilterOpen(null)
              }}
            >
              <Text>{ch.title}</Text>
            </View>
          ))}
        </View>
      )}
      {filterOpen === 'difficulty' && (
        <View className="filter-panel">
          <View
            className="filter-option"
            onClick={() => {
              setFilters((f) => ({ ...f, difficulty: 'all' }))
              setFilterOpen(null)
            }}
          >
            <Text>全部难度</Text>
          </View>
          {[1, 2, 3, 4, 5].map((d) => (
            <View
              key={d}
              className="filter-option"
              onClick={() => {
                setFilters((f) => ({ ...f, difficulty: d }))
                setFilterOpen(null)
              }}
            >
              <Text>{getDifficultyLabel(d)}</Text>
            </View>
          ))}
        </View>
      )}
      {filterOpen === 'time' && (
        <View className="filter-panel">
          {[
            { key: 'all' as const, label: '全部时间' },
            { key: '7d' as const, label: '近 7 天' },
            { key: '30d' as const, label: '近 30 天' },
          ].map((opt) => (
            <View
              key={opt.key}
              className="filter-option"
              onClick={() => {
                setFilters((f) => ({ ...f, timeRange: opt.key }))
                setFilterOpen(null)
              }}
            >
              <Text>{opt.label}</Text>
            </View>
          ))}
        </View>
      )}

      <View className="list-card">
        {filtered.length === 0 ? (
          <Text className="empty-text">暂无错题，继续加油！</Text>
        ) : (
          filtered.map((item, i) => (
            <PuzzleListItem
              key={item.puzzleId}
              index={i}
              tone="red"
              title={item.puzzle.title || '拆搭训练'}
              subtitle={`${item.chapterTitle} · ${getDifficultyLabel(item.puzzle.difficulty)}`}
              meta={`错 ${item.errorCount} 次 · 最近错 ${formatDate(item.lastErrorAt)}`}
              badge={
                <Text className={`status-badge ${STATUS_CLASS[item.status]}`}>
                  {getMistakeStatusLabel(item.status)}
                </Text>
              }
              onClick={() => {
                const ids = encodeURIComponent(filtered.map((m) => m.puzzleId).join(','))
                Taro.navigateTo({
                  url: `/pages/train/index?ids=${ids}&start=${i}&from=mistakes`,
                })
              }}
            />
          ))
        )}
      </View>

      <View className="bottom-bar">
        <View className="btn-practice" onClick={startPractice}>
          <Text className="btn-practice-text">开始错题练习 ({filtered.length})</Text>
        </View>
      </View>
    </View>
  )
}
