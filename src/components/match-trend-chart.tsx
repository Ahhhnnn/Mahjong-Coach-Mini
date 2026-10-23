import { useEffect, useRef, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { init, type EChartsType } from './chart-engine'
import { trendOption } from './match-trend-option'
import type { MatchTrend } from '../core/match-stats-service'
import './match-trend-chart.scss'

export type MatchTrendChartProps = { trend: MatchTrend; height?: number }
type NativeChart = { init: (callback: (canvas: any, width: number, height: number, dpr: number) => EChartsType | undefined, onError: (error: unknown) => void) => void; resizeChart: () => void }
let nextChartId = 0

/** weapp 原生 ec-canvas；资源全部随包携带，H5 由同名平台文件承接。 */
export default function MatchTrendChart({ trend, height = 260 }: MatchTrendChartProps) {
  const [id] = useState(() => `match-trend-${++nextChartId}`)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const chart = useRef<EChartsType>()
  const native = useRef<NativeChart>()
  const latest = useRef(trend)
  latest.current = trend
  useDidShow(() => { Taro.nextTick(() => native.current?.resizeChart()) })
  useEffect(() => {
    let disposed = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    setStatus('loading')
    const fail = (error: unknown) => {
      if (disposed) return
      if (chart.current && !chart.current.isDisposed()) chart.current.dispose()
      chart.current = undefined
      setStatus('error')
      console.warn('[match-trend] chart initialization failed', { id, error })
    }
    const attach = () => {
      if (disposed) return
      // 图表可能由云同步在后台挂载，不能在 render 时锁定全局 Current.page。
      for (const page of Taro.getCurrentPages().slice().reverse()) {
        native.current = (page as any).selectComponent?.(`#${id}`) || (page as any).selectComponent?.(`>>> #${id}`)
        if (native.current) break
      }
      if (!native.current) {
        if (++attempts < 40) timer = setTimeout(attach, 125)
        else fail(new Error('图表组件尚未就绪'))
        return
      }
      native.current.init((canvas, width, h, dpr) => {
        if (disposed) return undefined
        const instance = init(canvas, undefined, { width, height: h, devicePixelRatio: dpr, renderer: 'canvas' })
        chart.current = instance
        canvas.setChart(instance)
        instance.setOption(trendOption(latest.current))
        setStatus('ready')
        return instance
      }, fail)
    }
    Taro.nextTick(attach)
    return () => {
      disposed = true
      clearTimeout(timer)
      if (chart.current && !chart.current.isDisposed()) chart.current.dispose()
      chart.current = undefined
      native.current = undefined
    }
  }, [id, retry])
  useEffect(() => {
    try { chart.current?.setOption(trendOption(trend), { replaceMerge: ['series'] }) }
    catch (error) {
      console.warn('[match-trend] chart update failed', { id, error })
      chart.current?.dispose()
      chart.current = undefined
      setStatus('error')
    }
  }, [trend, id])
  return (
    <View className="match-trend-canvas" style={{ width: '100%', height: `${height}px` }}>
      <ec-canvas id={id} canvas-id={id} ec={{ lazyLoad: true }} style={{ display: 'block', width: '100%', height: '100%' }} />
      {status !== 'ready' && <View className="match-trend-status">
        <Text>{status === 'loading' ? '正在绘制积分走势…' : '趋势图暂未显示'}</Text>
        {status === 'error' && <View className="match-trend-retry" role="button" aria-label="重新加载趋势图" onClick={() => setRetry((value) => value + 1)}>点此重试</View>}
      </View>}
    </View>
  )
}
