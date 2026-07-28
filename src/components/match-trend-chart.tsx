import { useEffect, useRef } from 'react'
import { Canvas, View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { TrendPoint } from '../core/match-stats-service'

type Props = {
  points: TrendPoint[]
  height?: number
}

const BRAND = '#1a5c2e'

export default function MatchTrendChart({ points, height = 200 }: Props) {
  const canvasId = useRef(`match-trend-${Date.now()}`)

  useEffect(() => {
    const timer = setTimeout(() => draw(), 280)
    return () => clearTimeout(timer)
  }, [points])

  const draw = () => {
    const query = Taro.createSelectorQuery()
    query
      .select(`#${canvasId.current}`)
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res?.[0]?.node) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const width = res[0].width || 320
        const h = height
        const dpr = Taro.getSystemInfoSync().pixelRatio || 2
        canvas.width = width * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, width, h)

        const padL = 36
        const padR = 12
        const padT = 16
        const padB = 28
        const plotW = width - padL - padR
        const plotH = h - padT - padB

        const vals = points.length ? points.map((p) => p.cumulative) : [0]
        let minV = Math.min(...vals, 0)
        let maxV = Math.max(...vals, 0)
        if (minV === maxV) {
          maxV += 50
          minV -= 50
        }
        const span = maxV - minV || 1

        const yTicks = [minV, 0, maxV]
        ctx.font = '10px sans-serif'
        ctx.fillStyle = '#999'
        ctx.strokeStyle = '#eee'
        ctx.lineWidth = 1

        yTicks.forEach((v) => {
          const y = padT + ((maxV - v) / span) * plotH
          ctx.beginPath()
          ctx.moveTo(padL, y)
          ctx.lineTo(width - padR, y)
          ctx.stroke()
          const label = v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`
          ctx.fillText(label, 2, y + 3)
        })

        if (points.length < 2) {
          // 单点或空：画零线提示
          const y0 = padT + ((maxV - 0) / span) * plotH
          ctx.beginPath()
          ctx.moveTo(padL, y0)
          ctx.lineTo(width - padR, y0)
          ctx.strokeStyle = '#c8e6c9'
          ctx.stroke()
          if (points.length === 1) {
            const x = padL + plotW / 2
            const y = padT + ((maxV - points[0].cumulative) / span) * plotH
            ctx.beginPath()
            ctx.arc(x, y, 4, 0, Math.PI * 2)
            ctx.fillStyle = BRAND
            ctx.fill()
          }
          return
        }

        const coords = points.map((p, i) => {
          const x = padL + (i / (points.length - 1)) * plotW
          const y = padT + ((maxV - p.cumulative) / span) * plotH
          return { x, y, label: p.label }
        })

        // fill
        ctx.beginPath()
        ctx.moveTo(coords[0].x, padT + plotH)
        coords.forEach((c) => ctx.lineTo(c.x, c.y))
        ctx.lineTo(coords[coords.length - 1].x, padT + plotH)
        ctx.closePath()
        const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH)
        grad.addColorStop(0, 'rgba(26,92,46,0.28)')
        grad.addColorStop(1, 'rgba(26,92,46,0.02)')
        ctx.fillStyle = grad
        ctx.fill()

        // line
        ctx.beginPath()
        coords.forEach((c, i) => {
          if (i === 0) ctx.moveTo(c.x, c.y)
          else ctx.lineTo(c.x, c.y)
        })
        ctx.strokeStyle = BRAND
        ctx.lineWidth = 2.5
        ctx.stroke()

        coords.forEach((c) => {
          ctx.beginPath()
          ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2)
          ctx.fillStyle = '#fff'
          ctx.fill()
          ctx.strokeStyle = BRAND
          ctx.lineWidth = 2
          ctx.stroke()
        })

        // x labels (sparse)
        ctx.fillStyle = '#999'
        ctx.font = '10px sans-serif'
        const step = Math.max(1, Math.ceil(coords.length / 6))
        coords.forEach((c, i) => {
          if (i % step !== 0 && i !== coords.length - 1) return
          ctx.fillText(c.label, c.x - 10, h - 8)
        })
      })
  }

  if (!points.length) {
    return (
      <View className="trend-empty">
        <Text className="trend-empty-text">暂无趋势数据，先记一场牌局吧</Text>
      </View>
    )
  }

  return (
    <Canvas
      type="2d"
      id={canvasId.current}
      style={{ width: '100%', height: `${height}px` }}
    />
  )
}
