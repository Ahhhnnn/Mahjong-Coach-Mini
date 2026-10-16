import { useEffect, useRef } from 'react'
import { View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { init, type EChartsType } from './chart-engine'
import { trendOption } from './match-trend-option'
import type { MatchTrend } from '../core/match-stats-service'

export type MatchTrendChartProps = { trend: MatchTrend; height?: number }
let nextChartId = 0

/** weapp 原生 ec-canvas；H5 由同名平台文件承接。 */
export default function MatchTrendChart({ trend, height = 260 }: MatchTrendChartProps) {
  const id = useRef(`match-trend-${++nextChartId}`)
  const chart = useRef<EChartsType>()
  const page = useRef(Taro.getCurrentInstance().page as any)
  const latest = useRef({ trend })
  latest.current = { trend }
  useDidShow(() => {
    Taro.nextTick(() => page.current?.selectComponent?.(`#${id.current}`)?.resizeChart?.())
  })
  useEffect(() => {
    let disposed = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout>
    const attach = () => {
      if (disposed) return
      const native = page.current?.selectComponent?.(`#${id.current}`)
      if (!native) {
        if (++attempts < 12) timer = setTimeout(attach, 100)
        return
      }
      native.init((canvas: any, width: number, h: number, dpr: number) => {
        if (disposed) return undefined
        const instance = init(canvas, undefined, { width, height: h, devicePixelRatio: dpr, renderer: 'canvas' })
        canvas.setChart(instance)
        chart.current = instance
        instance.setOption(trendOption(latest.current.trend))
        return instance
      })
    }
    Taro.nextTick(attach)
    return () => {
      disposed = true
      clearTimeout(timer)
      if (chart.current && !chart.current.isDisposed()) chart.current.dispose()
      chart.current = undefined
    }
  }, [])
  useEffect(() => {
    chart.current?.setOption(trendOption(trend), { replaceMerge: ['series'] })
  }, [trend])
  return (
    <View style={{ width: '100%', height: `${height}px` }}>
      <ec-canvas id={id.current} canvas-id={id.current} ec={{ lazyLoad: true }} style={{ display: 'block', width: '100%', height: '100%' }} />
    </View>
  )
}
