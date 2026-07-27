import { useEffect, useRef } from 'react'
import { Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'

type RadarChartProps = {
  /** 各维度数值 0-100 */
  values: number[]
  /** 各维度标签 */
  labels: string[]
  /** canvas 宽高 (px) */
  size?: number
}

export default function RadarChart({ values, labels, size = 260 }: RadarChartProps) {
  const canvasId = useRef(`radar-${Date.now()}`)
  const drawn = useRef(false)

  useEffect(() => {
    drawn.current = false
    // 延迟确保 canvas 节点已挂载
    const timer = setTimeout(() => {
      drawRadar()
    }, 300)
    return () => clearTimeout(timer)
  }, [values])

  const drawRadar = () => {
    const query = Taro.createSelectorQuery()
    query
      .select(`#${canvasId.current}`)
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res?.[0]?.node) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = Taro.getSystemInfoSync().pixelRatio || 2
        canvas.width = size * dpr
        canvas.height = size * dpr
        ctx.scale(dpr, dpr)

        const cx = size / 2
        const cy = size / 2
        const radius = size / 2 - 40
        const n = labels.length
        const angleStep = (Math.PI * 2) / n
        const startAngle = -Math.PI / 2 // 从顶部开始

        // 绘制网格（4层）
        for (let level = 1; level <= 4; level++) {
          const r = (radius * level) / 4
          ctx.beginPath()
          for (let i = 0; i <= n; i++) {
            const angle = startAngle + i * angleStep
            const x = cx + r * Math.cos(angle)
            const y = cy + r * Math.sin(angle)
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.closePath()
          ctx.strokeStyle = level === 4 ? '#c8e6c9' : '#e8e8e8'
          ctx.lineWidth = 1
          ctx.stroke()
        }

        // 绘制轴线
        for (let i = 0; i < n; i++) {
          const angle = startAngle + i * angleStep
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle))
          ctx.strokeStyle = '#e8e8e8'
          ctx.lineWidth = 1
          ctx.stroke()
        }

        // 绘制数据区域
        ctx.beginPath()
        for (let i = 0; i <= n; i++) {
          const idx = i % n
          const angle = startAngle + idx * angleStep
          const r = (radius * Math.max(values[idx] ?? 0, 5)) / 100
          const x = cx + r * Math.cos(angle)
          const y = cy + r * Math.sin(angle)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.fillStyle = 'rgba(26, 92, 46, 0.25)'
        ctx.fill()
        ctx.strokeStyle = '#1a5c2e'
        ctx.lineWidth = 2
        ctx.stroke()

        // 绘制数据点
        for (let i = 0; i < n; i++) {
          const angle = startAngle + i * angleStep
          const r = (radius * Math.max(values[i] ?? 0, 5)) / 100
          const x = cx + r * Math.cos(angle)
          const y = cy + r * Math.sin(angle)
          ctx.beginPath()
          ctx.arc(x, y, 4, 0, Math.PI * 2)
          ctx.fillStyle = '#1a5c2e'
          ctx.fill()
          ctx.beginPath()
          ctx.arc(x, y, 2, 0, Math.PI * 2)
          ctx.fillStyle = '#fff'
          ctx.fill()
        }

        // 绘制标签
        ctx.font = '11px sans-serif'
        ctx.fillStyle = '#666'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        for (let i = 0; i < n; i++) {
          const angle = startAngle + i * angleStep
          const labelR = radius + 24
          const x = cx + labelR * Math.cos(angle)
          const y = cy + labelR * Math.sin(angle)
          ctx.fillText(labels[i], x, y)
        }

        drawn.current = true
      })
  }

  return (
    <Canvas
      type="2d"
      id={canvasId.current}
      canvasId={canvasId.current}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  )
}
