import { useCallback, useEffect, useRef, useState } from 'react'
import { useDidHide, useDidShow } from '@tarojs/taro'
import type { VenueDraw } from '../core/venue-service'

type Candidate = VenueDraw['candidates'][number]
type Phase = 'rolling' | 'slowing' | 'waiting'
export interface VenueDrawFrame {
  date: string
  candidates: Candidate[]
  candidate: Candidate
  turn: number
  phase: Phase
}
interface Session {
  timer?: ReturnType<typeof setTimeout>
  resolve: (draw: VenueDraw | null) => void
}
const REVEAL_AFTER = 2600

/** 名称轮换仅用于展示，最终结果始终取自云端；离开页面即停止播放。 */
export function useVenueDrawAnimation(scope: string, targetDate?: string) {
  const key = `${scope}:${targetDate || 'today'}`
  const latestKey = useRef(key)
  latestKey.current = key
  const mounted = useRef(true)
  const visible = useRef(true)
  const session = useRef<Session>()
  const [storedFrame, setFrame] = useState<{ key: string; frame: VenueDrawFrame }>()
  const [receipt, setReceipt] = useState<{ key: string; draw: VenueDraw }>()
  const cancel = useCallback(() => {
    const current = session.current
    if (!current) return
    if (current.timer !== undefined) clearTimeout(current.timer)
    session.current = undefined
    current.resolve(null)
  }, [])
  const reset = useCallback(() => {
    cancel()
    setFrame(undefined)
    setReceipt(undefined)
  }, [cancel])
  useEffect(() => {
    reset()
    return cancel
  }, [key, reset, cancel])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; cancel() }
  }, [cancel])
  useDidHide(() => { visible.current = false; cancel(); setFrame(undefined) })
  useDidShow(() => { visible.current = true; setReceipt(undefined) })

  const play = (date: string, candidates: Candidate[], request: () => Promise<VenueDraw>): Promise<VenueDraw | null> => {
    if (!scope || session.current || !mounted.current || !visible.current || latestKey.current !== key || !candidates.length) return Promise.resolve(null)
    const pool = candidates.map(({ id, name }) => ({ id, name }))
    setReceipt(undefined)
    return new Promise((resolve, reject) => {
      const current: Session = { resolve }
      session.current = current
      let elapsed = 0, turn = 0, previous = -1
      let result: VenueDraw | undefined
      const valid = () => session.current === current && mounted.current && visible.current && latestKey.current === key
      const tick = () => {
        if (!valid()) { if (session.current === current) cancel(); return }
        if (elapsed >= REVEAL_AFTER && result) {
          session.current = undefined
          setFrame(undefined)
          setReceipt({ key, draw: result })
          resolve(result)
          return
        }
        // 避免多候选时连续停留在同一名称；视觉随机不参与实际选店。
        const index = previous < 0 ? Math.floor(Math.random() * pool.length)
          : pool.length === 1 ? 0 : (previous + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length
        previous = index
        const phase: Phase = elapsed < 1700 ? 'rolling' : elapsed < REVEAL_AFTER ? 'slowing' : 'waiting'
        setFrame({ key, frame: { date, candidates: pool, candidate: pool[index], turn: turn++, phase } })
        const delay = elapsed < 1700 ? 75 + Math.round(55 * (elapsed / 1700) ** 2)
          : elapsed < REVEAL_AFTER ? 180 + Math.round(120 * (elapsed - 1700) / 900) : 320
        current.timer = setTimeout(() => { elapsed += delay; tick() }, delay)
      }
      tick()
      Promise.resolve().then(() => valid() ? request() : undefined).then((draw) => {
        if (valid() && draw) result = draw
      }, (error) => {
        if (!valid()) return
        if (current.timer !== undefined) clearTimeout(current.timer)
        session.current = undefined
        setFrame(undefined)
        reject(error)
      })
    })
  }
  return {
    frame: storedFrame?.key === key ? storedFrame.frame : undefined,
    result: receipt?.key === key ? receipt.draw : undefined,
    play, reset,
  }
}
