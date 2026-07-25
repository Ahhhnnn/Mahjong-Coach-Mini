import Taro from '@tarojs/taro'
import type { DiscardPuzzle } from '../content/types'

const CACHE_KEY = 'puzzles_cache'
const CACHE_VERSION_KEY = 'puzzles_version'

/** 读取本地缓存的题目（同步，用于秒开） */
export function getCachedPuzzles(): DiscardPuzzle[] {
  try {
    const data = Taro.getStorageSync(CACHE_KEY)
    if (Array.isArray(data) && data.length > 0) return data
  } catch { /* ignore */ }
  return []
}

/** 将题目写入本地缓存 */
function saveCache(puzzles: DiscardPuzzle[]) {
  try {
    Taro.setStorageSync(CACHE_KEY, puzzles)
    Taro.setStorageSync(CACHE_VERSION_KEY, Date.now())
  } catch { /* ignore */ }
}

/**
 * 从云端拉取最新题目并更新缓存。
 * - 成功：更新本地缓存，返回最新数据
 * - 失败（离线等）：返回本地缓存兜底
 */
export async function loadPuzzles(): Promise<DiscardPuzzle[]> {
  try {
    const res = await (Taro as any).cloud.callFunction({
      name: 'fetchPuzzles',
      data: { page: 1, pageSize: 500 },
    })
    const result = res?.result
    if (result?.ok && Array.isArray(result.puzzles) && result.puzzles.length > 0) {
      // 云端文档含 _id 字段，映射回前端 DiscardPuzzle 结构
      const puzzles: DiscardPuzzle[] = result.puzzles.map((p: any) => ({
        id: p._id || p.id,
        mode: p.mode,
        variant: p.variant,
        title: p.title,
        difficulty: p.difficulty,
        hand: p.hand,
        melds: p.melds && p.melds.length > 0 ? p.melds : undefined,
        recommendedDiscards: p.recommendedDiscards,
        discussableDiscards: p.discussableDiscards,
        analysis: p.analysis,
        rewards: p.rewards,
      }))
      saveCache(puzzles)
      return puzzles
    }
  } catch {
    /* 离线或云函数未部署时静默失败 */
  }
  // 兜底返回缓存
  return getCachedPuzzles()
}
