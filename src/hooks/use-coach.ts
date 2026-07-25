import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'

import { callCoach } from '../core/coach'
import {
  DEFAULT_COACH_ID,
  listCoaches,
  type PublicCoach,
} from '../content/coach-personas'
import type { DiscardPuzzle } from '../content/types'

export type CoachChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** 是否正在打字机渲染中 */
  streaming?: boolean
}

function localId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function storageKey(puzzleId: string, coachId: string) {
  return `coach_chat_${puzzleId}_${coachId}`
}

/** 从 localStorage 恢复历史消息 */
function loadHistory(puzzleId: string, coachId: string): CoachChatMessage[] {
  try {
    const raw = Taro.getStorageSync(storageKey(puzzleId, coachId))
    if (!raw) return []
    const arr = JSON.parse(raw) as CoachChatMessage[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** 持久化消息到 localStorage */
function saveHistory(puzzleId: string, coachId: string, msgs: CoachChatMessage[]) {
  try {
    Taro.setStorageSync(
      storageKey(puzzleId, coachId),
      JSON.stringify(msgs.map((m) => ({ ...m, streaming: false })))
    )
  } catch {
    /* ignore */
  }
}

/**
 * 教练聊天 Hook — 非流式调用 + 前端打字机模拟
 */
export function useCoach(opts: {
  puzzleId: string
  open: boolean
  selectedTile: string | null
  submitted: boolean
  attempt?: {
    discard?: string
    reasonable?: boolean
    hitRecommended?: boolean
    skipped?: boolean
  } | null
  puzzle: DiscardPuzzle | null
}) {
  const { puzzleId, open, selectedTile, submitted, attempt, puzzle } = opts

  const [coachId, setCoachId] = useState(DEFAULT_COACH_ID)
  const [messages, setMessages] = useState<CoachChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendingRef = useRef(false)
  const typewriterTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const coaches: PublicCoach[] = listCoaches().map((c) => ({
    id: c.id,
    name: c.name,
    tagline: c.tagline,
    avatar: c.avatar,
    accent: c.accent,
  }))
  const activeCoach = coaches.find((c) => c.id === coachId) ?? null

  // 切换题目时重置
  useEffect(() => {
    setCoachId(DEFAULT_COACH_ID)
    setInput('')
    setError(null)
    if (typewriterTimer.current) {
      clearInterval(typewriterTimer.current)
      typewriterTimer.current = null
    }
    setSending(false)
    sendingRef.current = false
  }, [puzzleId])

  // 加载历史消息
  useEffect(() => {
    if (!open || !puzzleId) return
    if (sendingRef.current) return
    const history = loadHistory(puzzleId, coachId)
    setMessages(history)
    setError(null)
  }, [open, puzzleId, coachId])

  // 清理打字机定时器
  useEffect(() => {
    return () => {
      if (typewriterTimer.current) {
        clearInterval(typewriterTimer.current)
      }
    }
  }, [])

  const switchCoach = useCallback((id: string) => {
    if (sendingRef.current) return
    setCoachId(id)
    setError(null)
  }, [])

  /**
   * 打字机效果：逐字追加到 assistant 消息
   */
  const startTypewriter = useCallback(
    (assistantId: string, fullText: string, puzzleId: string, coachId: string) => {
      let idx = 0
      const step = 2 // 每次 2 个字符
      const interval = 50 // 50ms

      typewriterTimer.current = setInterval(() => {
        idx += step
        if (idx >= fullText.length) {
          // 完成
          if (typewriterTimer.current) {
            clearInterval(typewriterTimer.current)
            typewriterTimer.current = null
          }
          setMessages((prev) => {
            const updated = prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: fullText, streaming: false }
                : m
            )
            // 持久化
            saveHistory(puzzleId, coachId, updated)
            return updated
          })
          setSending(false)
          sendingRef.current = false
        } else {
          const partial = fullText.slice(0, idx)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: partial, streaming: true }
                : m
            )
          )
        }
      }, interval)
    },
    []
  )

  const send = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim()
      if (!content || sendingRef.current || !puzzleId || !puzzle) return

      setInput('')
      setError(null)
      setSending(true)
      sendingRef.current = true

      const userMsg: CoachChatMessage = {
        id: localId(),
        role: 'user',
        content,
      }
      const assistantId = localId()

      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          streaming: true,
        },
      ])

      try {
        // 构建历史消息（不含刚追加的空 assistant 占位）
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const result = await callCoach({
          puzzleId,
          coachId,
          content,
          selectedTile,
          submitted,
          attempt,
          puzzle,
          history,
        })

        if (!result.content.trim()) {
          throw new Error('教练没有回复，请重试')
        }

        // 启动打字机效果
        startTypewriter(assistantId, result.content, puzzleId, coachId)
      } catch (e: any) {
        setError(e?.message || '发送失败')
        // 移除占位消息
        setMessages((prev) =>
          prev.filter(
            (m) => m.id !== assistantId && m.id !== userMsg.id
          )
        )
        setInput(content)
        setSending(false)
        sendingRef.current = false
      }
    },
    [input, puzzleId, coachId, selectedTile, submitted, attempt, puzzle, messages, startTypewriter]
  )

  const clearChat = useCallback(() => {
    if (sendingRef.current) return
    try {
      Taro.removeStorageSync(storageKey(puzzleId, coachId))
    } catch {
      /* ignore */
    }
    setMessages([])
    setError(null)
  }, [puzzleId, coachId])

  return {
    coachId,
    coaches,
    activeCoach,
    messages,
    input,
    setInput,
    sending,
    error,
    switchCoach,
    send,
    clearChat,
  }
}

/** 快捷问题列表 */
export function quickPrompts(opts: {
  submitted: boolean
  selectedTile?: string | null
}): string[] {
  const base = ['这手现在几向听？', '帮我分析一下牌的结构']
  if (opts.selectedTile) {
    base.push('打我选的这张牌怎么样？')
  } else {
    base.push('为什么不能随便拆对子？')
  }
  if (opts.submitted) {
    base.push('我哪里想错了？')
  } else {
    base.push('给我一个思考方向（不要剧透答案）')
  }
  return base
}
