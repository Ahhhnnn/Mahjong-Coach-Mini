import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'

import { PuzzleListItem } from '../../components/puzzle-list-item'
import type { DiscardPuzzle } from '../../content/types'
import {
  findChapterForPuzzle,
  getDifficultyLabel,
} from '../../core/mistake-service'
import { listFavorites, removeFavorite, type FavoriteItem } from '../../core/favorite-service'
import { getCachedPuzzles, loadPuzzles } from '../../core/puzzle-service'

import heroImg from '../../assets/favorites/hero.jpg'
import './index.scss'

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function FavoritesPage() {
  const [puzzles, setPuzzles] = useState<DiscardPuzzle[]>(getCachedPuzzles())
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])

  const refresh = (puzzleList?: DiscardPuzzle[]) => {
    if (puzzleList) setPuzzles(puzzleList)
    setFavorites(listFavorites())
  }

  useDidShow(() => {
    loadPuzzles().then((list) => refresh(list))
    refresh()
  })

  const rows = favorites
    .map((fav) => {
      const puzzle = puzzles.find((p) => p.id === fav.puzzleId)
      if (!puzzle) return null
      const chapter = findChapterForPuzzle(puzzle.id)
      return { fav, puzzle, chapter }
    })
    .filter(Boolean) as {
    fav: FavoriteItem
    puzzle: DiscardPuzzle
    chapter: { id: string; title: string }
  }[]

  const handleMore = (puzzleId: string) => {
    Taro.showActionSheet({
      itemList: ['取消收藏'],
      success: (res) => {
        if (res.tapIndex === 0) {
          removeFavorite(puzzleId)
          refresh()
          Taro.showToast({ title: '已取消收藏', icon: 'none' })
        }
      },
    }).catch(() => {})
  }

  const startRandom = () => {
    if (rows.length === 0) {
      Taro.showToast({ title: '暂无收藏', icon: 'none' })
      return
    }
    const ids = shuffle(rows.map((r) => r.puzzle.id)).join(',')
    Taro.navigateTo({ url: `/pages/train/index?ids=${ids}&from=favorites` })
  }

  return (
    <View className="favorites-page">
      <View className="hero-card">
        <Image className="hero-bg" src={heroImg} mode="aspectFill" />
        <View className="hero-overlay">
          <Text className="hero-title">我的收藏</Text>
          <Text className="hero-desc">共 {rows.length} 题，持续积累你的经典好题</Text>
        </View>
      </View>

      <View className="list-card">
        {rows.length === 0 ? (
          <Text className="empty-text">暂无收藏，训练结果页可点星收藏</Text>
        ) : (
          rows.map((row, i) => (
            <PuzzleListItem
              key={row.fav.puzzleId}
              index={i}
              tone="green"
              title={row.puzzle.title || '拆搭训练'}
              subtitle={`${row.chapter.title} · ${getDifficultyLabel(row.puzzle.difficulty)}`}
              meta={`收藏于 ${formatDate(row.fav.createdAt)}`}
              trailing={
                <View
                  className="more-btn"
                  onClick={() => handleMore(row.fav.puzzleId)}
                >
                  <Text className="more-btn-text">···</Text>
                </View>
              }
              onClick={() => {
                Taro.navigateTo({
                  url: `/pages/train/index?ids=${row.fav.puzzleId}&from=favorites`,
                })
              }}
            />
          ))
        )}
      </View>

      <View className="bottom-bar">
        <View className={`btn-random ${rows.length === 0 ? 'disabled' : ''}`} onClick={startRandom}>
          <Text className="btn-random-text">随机练习</Text>
        </View>
      </View>
    </View>
  )
}
