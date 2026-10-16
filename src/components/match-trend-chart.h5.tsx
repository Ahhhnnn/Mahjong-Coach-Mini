import { useEffect, useRef } from 'react'
import { View } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { init, type EChartsType } from './chart-engine'
import { trendOption } from './match-trend-option'
import type { MatchTrend } from '../core/match-stats-service'
import type { SettleUnit } from '../core/match-types'
let nextId = 0
export default function MatchTrendChart({ trend, unit, height = 260 }: { trend: MatchTrend; unit: SettleUnit; height?: number }) {
  const id = useRef(`h5-match-trend-${++nextId}`)
  const chart = useRef<EChartsType>()
  useDidShow(() => { requestAnimationFrame(() => chart.current?.resize()) })
  useEffect(() => {
    const element = document.getElementById(id.current)
    if (!element) return
    const instance = init(element, undefined, { renderer: 'canvas' })
    chart.current = instance
    const resize = () => instance.resize()
    window.addEventListener('resize', resize)
    return () => { window.removeEventListener('resize', resize); instance.dispose(); chart.current = undefined }
  }, [])
  useEffect(() => { chart.current?.setOption(trendOption(trend, unit), { replaceMerge: ['series'] }) }, [trend, unit])
  return <View id={id.current} style={{ width: '100%', height: `${height}px` }} />
}
