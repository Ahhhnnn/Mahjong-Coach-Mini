import React, { useId } from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { BackgroundCanvas } from '../components/BackgroundCanvas'
import { DEMO_BADGES, DEMO_TREND } from '../data/demoData'
import { FONTS, SPRING_GENTLE, SPRING_SNAPPY, THEME } from '../theme'

const SEASONS = ['全年', 'Q1', 'Q2', 'Q3', 'Q4']

const RARITY_STYLE: Record<string, { border: string; bg: string; badgeBg: string; color: string }> = {
  gold: {
    border: 'rgba(237, 199, 121, 0.65)',
    bg: 'linear-gradient(145deg, rgba(237,199,121,0.2), rgba(237,199,121,0.06))',
    badgeBg: 'rgba(237,199,121,0.26)',
    color: '#f8df9c',
  },
  silver: {
    border: 'rgba(195, 212, 224, 0.5)',
    bg: 'linear-gradient(145deg, rgba(205,222,235,0.16), rgba(205,222,235,0.05))',
    badgeBg: 'rgba(205,222,235,0.22)',
    color: '#dce9f2',
  },
  legend: {
    border: '#f7c96e',
    bg: 'linear-gradient(135deg, rgba(247,201,110,0.3), rgba(201,92,68,0.22))',
    badgeBg: 'linear-gradient(90deg, #f7c96e, #e58d58)',
    color: '#1b1407',
  },
}

function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ''
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i]
    const p1 = pts[i + 1]
    const cx = (p0.x + p1.x) / 2
    d += ` C ${cx.toFixed(1)} ${p0.y.toFixed(1)}, ${cx.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`
  }
  return d
}

