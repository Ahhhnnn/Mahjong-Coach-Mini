import { useEffect, useState } from 'react'
import { View, Text, Image, ScrollView, Input } from '@tarojs/components'

import { getCoachAvatar } from '../core/coach-images'
import { useCoach, quickPrompts } from '../hooks/use-coach'
import type { DiscardPuzzle } from '../content/types'
import './index.scss'

export function CoachPanel(props: {
  open: boolean
  onClose: () => void
  puzzleId: string
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
  const { open, onClose, puzzleId, selectedTile, submitted, attempt, puzzle } = props

  const {
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
  } = useCoach({ puzzleId, open, selectedTile, submitted, attempt, puzzle })

  const [scrollTrigger, setScrollTrigger] = useState('')

  // 自动滚动到底部
  useEffect(() => {
    if (open) {
      setScrollTrigger(`scroll-bottom-${Date.now()}`)
    }
  }, [messages, open, sending])

  const prompts = quickPrompts({ submitted, selectedTile })

  if (!open) return null

  return (
    <View className='coach-overlay' onClick={onClose}>
      <View className='coach-panel' onClick={(e) => e.stopPropagation()}>
        {/* 顶部标题栏 */}
        <View className='coach-header'>
          <View className='coach-header-left'>
            <Text className='coach-title'>问教练</Text>
            <Text className='coach-subtitle'>
              {submitted ? '已交卷 · 可对照解析细讲' : '交卷前不剧透标准答案'}
            </Text>
          </View>
          <View className='coach-close' onClick={onClose}>
            <Text className='coach-close-icon'>✕</Text>
          </View>
        </View>

        {/* 教练选择器 */}
        <View className='coach-picker'>
          {coaches.map((c) => {
            const isActive = c.id === coachId
            return (
              <View
                key={c.id}
                className={`coach-card ${isActive ? 'active' : ''} accent-${c.accent}`}
                onClick={() => switchCoach(c.id)}
              >
                <Image
                  className='coach-avatar'
                  src={getCoachAvatar(c.avatar)}
                  mode='aspectFill'
                />
                <View className='coach-info'>
                  <Text className='coach-name'>{c.name}</Text>
                  <Text className='coach-tagline'>{c.tagline}</Text>
                </View>
                {isActive && <Text className='coach-check'>✓</Text>}
              </View>
            )
          })}
        </View>

        {/* 消息列表 */}
        <ScrollView
          className='msg-list'
          scrollY
          scrollIntoView={scrollTrigger}
          scrollWithAnimation
        >
          {messages.length === 0 ? (
            <View className='msg-empty'>
              <Image
                className='msg-empty-avatar'
                src={activeCoach ? getCoachAvatar(activeCoach.avatar) : ''}
                mode='aspectFill'
              />
              <View className='msg-empty-text'>
                <Text className='msg-empty-name'>
                  {activeCoach?.name ?? '教练'}
                </Text>
                <Text className='msg-empty-desc'>
                  我能看到你当前的手牌和训练状态。直接问思路就好
                  {submitted
                    ? '；你已交卷，我可以对照解析细讲。'
                    : '；交卷前我不会剧透标准弃牌。'}
                </Text>
              </View>
            </View>
          ) : null}

          {messages.map((m) => {
            if (m.role === 'user') {
              return (
                <View key={m.id} className='msg-row user'>
                  <View className='msg-bubble user'>
                    <Text className='msg-text'>{m.content}</Text>
                  </View>
                </View>
              )
            }
            return (
              <View key={m.id} className='msg-row assistant'>
                <Image
                  className='msg-avatar'
                  src={activeCoach ? getCoachAvatar(activeCoach.avatar) : ''}
                  mode='aspectFill'
                />
                <View className='msg-bubble assistant'>
                  {m.streaming && !m.content ? (
                    <Text className='msg-thinking'>思考中…</Text>
                  ) : null}
                  {m.content ? (
                    <Text className='msg-text'>{m.content}</Text>
                  ) : null}
                  {m.streaming && m.content ? (
                    <Text className='msg-cursor'>|</Text>
                  ) : null}
                </View>
              </View>
            )
          })}

          {error && (
            <View className='msg-error'>
              <Text className='msg-error-text'>{error}</Text>
            </View>
          )}

          <View id={scrollTrigger} style={{ height: '1px' }} />
        </ScrollView>

        {/* 快捷问题 */}
        {messages.length > 0 && !sending && (
          <View className='quick-prompts'>
            {prompts.slice(0, 3).map((p) => (
              <View
                key={p}
                className='quick-prompt'
                onClick={() => send(p)}
              >
                <Text className='quick-prompt-text'>{p}</Text>
              </View>
            ))}
          </View>
        )}

        {messages.length === 0 && !sending && (
          <View className='quick-prompts'>
            {prompts.map((p) => (
              <View
                key={p}
                className='quick-prompt'
                onClick={() => send(p)}
              >
                <Text className='quick-prompt-text'>{p}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 输入区域 */}
        <View className='input-area'>
          <Input
            className='input-field'
            value={input}
            onInput={(e) => setInput(e.detail.value)}
            placeholder='问问教练…'
            confirmType='send'
            onConfirm={() => send()}
            disabled={sending}
            adjustPosition
          />
          <View
            className={`send-btn ${input.trim() && !sending ? 'active' : ''}`}
            onClick={() => send()}
          >
            <Text className='send-btn-text'>{sending ? '…' : '发送'}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
