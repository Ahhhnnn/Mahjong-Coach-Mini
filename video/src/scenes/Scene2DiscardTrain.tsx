import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { BackgroundCanvas } from '../components/BackgroundCanvas'
import { MahjongTile } from '../components/MahjongTile'
import { PhoneMockup } from '../components/PhoneMockup'
import { DEMO_PUZZLE } from '../data/demoData'
import { FONTS, SPRING_GENTLE, SPRING_SNAPPY, THEME } from '../theme'

export const Scene2DiscardTrain: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const phoneSpring = spring({ frame: Math.max(0, frame - 8), fps, config: SPRING_GENTLE })
  const hudSpring = spring({ frame: Math.max(0, frame - 20), fps, config: SPRING_GENTLE })

  // Discard interaction timeline
  const selectStart = 112
  const discardFrame = 175
  const resultStart = 198

  const isSelected = frame >= selectStart && frame < discardFrame
  const isDiscarded = frame >= discardFrame
  const discardSpring = spring({ frame: Math.max(0, frame - discardFrame), fps, config: SPRING_SNAPPY })
  const resultSpring = spring({ frame: Math.max(0, frame - resultStart), fps, config: SPRING_GENTLE })

  const animatedUkeire = Math.round(
    interpolate(frame, [resultStart + 12, resultStart + 58], [0, DEMO_PUZZLE.bestUkeireTotal], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  )

  return (
    <AbsoluteFill style={{ fontFamily: FONTS.sans }}>
      <BackgroundCanvas variant="bamboo" />

      <div
        style={{
          position: 'absolute',
          inset: '62px 76px 104px',
          display: 'flex',
          alignItems: 'center',
          gap: 54,
        }}
      >
        {/* Left: Authentic Mini-Program Phone Mockup */}
        <div
          style={{
            transform: `translateY(${interpolate(phoneSpring, [0, 1], [60, 0])}px)`,
            opacity: interpolate(phoneSpring, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
            flexShrink: 0,
          }}
        >
          <PhoneMockup width={416} height={784} title="拆搭训练">
            <div style={{ padding: '16px 16px 20px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Top green progress banner */}
              <div
                style={{
                  borderRadius: 16,
                  padding: '14px 16px',
                  background: `linear-gradient(135deg, ${THEME.brand}, #24783e)`,
                  color: '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, opacity: 0.9 }}>
                  <span>{DEMO_PUZZLE.chapter}</span>
                  <span style={{ fontWeight: 700 }}>3 / 6</span>
                </div>
                <div style={{ marginTop: 8, height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.22)', overflow: 'hidden' }}>
                  <div style={{ width: '54%', height: '100%', background: THEME.gold, borderRadius: 99 }} />
                </div>
              </div>

              {/* Puzzle info card */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 16,
                  padding: '14px 16px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: THEME.ink }}>{DEMO_PUZZLE.title}</span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '3px 9px',
                      borderRadius: 99,
                      background: '#e8f3ec',
                      color: THEME.brand,
                      fontWeight: 600,
                    }}
                  >
                    {DEMO_PUZZLE.variant}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                  请选择你要打出的牌（14 张门清 · 比较向听与最大进张）
                </div>
              </div>

              {/* Mini hand preview inside phone */}
              <div
                style={{
                  background: '#175029',
                  borderRadius: 16,
                  padding: '16px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>当前手牌（14 张）</span>
                  <span style={{ color: THEME.goldBright }}>{isDiscarded ? '已打出：一条' : '点击选牌'}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center' }}>
                  {DEMO_PUZZLE.hand.map((tile, i) => {
                    const isTarget = i === DEMO_PUZZLE.discardIndex
                    const lifted = isTarget && isSelected
                    const gone = isTarget && isDiscarded
                    return (
                      <div
                        key={`${tile}-${i}`}
                        style={{
                          transform: lifted ? 'translateY(-8px) scale(1.06)' : 'none',
                          opacity: gone ? 0.14 : 1,
                        }}
                      >
                        <MahjongTile tile={tile} width={39} highlighted={lifted} />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Result verdict inside phone */}
              <div
                style={{
                  flex: 1,
                  background: '#ffffff',
                  borderRadius: 16,
                  padding: '14px 16px',
                  border: isDiscarded ? `1.5px solid ${THEME.brand}` : '1px solid #ecece4',
                  opacity: isDiscarded ? interpolate(resultSpring, [0, 1], [0.2, 1]) : 0.72,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: isDiscarded ? THEME.brand : '#8b8f84',
                      }}
                    >
                      {isDiscarded ? '✓ 最优解 · 完美拆搭' : '等待出牌判定...'}
                    </span>
                    {isDiscarded && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#fff',
                          background: THEME.brand,
                          padding: '2px 10px',
                          borderRadius: 99,
                        }}
                      >
                        +25 XP
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#4b5563', lineHeight: 1.6, marginTop: 8 }}>
                    {isDiscarded
                      ? '拆掉 1-2 条边张弱搭，保留 2-6 筒五连形与 4-5 条两面搭，维持 1 向听并获得全场最大 19 张有效进张。'
                      : '算法将即时计算 14 张手牌所有候选切牌的向听数与有效进张数。'}
                  </div>
                </div>
                <div
                  style={{
                    height: 38,
                    borderRadius: 99,
                    background: isDiscarded ? THEME.brand : '#dce3dc',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isDiscarded ? '问问 AI 教练拆搭思路 →' : '确认打出'}
                </div>
              </div>
            </div>
          </PhoneMockup>
        </div>

        {/* Right: Hero Expanded Hand + Real-Time Shanten & Ukeire Algorithm HUD */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            opacity: interpolate(hudSpring, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
            transform: `translateX(${interpolate(hudSpring, [0, 1], [48, 0])}px)`,
          }}
        >
          {/* Header Eyebrow & Title */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: 3,
                  color: THEME.goldBright,
                  textTransform: 'uppercase',
                }}
              >
                SHANTEN &amp; UKEIRE ENGINE
              </span>
              <div style={{ width: 54, height: 1.5, background: 'rgba(237,199,121,0.5)' }} />
              <span style={{ fontSize: 16, color: THEME.jade }}>src/core/shanten.ts 实算验证</span>
            </div>
            <div
              style={{
                fontFamily: FONTS.serif,
                fontSize: 52,
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: 4,
                marginTop: 8,
              }}
            >
              14 张手牌 · 毫秒级拆搭推演
            </div>
          </div>

          {/* Enlarged 14-Tile Hand Stage */}
          <div
            style={{
              background: 'rgba(8, 28, 15, 0.62)',
              border: '1px solid rgba(237, 199, 121, 0.28)',
              borderRadius: 24,
              padding: '38px 28px 28px',
              boxShadow: '0 20px 44px rgba(0,0,0,0.34)',
              position: 'relative',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              {DEMO_PUZZLE.hand.map((tile, idx) => {
                const enterDelay = 28 + idx * 4
                const enterSp = spring({ frame: Math.max(0, frame - enterDelay), fps, config: SPRING_SNAPPY })
                const isTarget = idx === DEMO_PUZZLE.discardIndex
                const selectSp = spring({ frame: Math.max(0, frame - selectStart), fps, config: SPRING_SNAPPY })

                let translateY = interpolate(enterSp, [0, 1], [42, 0])
                let translateX = 0
                let rotate = 0
                let opacity = interpolate(enterSp, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' })

                if (isTarget && frame >= selectStart && frame < discardFrame) {
                  translateY -= interpolate(selectSp, [0, 1], [0, 28])
                } else if (isTarget && frame >= discardFrame) {
                  translateY -= 28 + interpolate(discardSpring, [0, 1], [0, 56])
                  translateX += interpolate(discardSpring, [0, 1], [0, 18])
                  rotate = interpolate(discardSpring, [0, 1], [0, 14])
                  opacity = interpolate(discardSpring, [0, 0.45, 0.92], [1, 0.55, 0])
                }

                return (
                  <div
                    key={`${tile}-${idx}`}
                    style={{
                      marginLeft: idx === 7 ? 16 : 0, // Subtle separation between Pin and Sou
                      transform: `translate(${translateX}px, ${translateY}px) rotate(${rotate}deg)`,
                      opacity,
                    }}
                  >
                    <MahjongTile
                      tile={tile}
                      width={74}
                      highlighted={isTarget && isSelected}
                      badge={isTarget && isSelected ? '最优切出' : undefined}
                    />
                  </div>
                )
              })}
            </div>

            <div
              style={{
                marginTop: 18,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 16,
                color: 'rgba(235, 244, 238, 0.78)',
                padding: '0 8px',
              }}
            >
              <span>筒子：2-6 筒五连形 + 8 筒定将</span>
              <span>条子：1-2 条边张（弱搭） · 4-5 条两面 · 7-9 条顺子</span>
            </div>
          </div>

          {/* Analysis Results Grid */}
          <div
            style={{
              display: 'flex',
              gap: 22,
              opacity: interpolate(resultSpring, [0, 0.45], [0, 1], { extrapolateRight: 'clamp' }),
              transform: `translateY(${interpolate(resultSpring, [0, 1], [34, 0])}px)`,
            }}
          >
            {/* Left Metric + Wait Tiles Card */}
            <div
              style={{
                flex: 1.05,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(86, 201, 160, 0.35)',
                borderRadius: 22,
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: 15, color: 'rgba(245,245,240,0.72)' }}>打出 一条（1s）后状态</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 4 }}>
                    <span style={{ fontFamily: FONTS.num, fontSize: 54, fontWeight: 700, color: THEME.goldBright }}>
                      {animatedUkeire}
                    </span>
                    <span style={{ fontSize: 22, fontWeight: 600, color: '#fff' }}>张有效进张</span>
                  </div>
                </div>
                <div
                  style={{
                    padding: '6px 16px',
                    borderRadius: 99,
                    background: 'rgba(86, 201, 160, 0.2)',
                    border: `1px solid ${THEME.jade}`,
                    color: THEME.jade,
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  1 向听
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 14, color: 'rgba(245,245,240,0.72)', marginBottom: 10 }}>
                  听牌进张明细（摸任意一张即听牌）：
                </div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  {DEMO_PUZZLE.waits.map((w, idx) => {
                    const wSp = spring({
                      frame: Math.max(0, frame - (resultStart + 24 + idx * 8)),
                      fps,
                      config: SPRING_SNAPPY,
                    })
                    return (
                      <div
                        key={w.tile}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          transform: `scale(${interpolate(wSp, [0, 1], [0.5, 1])})`,
                          opacity: interpolate(wSp, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
                        }}
                      >
                        <MahjongTile tile={w.tile} width={52} />
                        <span style={{ fontSize: 15, fontWeight: 700, color: THEME.goldBright }}>×{w.count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right Candidate Comparison Bars */}
            <div
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.07)',
                border: '1px solid rgba(237, 199, 121, 0.24)',
                borderRadius: 22,
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>候选切牌进张对比</div>
              {DEMO_PUZZLE.comparisons.map((row, idx) => {
                const barSp = spring({
                  frame: Math.max(0, frame - (resultStart + 22 + idx * 14)),
                  fps,
                  config: SPRING_GENTLE,
                })
                const pct = (row.ukeire / 20) * 100 * barSp
                return (
                  <div key={row.tile} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 16 }}>
                      <span style={{ color: row.optimal ? '#ffffff' : 'rgba(245,245,240,0.78)', fontWeight: row.optimal ? 700 : 500 }}>
                        {row.label}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            fontSize: 13,
                            padding: '2px 10px',
                            borderRadius: 99,
                            background: row.optimal ? 'rgba(86, 201, 160, 0.22)' : 'rgba(255,255,255,0.1)',
                            color: row.optimal ? THEME.jade : 'rgba(255,255,255,0.7)',
                            fontWeight: 600,
                          }}
                        >
                          {row.tag}
                        </span>
                        <span style={{ fontFamily: FONTS.num, fontSize: 20, fontWeight: 700, color: row.optimal ? THEME.goldBright : '#d0d7d2', width: 52, textAlign: 'right' }}>
                          {row.ukeire} 张
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 10, borderRadius: 99, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          borderRadius: 99,
                          background: row.optimal
                            ? `linear-gradient(90deg, ${THEME.jade}, ${THEME.gold})`
                            : 'rgba(255, 255, 255, 0.36)',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 8 Chapters 4x2 Balanced Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {DEMO_PUZZLE.chapters.map((ch, idx) => {
              const chOp = interpolate(frame, [300 + idx * 7, 318 + idx * 7], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
              return (
                <div
                  key={ch}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 999,
                    background: idx === 1 ? 'rgba(237,199,121,0.22)' : 'rgba(255,255,255,0.08)',
                    border: idx === 1 ? `1px solid ${THEME.gold}` : '1px solid rgba(255,255,255,0.14)',
                    color: idx === 1 ? THEME.goldBright : 'rgba(245,245,240,0.88)',
                    fontSize: 13.5,
                    fontWeight: idx === 1 ? 700 : 500,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    opacity: chOp,
                  }}
                >
                  第{idx + 1}章 · {ch}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}