export const Scene4RecordsAndBadges: React.FC = () => {
  const uid = useId().replace(/:/g, '')
  const clipId = `trendRevealClip-${uid}`
  const fillId = `leaderFill-${uid}`
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const headSp = spring({ frame: Math.max(0, frame - 6), fps, config: SPRING_GENTLE })
  const chartReveal = interpolate(frame, [38, 225], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Chart geometry
  const W = 940
  const H = 490
  const padL = 62
  const padR = 36
  const padT = 32
  const padB = 42
  const minV = -210
  const maxV = 220

  const mapX = (i: number) => padL + (i / (DEMO_TREND.xLabels.length - 1)) * (W - padL - padR)
  const mapY = (v: number) => padT + ((maxV - v) / (maxV - minV)) * (H - padT - padB)
  const zeroY = mapY(0)
  const revealX = padL + chartReveal * (W - padL - padR + 24)

  // Legendary unlock toast celebration
  const unlockFrame = 455
  const unlockSp = spring({ frame: Math.max(0, frame - unlockFrame), fps, config: SPRING_SNAPPY })

  return (
    <AbsoluteFill style={{ fontFamily: FONTS.sans }}>
      <BackgroundCanvas variant="bamboo" />

      <div
        style={{
          position: 'absolute',
          inset: '54px 72px 104px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Top Header Row: Title + Season Switcher */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            opacity: interpolate(headSp, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
            transform: `translateY(${interpolate(headSp, [0, 1], [24, 0])}px)`,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 3.5, color: THEME.goldBright }}>
                THE RISE &amp; THE RALLY · CLOUD SYNCED TABLE
              </span>
              <span style={{ fontSize: 14, color: THEME.jade }}>四人固定身份认领 · 微信云端实时同步</span>
            </div>
            <div style={{ fontFamily: FONTS.serif, fontSize: 48, fontWeight: 700, color: '#fff', letterSpacing: 4, marginTop: 4 }}>
              牌桌风云 · 赛季走势与生涯荣誉
            </div>
          </div>

          {/* Season Switcher */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 6,
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(237, 199, 121, 0.28)',
            }}
          >
            {SEASONS.map((s) => {
              const active = s === 'Q3'
              return (
                <div
                  key={s}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 999,
                    background: active ? THEME.gold : 'transparent',
                    color: active ? '#15291c' : 'rgba(245,245,240,0.8)',
                    fontSize: 16,
                    fontWeight: active ? 800 : 500,
                  }}
                >
                  {s === 'Q3' ? '2026 Q3' : s}
                </div>
              )
            })}
          </div>
        </div>

        {/* Main 2-Column Stage */}
        <div style={{ flex: 1, display: 'flex', gap: 28, minHeight: 0 }}>
          {/* LEFT: Multi-Player Trend Chart Card */}
          <div
            style={{
              flex: 1.48,
              borderRadius: 28,
              background: 'rgba(9, 30, 17, 0.72)',
              border: '1px solid rgba(237, 199, 121, 0.26)',
              boxShadow: '0 24px 50px rgba(0, 0, 0, 0.36)',
              padding: '26px 30px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* 4 Player Score Summary Strip */}
            <div style={{ display: 'flex', gap: 14 }}>
              {DEMO_TREND.players.map((p, idx) => {
                const currentVal = Math.round(p.total * chartReveal)
                const sign = currentVal >= 0 ? '+' : ''
                return (
                  <div
                    key={p.name}
                    style={{
                      flex: 1,
                      padding: '14px 16px',
                      borderRadius: 16,
                      background: idx === 0 ? 'rgba(237, 199, 121, 0.14)' : 'rgba(255, 255, 255, 0.05)',
                      border: idx === 0 ? `1.5px solid ${p.color}99` : '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#f4f7f5', letterSpacing: 0.5 }}>{p.name}</span>
                      </div>
                      {idx === 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1b281e', background: THEME.gold, padding: '1px 7px', borderRadius: 99 }}>
                          领跑
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: FONTS.num, fontSize: 30, fontWeight: 700, color: p.color }}>
                      {sign}{currentVal}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Animated ECharts-inspired SVG Line Chart */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                <defs>
                  <clipPath id={clipId}>
                    <rect x={0} y={0} width={revealX} height={H} />
                  </clipPath>
                  <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#edc779" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#edc779" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Y Grid Lines */}
                {[-150, -75, 0, 75, 150].map((v) => {
                  const y = mapY(v)
                  const isZero = v === 0
                  return (
                    <g key={v}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={W - padR}
                        y2={y}
                        stroke={isZero ? 'rgba(237,199,121,0.45)' : 'rgba(255,255,255,0.1)'}
                        strokeWidth={isZero ? 1.5 : 1}
                        strokeDasharray={isZero ? '6 6' : undefined}
                      />
                      <text
                        x={padL - 12}
                        y={y + 5}
                        textAnchor="end"
                        fontSize="13"
                        fontFamily={FONTS.num}
                        fill={isZero ? THEME.goldBright : 'rgba(255,255,255,0.5)'}
                      >
                        {v > 0 ? `+${v}` : v}
                      </text>
                    </g>
                  )
                })}

                {/* X Axis Dates */}
                {DEMO_TREND.xLabels.map((lbl, idx) => (
                  <text
                    key={lbl}
                    x={mapX(idx)}
                    y={H - 12}
                    textAnchor="middle"
                    fontSize="14"
                    fontFamily={FONTS.num}
                    fill="rgba(235, 245, 238, 0.62)"
                  >
                    {lbl}
                  </text>
                ))}

                {/* Clipped Animated Curves */}
                <g clipPath={`url(#${clipId})`}>
                  {/* Subtle area fill for leader */}
                  {(() => {
                    const leaderPts = DEMO_TREND.players[0].values.map((v, i) => ({ x: mapX(i), y: mapY(v) }))
                    const curve = buildSmoothPath(leaderPts)
                    const area = `${curve} L ${leaderPts[leaderPts.length - 1].x} ${zeroY} L ${leaderPts[0].x} ${zeroY} Z`
                    return <path d={area} fill={`url(#${fillId})`} />
                  })()}

                  {/* All 4 Player Curves */}
                  {DEMO_TREND.players.map((player, pIdx) => {
                    const pts = player.values.map((v, i) => ({ x: mapX(i), y: mapY(v) }))
                    const d = buildSmoothPath(pts)
                    return (
                      <g key={player.name}>
                        <path
                          d={d}
                          fill="none"
                          stroke={player.color}
                          strokeWidth={pIdx === 0 ? 4.2 : 3}
                          strokeLinecap="round"
                        />
                        {pts.map((pt, i) => (
                          <circle
                            key={i}
                            cx={pt.x}
                            cy={pt.y}
                            r={i === pts.length - 1 ? 6 : 3.5}
                            fill={player.color}
                            stroke="#0b2414"
                            strokeWidth={2}
                          />
                        ))}
                      </g>
                    )
                  })}
                </g>
              </svg>
            </div>

            {/* Footer caption */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'rgba(235,244,238,0.68)' }}>
              <span>基于 ECharts 5.6 原生 Canvas 2D 渲染 · 零外部 CDN 依赖</span>
              <span>离线可查 · 冲突保留本机草稿</span>
            </div>
          </div>

          {/* RIGHT: 14 Career Badges Wall + Legendary Unlock Celebration */}
          <div
            style={{
              flex: 1,
              borderRadius: 28,
              background: 'rgba(13, 38, 22, 0.78)',
              border: '1px solid rgba(237, 199, 121, 0.34)',
              boxShadow: '0 24px 50px rgba(0, 0, 0, 0.36)',
              padding: '26px 28px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2.5, color: THEME.goldBright }}>
                  CAREER HONORS
                </div>
                <div style={{ fontFamily: FONTS.serif, fontSize: 32, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                  14 枚生涯荣誉墙
                </div>
              </div>
              <div
                style={{
                  padding: '6px 14px',
                  borderRadius: 99,
                  background: 'rgba(237,199,121,0.16)',
                  border: '1px solid rgba(237,199,121,0.45)',
                  color: THEME.goldBright,
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                青铜 · 白银 · 黄金 · 传奇
              </div>
            </div>

            {/* 2x3 Badges Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, flex: 1 }}>
              {DEMO_BADGES.map((b, idx) => {
                const delay = 235 + idx * 28
                const bSp = spring({ frame: Math.max(0, frame - delay), fps, config: SPRING_SNAPPY })
                const st = RARITY_STYLE[b.rarity]
                const isLegend = b.rarity === 'legend'
                return (
                  <div
                    key={b.id}
                    style={{
                      borderRadius: 18,
                      padding: '16px 16px',
                      background: st.bg,
                      border: `1.5px solid ${st.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transform: `scale(${interpolate(bSp, [0, 1], [0.76, 1])})`,
                      opacity: interpolate(bSp, [0, 0.45], [0, 1], { extrapolateRight: 'clamp' }),
                      boxShadow: isLegend ? '0 0 28px rgba(247, 201, 110, 0.28)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 21, fontWeight: 700, color: '#fff' }}>{b.name}</span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          padding: '2px 10px',
                          borderRadius: 99,
                          background: st.badgeBg,
                          color: st.color,
                        }}
                      >
                        {b.rarityLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: 13.5, color: 'rgba(245,245,240,0.8)', lineHeight: 1.45, marginTop: 8 }}>
                      {b.desc}
                    </div>
                    <div style={{ marginTop: 10, height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: '100%', background: isLegend ? '#f7c96e' : THEME.jade, borderRadius: 99 }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legendary Achievement Celebration Toast */}
            {frame >= unlockFrame && (
              <div
                style={{
                  position: 'absolute',
                  left: 20,
                  right: 20,
                  bottom: 20,
                  padding: '20px 24px',
                  borderRadius: 20,
                  background: 'linear-gradient(135deg, #2b2009 0%, #4e3710 55%, #2a1c08 100%)',
                  border: '2px solid #f7c96e',
                  boxShadow: '0 20px 44px rgba(0,0,0,0.65), 0 0 36px rgba(247,201,110,0.38)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transform: `translateY(${interpolate(unlockSp, [0, 1], [90, 0])}px) scale(${interpolate(unlockSp, [0, 1], [0.92, 1])})`,
                  opacity: interpolate(unlockSp, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' }),
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2.5, color: '#f8df9c' }}>
                    ★ LEGENDARY BADGE UNLOCKED
                  </div>
                  <div style={{ fontFamily: FONTS.serif, fontSize: 28, fontWeight: 700, color: '#ffffff', marginTop: 4 }}>
                    新解锁传奇荣誉 · 五连绝世
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(255,245,220,0.85)', marginTop: 2 }}>
                    逐场时间轴回放精准核验，高光时刻集中庆贺
                  </div>
                </div>
                <div
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ffe299, #d48a29)',
                    color: '#221604',
                    fontFamily: FONTS.serif,
                    fontSize: 26,
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 24px rgba(247,201,110,0.55)',
                    flexShrink: 0,
                  }}
                >
                  绝
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}
