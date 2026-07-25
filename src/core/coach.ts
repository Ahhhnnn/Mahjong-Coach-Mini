import Taro from '@tarojs/taro'
import { ukeire } from './shanten'
import type { DiscardPuzzle } from '../content/types'

export type CoachCallInput = {
  puzzleId: string
  coachId: string
  content: string
  selectedTile: string | null
  submitted: boolean
  attempt?: {
    discard?: string
    reasonable?: boolean
    hitRecommended?: boolean
    skipped?: boolean
  } | null
  puzzle: DiscardPuzzle
  history: { role: 'user' | 'assistant'; content: string }[]
}

export type CoachCallResult = {
  content: string
}

/**
 * 调用云函数 coachChat 获取 AI 教练回复
 * 云函数代理 DeepSeek API，密钥安全在服务端
 */
export async function callCoach(input: CoachCallInput): Promise<CoachCallResult> {
  const fixedMelds = input.puzzle.melds?.length ?? 0
  const u = ukeire(input.puzzle.hand, undefined, fixedMelds)

  const data = {
    puzzleId: input.puzzleId,
    coachId: input.coachId,
    content: input.content,
    selectedTile: input.selectedTile,
    submitted: input.submitted,
    attempt: input.attempt,
    shanten: u.shanten,
    ukeireTotal: u.total,
    puzzle: input.puzzle,
    history: input.history,
  }

  try {
    const res = await Taro.cloud.callFunction({
      name: 'coachChat',
      data,
    })
    const result = res?.result as { ok: boolean; content?: string; error?: string }
    if (!result) {
      throw new Error('云函数无响应')
    }
    if (!result.ok) {
      throw new Error(result.error || 'AI 对话失败')
    }
    return { content: result.content || '' }
  } catch (e: any) {
    const errMsg = e?.errMsg || e?.message || ''
    // 云函数超时
    if (errMsg.includes('timed out') || errMsg.includes('-504003')) {
      throw new Error('AI 响应超时，请确认云函数超时已设为 60 秒并重新部署')
    }
    // 云函数未部署或网络错误
    if (errMsg.includes('not found') || errMsg.includes('FunctionName')) {
      throw new Error('云函数未部署，请在微信开发者工具中上传 coachChat 云函数')
    }
    throw new Error(errMsg || 'AI 调用失败，请稍后重试')
  }
}
