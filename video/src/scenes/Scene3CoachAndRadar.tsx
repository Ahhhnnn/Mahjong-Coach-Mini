import React from 'react'
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { BackgroundCanvas } from '../components/BackgroundCanvas'
import { DEMO_COACHES, DEMO_RADAR } from '../data/demoData'
import { FONTS, SPRING_GENTLE, SPRING_SNAPPY, THEME } from '../theme'

const EXTRA_MODES = [
  { badge: '进阶', title: '猜牌训练', desc: '读河牌与舍牌推理，练就听牌直觉' },
  { badge: '巩固', title: '错题本', desc: '归集失误牌型，定向复盘补齐短板' },
  { badge: '精选', title: '牌型收藏夹', desc: '随时回看高压局与等价最优拆法' },
]

export const Scene3CoachAndRadar: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const leftSp = spring({ frame: Math.max(0, frame - 8), fps, config: SPRING_GENTLE })
  const rightSp = spring({ frame: Math.max(0, frame - 22), fps, config: SPRING_GENTLE })

  // Switch from Hehe (0..265) to Duhan (266..end)
  const switchFrame = 266
  const activeIdx = frame >= switchFrame ? 1 : 0
  const coach = DEMO_COACHES[activeIdx]

  const phaseLocal = activeIdx === 0 ? frame - 28 : frame - switchFrame
  const qOpacity = interpolate(phaseLocal, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const qY = interpolate(phaseLocal, [0, 18], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const answerProgress = interpolate(phaseLocal, [26, 175], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const visibleChars = Math.floor(coach.answer.length * answerProgress)
  const streamedAnswer = coach.answer.slice(0, visibleChars)

  // Radar polygon spring growth
  const radarSp = spring({ frame: Math.max(0, frame - 64), fps, config: { damping: 14, stiffness: 85, mass: 1 } })
  const cx = 230
  const cy = 215
  const maxR = 148
  const n = DEMO_RADAR.labels.length

  const pointAt = (idx: number, pct: number) => {
    const angle = -Math.PI / 2 + (idx * Math.PI * 2) / n
    const r = (maxR * pct) / 100
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }

  const dataPoints = DEMO_RADAR.values.map((v, i) => pointAt(i, Math.max(6, v * radarSp)))
  const polygonStr = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <AbsoluteFill style={{ fontFamily: FONTS.sans }}>
      <BackgroundCanvas variant="bamboo" />

      <div
        style={{
          position: 'absolute',
          inset: '62px 76px 104px',
          display: 'flex',
          gap: 36,
          alignItems: 'stretch',
        }}
      >
        {/* LEFT PANEL: Dual-Persona AI Coach */}
        <div
          style={{
            flex: 1.04,
            borderRadius: 28,
            background: 'rgba(10, 32, 18, 0.72)',
            border: '1px solid rgba(237, 199, 121, 0.28)',
            boxShadow: '0 24px 54px rgba(0, 0, 0, 0.36)',
            padding: '32px 34px',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            transform: `translateY(${interpolate(leftSp, [0, 1], [48, 0])}px)`,
            opacity: interpolate(leftSp, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 3, color: THEME.goldBright }}>
                AI COACH · MULTI-PROVIDER LLM
              </span>
            </div>
            <div style={{ fontFamily: FONTS.serif, fontSize: 44, fontWeight: 700, color: '#fff', marginTop: 6, letterSpacing: 3 }}>
              双人设 AI 教练实时复盘
            </div>
          </div>

          {/* Persona Selector Cards */}
          <div style={{ display: 'flex', gap: 16 }}>
            {DEMO_COACHES.map((c, idx) => {
              const isActive = idx === activeIdx
              return (
                <div
                  key={c.id}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '16px 18px',
                    borderRadius: 18,
                    background: isActive ? c.accentBg : 'rgba(255,255,255,0.05)',
                    border: isActive ? `2px solid ${c.accent}` : '1px solid rgba(255,255,255,0.12)',
                    boxShadow: isActive ? `0 10px 26px ${c.accent}28` : 'none',
                    opacity: isActive ? 1 : 0.62,
                  }}
                >
                  <Img
                    src={staticFile(c.avatar)}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: `2.5px solid ${isActive ? c.accent : 'rgba(255,255,255,0.28)'}`,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{c.name}</span>
                      {isActive && (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 99,
                            background: c.accent,
                            color: '#0c1f14',
                          }}
                        >
                          对话中
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 14, color: 'rgba(240,247,242,0.78)' }}>{c.role}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Live Chat Thread */}
          <div
            style={{
              flex: 1,
              borderRadius: 22,
              background: 'rgba(252, 249, 241, 0.96)',
              padding: '26px 26px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            {/* Context pill showing attached hand */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderRadius: 12,
                background: '#eef3ea',
                border: '1px solid #d5e2cf',
                fontSize: 14,
                color: '#2c4c36',
              }}
            >
              <span style={{ fontWeight: 700 }}>关联手牌：2345688筒 · 1245789条</span>
              <span style={{ color: THEME.brand, fontWeight: 700 }}>已切一条 · 19 张进张</span>
            </div>

            {/* User question bubble */}
            <div
              style={{
                alignSelf: 'flex-end',
                maxWidth: '84%',
                padding: '15px 20px',
                borderRadius: '20px 20px 4px 20px',
                background: THEME.brand,
                color: '#fff',
                fontSize: 20,
                lineHeight: 1.5,
                fontWeight: 500,
                opacity: qOpacity,
                transform: `translateY(${qY}px)`,
                boxShadow: '0 8px 18px rgba(26, 92, 46, 0.24)',
              }}
            >
              {coach.question}
            </div>

            {/* Coach streamed response bubble */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                opacity: phaseLocal >= 22 ? 1 : 0,
              }}
            >
              <Img
                src={staticFile(coach.avatar)}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: `2px solid ${coach.accent}`,
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  flex: 1,
                  background: '#ffffff',
                  border: `1.5px solid ${coach.accent}55`,
                  borderRadius: '6px 20px 20px 20px',
                  padding: '18px 22px',
                  boxShadow: '0 8px 22px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: THEME.ink }}>
                    {coach.name} · {coach.role}
                  </span>
                  <span style={{ fontSize: 12, color: '#7a8278' }}>云函数 coachChat · 环境变量一键切模型</span>
                </div>
                <div
                  style={{
                    fontSize: 21,
                    lineHeight: 1.65,
                    color: '#223328',
                    minHeight: 138,
                  }}
                >
                  {streamedAnswer}
                  {answerProgress < 0.99 && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 3,
                        height: 22,
                        background: coach.accent,
                        marginLeft: 4,
                        verticalAlign: 'middle',
                        opacity: Math.floor(frame / 12) % 2 === 0 ? 1 : 0,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Bottom feature strip */}
            <div
              style={{
                marginTop: 'auto',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 14,
                borderTop: '1px dashed #dcd6c7',
                fontSize: 14,
                color: '#6b7063',
              }}
            >
              <span>支持 MiniMax / DeepSeek 等多模型适配器</span>
              <span style={{ color: THEME.brand, fontWeight: 700 }}>携带手牌上下文 · 精准讲透牌理</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: 5-Axis Capability Radar + Training Ecosystem */}
        <div
          style={{
            flex: 0.96,
            borderRadius: 28,
            background: '#faf8f2',
            border: '1px solid rgba(237, 199, 121, 0.45)',
            boxShadow: '0 24px 54px rgba(0, 0, 0, 0.36)',
            padding: '32px 34px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transform: `translateY(${interpolate(rightSp, [0, 1], [48, 0])}px)`,
            opacity: interpolate(rightSp, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          {/* Header + Stats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2.5, color: THEME.brand }}>
                GROWTH REPORT
              </span>
              <div style={{ fontFamily: FONTS.serif, fontSize: 40, fontWeight: 700, color: THEME.ink, marginTop: 4 }}>
                五维牌技能力雷达
              </div>
            </div>
            <div
              style={{
                padding: '8px 18px',
                borderRadius: 99,
                background: THEME.brand,
                color: THEME.goldBright,
                fontSize: 17,
                fontWeight: 700,
              }}
            >
              {DEMO_RADAR.level}
            </div>
          </div>

          {/* KPI Pills */}
          <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
            {[
              { label: '本周合理率', val: `${Math.round(DEMO_RADAR.weekAccuracy * radarSp)}%` },
              { label: '最优解命中', val: `${Math.round(DEMO_RADAR.weekOptimalRate * radarSp)}%` },
              { label: '连续训练', val: `${Math.round(DEMO_RADAR.streak * radarSp)} 天` },
            ].map((k) => (
              <div
                key={k.label}
                style={{
                  flex: 1,
                  background: '#eef3ec',
                  borderRadius: 16,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontFamily: FONTS.num, fontSize: 30, fontWeight: 700, color: THEME.brand }}>{k.val}</span>
                <span style={{ fontSize: 14, color: '#5c6b5f', marginTop: 2 }}>{k.label}</span>
              </div>
            ))}
          </div>

          {/* Animated SVG Radar Chart */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '4px 0' }}>
            <svg width="460" height="400" viewBox="0 0 460 400">
              {/* 4 concentric pentagon grid rings */}
              {[25, 50, 75, 100].map((lvl) => {
                const pts = Array.from({ length: n }, (_, i) => pointAt(i, lvl))
                  .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                  .join(' ')
                return (
                  <polygon
                    key={lvl}
                    points={pts}
                    fill={lvl === 100 ? 'rgba(26, 92, 46, 0.03)' : 'none'}
                    stroke={lvl === 100 ? '#b7d8be' : '#dfe4dd'}
                    strokeWidth={lvl === 100 ? 1.8 : 1.2}
                  />
                )
              })}

              {/* Radial axis lines */}
              {Array.from({ length: n }, (_, i) => {
                const end = pointAt(i, 100)
                return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#dfe4dd" strokeWidth={1.2} />
              })}

              {/* Filled radar area */}
              <polygon
                points={polygonStr}
                fill="rgba(26, 92, 46, 0.24)"
                stroke={THEME.brand}
                strokeWidth={3.5}
                strokeLinejoin="round"
              />

              {/* Vertices + Labels */}
              {DEMO_RADAR.labels.map((label, i) => {
                const p = dataPoints[i]
                const lblPos = pointAt(i, 124)
                const score = Math.round(DEMO_RADAR.values[i] * radarSp)
                return (
                  <g key={label}>
                    <circle cx={p.x} cy={p.y} r={9} fill="rgba(26, 92, 46, 0.2)" />
                    <circle cx={p.x} cy={p.y} r={5.5} fill={THEME.brand} stroke="#fff" strokeWidth={2} />
                    <text
                      x={lblPos.x}
                      y={lblPos.y - 6}
                      textAnchor="middle"
                      fontSize="17"
                      fontWeight="700"
                      fill="#23372a"
                    >
                      {label}
                    </text>
                    <text
                      x={lblPos.x}
                      y={lblPos.y + 16}
                      textAnchor="middle"
                      fontSize="16"
                      fontWeight="700"
                      fontFamily={FONTS.num}
                      fill={THEME.brand}
                    >
                      {score}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* 3 Training Loop Pills */}
          <div style={{ display: 'flex', gap: 12 }}>
            {EXTRA_MODES.map((m, idx) => {
              const mSp = spring({ frame: Math.max(0, frame - (160 + idx * 18)), fps, config: SPRING_SNAPPY })
              return (
                <div
                  key={m.title}
                  style={{
                    flex: 1,
                    background: '#ffffff',
                    border: '1px solid #e3e5dc',
                    borderRadius: 16,
                    padding: '14px 14px',
                    transform: `translateY(${interpolate(mSp, [0, 1], [24, 0])}px)`,
                    opacity: interpolate(mSp, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 99,
                        background: '#e6f2ea',
                        color: THEME.brand,
                      }}
                    >
                      {m.badge}
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 700, color: THEME.ink }}>{m.title}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7268', marginTop: 6, lineHeight: 1.45 }}>{m.desc}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}
