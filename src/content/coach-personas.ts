/**
 * AI Coach 人设 — 仅保留前端 UI 展示字段
 * systemPrompt 和 temperature 由云函数 coachChat 统一管理，前端不持有提示词
 */

export type CoachAccent = 'sky' | 'amber' | 'emerald' | 'violet' | 'rose'

export type CoachPersona = {
  id: string
  name: string
  tagline: string
  /** 头像通过 getCoachAvatar(id) 获取 */
  avatar: string
  accent: CoachAccent
}

export const DEFAULT_COACH_ID = 'hehe'

export const COACH_PERSONAS: CoachPersona[] = [
  {
    id: 'zhouxx',
    name: '周猩猩',
    tagline: '搞笑技术流，边笑边学会',
    avatar: 'zhouxx',
    accent: 'rose',
  },
  {
    id: 'hehe',
    name: '何何',
    tagline: '温和耐心的陪练老师',
    avatar: 'hehe',
    accent: 'sky',
  },
  {
    id: 'duhan',
    name: '杜涵',
    tagline: '犀利直接的高水平牌友',
    avatar: 'duhan',
    accent: 'amber',
  },
]

export function listCoaches(): CoachPersona[] {
  return COACH_PERSONAS
}

export function getCoach(id: string): CoachPersona {
  return (
    COACH_PERSONAS.find((c) => c.id === id) ??
    COACH_PERSONAS.find((c) => c.id === DEFAULT_COACH_ID)!
  )
}
