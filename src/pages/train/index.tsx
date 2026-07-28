import { useState, useEffect, useMemo } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'

import { sortTiles, tileLabel, type Tile } from '../../core/tiles'
import { ukeire } from '../../core/shanten'
import { getTileImage } from '../../core/tile-images'
import { makeRecordId, syncRecordToCloud, type TrainRecord } from '../../core/cloud'
import { scoreDiscard, type ScoreResult } from '../../core/scoring'
import { isLoggedIn } from '../../core/auth'
import { isFavorited, toggleFavorite } from '../../core/favorite-service'
import type { DiscardPuzzle } from '../../content/types'
import { CHAPTERS } from '../../content/chapters'
import { getCachedPuzzles, loadPuzzles } from '../../core/puzzle-service'
import { CoachPanel } from '../../components/coach-panel'

import './index.scss'

type Phase = 'select' | 'result'

function meldCountSuffix(count: number): string {
  if (count <= 0) return ''
  return `，含 ${count} 组副露`
}

function parseIdsParam(raw?: string): string[] {
  if (!raw) return []
  return decodeURIComponent(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseStartIndex(params: Record<string, string | undefined>, queueLen: number): number {
  // 优先 start（0-based）；兼容旧链接 index。有 ids 队列时默认从 0 开始
  const raw = params.start ?? (queueLen > 0 ? undefined : params.index)
  if (raw == null || raw === '') return 0
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  if (queueLen > 0) return Math.min(Math.floor(n), queueLen - 1)
  return Math.floor(n)
}

function resolveChapter(puzzleId: string) {
  const chapterIndex = CHAPTERS.findIndex((ch) => ch.puzzles.includes(puzzleId))
  if (chapterIndex < 0) {
    return { chapterNo: 0, title: '拆搭训练', inChapter: 0, chapterTotal: 0 }
  }
  const ch = CHAPTERS[chapterIndex]
  return {
    chapterNo: chapterIndex + 1,
    title: ch.title,
    inChapter: ch.puzzles.indexOf(puzzleId) + 1,
    chapterTotal: ch.puzzles.length,
  }
}

function sourceLabel(from: string): string {
  if (from === 'favorites') return '收藏夹'
  if (from === 'mistakes') return '错题本'
  if (from === 'chapter') return ''
  return ''
}

export default function TrainPage() {
  const router = useRouter()
  const queueIds = useMemo(() => parseIdsParam(router.params.ids), [router.params.ids])
  const fromSource = router.params.from || ''
  const initIndex = useMemo(
    () => parseStartIndex(router.params as Record<string, string | undefined>, queueIds.length),
    [router.params, queueIds.length],
  )

  const [allPuzzles, setAllPuzzles] = useState<DiscardPuzzle[]>(getCachedPuzzles())
  const [currentIndex, setCurrentIndex] = useState(initIndex)
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null)
  const [phase, setPhase] = useState<Phase>('select')
  const [tipsLeft, setTipsLeft] = useState(5)
  const [showTip, setShowTip] = useState(false)
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [showCoach, setShowCoach] = useState(false)
  const [favorited, setFavorited] = useState(false)

  useEffect(() => {
    loadPuzzles().then(setAllPuzzles)
  }, [])

  const puzzles = useMemo(() => {
    if (queueIds.length === 0) return allPuzzles
    const map = new Map(allPuzzles.map((p) => [p.id, p]))
    return queueIds.map((id) => map.get(id)).filter(Boolean) as DiscardPuzzle[]
  }, [allPuzzles, queueIds])

  // 题目异步加载后，确保下标不越界
  useEffect(() => {
    if (puzzles.length === 0) return
    setCurrentIndex((i) => Math.min(Math.max(0, i), puzzles.length - 1))
  }, [puzzles.length])

  const puzzle = puzzles[currentIndex]

  useEffect(() => {
    if (puzzle?.id) {
      setFavorited(isFavorited(puzzle.id))
    }
  }, [puzzle?.id])

  // 题目尚未加载时显示加载状态
  if (!puzzle) {
    return (
      <View className="train-page">
        <View className="top-bar">
          <View className="top-bar-deco" />
          <Text className="progress-text">加载中...</Text>
          <View className="progress-bar">
            <View className="progress-fill" style={{ width: '12%' }} />
          </View>
        </View>
        <View className="info-card"><Text className="hand-title">正在准备题目</Text></View>
      </View>
    )
  }
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

    if (isLoggedIn()) {
      syncRecordToCloud(record)
    } else {
      Taro.showToast({
        title: '进度已保存本地，登录后可云端同步',
        icon: 'none',
        duration: 2500,
      })
    }
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
      const doneMsg = fromSource ? '本轮练习完成' : '全部完成！🎉'
      Taro.showToast({ title: doneMsg, icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1500)
    }
  }

  const retry = () => {
    setPhase('select')
    setSelectedTile(null)
    setResult(null)
    setShowTip(false)
  }

  const handleToggleFavorite = () => {
    const next = toggleFavorite(puzzle.id)
    setFavorited(next)
    Taro.showToast({ title: next ? '已收藏' : '已取消收藏', icon: 'none' })
  }

  const chapter = resolveChapter(puzzle.id)
  const fromLabel = sourceLabel(fromSource)
  const progressText =
    fromSource === 'chapter' || !fromSource
      ? `第${chapter.inChapter || currentIndex + 1}题 / 共${chapter.chapterTotal || puzzles.length}题`
      : `本章第${chapter.inChapter}题 · 本轮 ${currentIndex + 1}/${puzzles.length}`

  return (
    <View className={`train-page phase-${phase}`}>
      {/* 顶部进度 */}
      <View className="top-bar">
        <View className="top-bar-deco" />
        {fromLabel ? (
          <Text className="source-tag">{fromLabel}</Text>
        ) : null}
        <Text className="chapter-text">
          {chapter.chapterNo > 0 ? `第${chapter.chapterNo}章 · ${chapter.title}` : chapter.title}
        </Text>
        <Text className="progress-text">{progressText}</Text>
        <View className="progress-bar">
          <View
            className="progress-fill"
            style={{
              width: `${((currentIndex + 1) / Math.max(puzzles.length, 1)) * 100}%`,
            }}
          />
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

      {/* 副露区域（碰/杠） */}
      {puzzle.melds && puzzle.melds.length > 0 && (
        <View className="melds-card">
          <Text className="melds-title">副露（{puzzle.melds.length}组）</Text>
          <View className="melds-row">
            {puzzle.melds.map((meld, mi) => {
              const label = meld.type === 'peng' ? '碰' : '杠'
              return (
                <View key={`meld-${mi}`} className="meld-group">
                  <Text className="meld-label">{label}</Text>
                  <View className="meld-tiles">
                    {meld.tiles.map((tile, ti) => (
                      <Image
                        key={`meld-${mi}-${ti}`}
                        className="meld-tile"
                        src={getTileImage(tile)}
                        mode="aspectFit"
                      />
                    ))}
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* 手牌区域 */}
      <View className="hand-card">
        <Text className="hand-title">
          你的手牌（{puzzle.hand.length}张{meldCountSuffix(puzzle.melds?.length ?? 0)}）
        </Text>
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
            <View className={`btn-hint ${tipsLeft <= 0 ? 'disabled' : ''}`} onClick={handleTip}>
              <Text className="btn-hint-icon">💡</Text>
              <Text className="btn-hint-text">提示 · {tipsLeft}</Text>
            </View>
            <View className="btn-skip" onClick={handleSkip}>
              <Text className="btn-skip-text">跳过</Text>
            </View>
          </View>
          <View className={`btn-submit ${selectedTile ? 'active' : ''}`} onClick={handleSubmit}>
            <Text className="btn-submit-text">
              {selectedTile ? '提交答案' : '请先选一张牌'}
            </Text>
          </View>
        </View>
      )}

      {/* 结果阶段：页内解析 */}
      {phase === 'result' && result && (
        <View className="result-section">
          <View className={`judge-row ${result.tier}`}>
            <View className="judge-main">
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
            <View className={`btn-fav ${favorited ? 'on' : ''}`} onClick={handleToggleFavorite}>
              <Text className="btn-fav-icon">{favorited ? '★' : '☆'}</Text>
              <Text className="btn-fav-text">{favorited ? '已收藏' : '收藏'}</Text>
            </View>
          </View>

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

          <View className="recommend-row">
            <Text className="recommend-label">推荐弃牌</Text>
            {puzzle.recommendedDiscards.map((t) => (
              <Image key={t} className="recommend-tile" src={getTileImage(t)} mode="aspectFit" />
            ))}
          </View>

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

          <View className="result-actions">
            <View className="result-actions-row">
              <View className="btn-retry" onClick={retry}>
                <Text className="btn-retry-text">重新作答</Text>
              </View>
              <View className="btn-coach-ask" onClick={() => setShowCoach(true)}>
                <Text className="btn-coach-ask-text">追问教练</Text>
              </View>
            </View>
            <View className="btn-next" onClick={nextPuzzle}>
              <Text className="btn-next-text">{currentIndex < puzzles.length - 1 ? '继续下一题' : '完成本轮'}</Text>
            </View>
          </View>
        </View>
      )}

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
