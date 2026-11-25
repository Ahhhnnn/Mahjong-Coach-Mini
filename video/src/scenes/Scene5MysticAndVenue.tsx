import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { BackgroundCanvas } from '../components/BackgroundCanvas'
import { SealStamp } from '../components/SealStamp'
import { DEMO_MYSTIC, DEMO_VENUE } from '../data/demoData'
import { FONTS, SPRING_GENTLE, SPRING_SNAPPY, THEME } from '../theme'

// Deterministic decelerating lottery schedule (local frames within Scene 5)
// Simulates the real 2.8s fast-spin -> gradual slowdown -> settle on winnerIndex = 2 ('竹韵麻将馆')
export const VENUE_REEL_START = 228
export const VENUE_TICK_LOCAL_FRAMES = [
  228, 234, 240, 246, 252, 258, 265, 272, 280, 289, 299, 310, 323, 338, 356, 378, 404, 434,
]
export const VENUE_SETTLE_LOCAL_FRAME = 434
export const VENUE_STAMP_LOCAL_FRAME = 446

function getReelState(frame: number) {
  const total = DEMO_VENUE.candidates.length
  if (frame < VENUE_REEL_START) {
    return { phase: 'idle' as const, activeIdx: -1, stepAge: 0 }
  }
  if (frame >= VENUE_SETTLE_LOCAL_FRAME) {
    return { phase: 'revealed' as const, activeIdx: DEMO_VENUE.winnerIndex, stepAge: frame - VENUE_SETTLE_LOCAL_FRAME }
  }
  let stepIdx = 0
  for (let i = 0; i < VENUE_TICK_LOCAL_FRAMES.length; i++) {
    if (frame >= VENUE_TICK_LOCAL_FRAMES[i]) stepIdx = i
  }
  // Ensure the final step lands precisely on winnerIndex (2)
  const finalStep = VENUE_TICK_LOCAL_FRAMES.length - 1
  const offset = (DEMO_VENUE.winnerIndex - (finalStep % total) + total) % total
  const activeIdx = (stepIdx + offset) % total
  const stepAge = frame - VENUE_TICK_LOCAL_FRAMES[stepIdx]
  return {
    phase: stepIdx >= 11 ? ('slowing' as const) : ('fast' as const),
    activeIdx,
    stepAge,
  }
}

export const Scene5MysticAndVenue: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const leftSp = spring({ frame: Math.max(0, frame - 8), fps, config: SPRING_GENTLE })
  const rightSp = spring({ frame: Math.max(0, frame - 24), fps, config: SPRING_GENTLE })

  const reel = getReelState(frame)
  const isRevealed = reel.phase === 'revealed'
  const activeVenueName =
    reel.activeIdx >= 0 ? DEMO_VENUE.candidates[reel.activeIdx].name : '点击开始抽签'

  const revealSp = spring({
    frame: Math.max(0, frame - VENUE_SETTLE_LOCAL_FRAME),
    fps,
    config: SPRING_SNAPPY,
  })

  return (
    <AbsoluteFill style={{ fontFamily: FONTS.sans }}>
      <BackgroundCanvas variant="paper" />

      <div
        style={{
          position: 'absolute',
          inset: '54px 72px 104px',
          display: 'flex',
          gap: 38,
          alignItems: 'stretch',
        }}
      >
        {/* LEFT HALF: 牌桌玄学 · 牌桌命簿 */}
        <div
          style={{
            flex: 1,
            borderRadius: 24,
            background: THEME.paperCard,
            border: '1.5px solid #ddd4c2',
            boxShadow: '0 22px 46px rgba(64, 53, 34, 0.1)',
            padding: '32px 36px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transform: `translateY(${interpolate(leftSp, [0, 1], [44, 0])}px)`,
            opacity: interpolate(leftSp, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          {/* Antique Book Header */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, letterSpacing: 2.5, color: '#877e6e' }}>
              <span>清风 的牌桌命簿</span>
              <span>以牌为记 · 以局为据</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
              <div>
                <div style={{ fontFamily: FONTS.serif, fontSize: 52, fontWeight: 700, color: '#263d30', letterSpacing: 8 }}>
                  牌桌玄学
                </div>
                <div style={{ fontSize: 18, color: '#7a7567', letterSpacing: 2.5, marginTop: 4 }}>
                  冤家有路，福地有门。
                </div>
              </div>
              <SealStamp lines={['牌桌', '有缘']} triggerFrame={56} size={78} rotation={6} />
            </div>
          </div>

          {/* Chapter 1: 牌友相克 */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: '1.5px solid #c7bda6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: FONTS.serif,
                  fontSize: 22,
                  color: '#7e765e',
                }}
              >
                壹
              </div>
              <div>
                <div style={{ fontFamily: FONTS.serif, fontSize: 24, fontWeight: 700, color: '#263d30' }}>
                  牌友相克 · 头号冤家
                </div>
                <div style={{ fontSize: 13.5, color: '#7b7468' }}>
                  至少 5 场且压制率超 50%，自动识别同场最大克星
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {DEMO_MYSTIC.opponents.map((op, idx) => {
                const barSp = spring({
                  frame: Math.max(0, frame - (76 + idx * 18)),
                  fps,
                  config: SPRING_GENTLE,
                })
                return (
                  <div
                    key={op.name}
                    style={{
                      padding: '14px 18px',
                      borderRadius: 12,
                      background: op.hot ? '#f3eae0' : '#f8f4ea',
                      border: op.hot ? '1.5px solid #d5bba8' : '1px solid #e6dfd0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: FONTS.num, fontSize: 18, color: '#b1a78f' }}>{op.index}</span>
                        <span style={{ fontSize: 20, fontWeight: 700, color: '#263d30' }}>{op.name}</span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '2px 9px',
                            borderRadius: 4,
                            background: op.hot ? '#efe0d7' : '#e6ecdf',
                            color: op.hot ? '#9f4f3d' : '#366346',
                          }}
                        >
                          {op.tag}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontFamily: FONTS.num, fontSize: 28, fontWeight: 700, color: op.hot ? '#9b5542' : '#3c5944' }}>
                          {Math.round(op.rate * barSp)}%
                        </span>
                        <span style={{ fontSize: 13, color: '#7b7468' }}>压制率</span>
                      </div>
                    </div>
                    <div style={{ height: 7, borderRadius: 4, background: '#e5ddd0', margin: '10px 0 8px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${op.rate * barSp}%`,
                          height: '100%',
                          borderRadius: 4,
                          background: op.hot ? '#a7604c' : '#588264',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#7d7567' }}>
                      <span>压我 {op.ahead} 场 · 我领先 {op.behind} 场（同场 {op.games} 场）</span>
                      <span>场均分差 {op.gap}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Chapter 2: 福地雷区 */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 14 }}>
              {/* 福地 */}
              <div
                style={{
                  flex: 1,
                  padding: '18px 20px',
                  borderRadius: 12,
                  background: '#e4eadd',
                  border: '1px solid #c5d1bb',
                }}
              >
                <div style={{ fontSize: 13, letterSpacing: 2.5, color: '#416148', fontWeight: 700 }}>贰 · 牌桌福地</div>
                <div style={{ fontFamily: FONTS.serif, fontSize: 28, fontWeight: 700, color: '#1b3d28', marginTop: 6 }}>
                  {DEMO_MYSTIC.luckyPlace.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
                  <span style={{ fontFamily: FONTS.num, fontSize: 28, fontWeight: 700, color: THEME.brand }}>
                    {DEMO_MYSTIC.luckyPlace.avg}
                  </span>
                  <span style={{ fontSize: 13, color: '#556950' }}>
                    胜率 {DEMO_MYSTIC.luckyPlace.winRate} · {DEMO_MYSTIC.luckyPlace.games} 场
                  </span>
                </div>
              </div>

              {/* 雷区 */}
              <div
                style={{
                  flex: 1,
                  padding: '18px 20px',
                  borderRadius: 12,
                  background: '#eee5d7',
                  border: '1px solid #d8c8b3',
                }}
              >
                <div style={{ fontSize: 13, letterSpacing: 2.5, color: '#925a48', fontWeight: 700 }}>贰 · 牌桌雷区</div>
                <div style={{ fontFamily: FONTS.serif, fontSize: 28, fontWeight: 700, color: '#3b2b22', marginTop: 6 }}>
                  {DEMO_MYSTIC.unluckyPlace.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
                  <span style={{ fontFamily: FONTS.num, fontSize: 28, fontWeight: 700, color: '#9b5542' }}>
                    {DEMO_MYSTIC.unluckyPlace.avg}
                  </span>
                  <span style={{ fontSize: 13, color: '#7b6655' }}>
                    胜率 {DEMO_MYSTIC.unluckyPlace.winRate} · {DEMO_MYSTIC.unluckyPlace.games} 场
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT HALF: 棋牌室抽签 · 提前定签 */}
        <div
          style={{
            flex: 1,
            borderRadius: 24,
            background: '#faf8f2',
            border: '1.5px solid #d5dccb',
            boxShadow: '0 22px 46px rgba(42, 65, 30, 0.1)',
            padding: '32px 36px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transform: `translateY(${interpolate(rightSp, [0, 1], [44, 0])}px)`,
            opacity: interpolate(rightSp, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          {/* Heading + Date Picker Card */}
          <div>
            <div style={{ fontSize: 14, letterSpacing: 4, color: '#7c806f', fontWeight: 600 }}>
              四人常聚 · 提前定签
            </div>
            <div style={{ fontFamily: FONTS.serif, fontSize: 44, fontWeight: 700, color: '#183e2a', marginTop: 8 }}>
              为下一场，定个去处
            </div>

            <div
              style={{
                marginTop: 18,
                padding: '16px 22px',
                borderRadius: 14,
                background: '#eef1e6',
                border: '1px solid #d8dfcf',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: '#64775a' }}>目标牌局日期（可提前 30 天选店）</div>
                <div style={{ fontFamily: FONTS.num, fontSize: 28, fontWeight: 700, color: '#183e2a', marginTop: 4 }}>
                  {DEMO_VENUE.targetDate}
                </div>
              </div>
              <div
                style={{
                  padding: '6px 14px',
                  borderRadius: 99,
                  background: '#ffffff',
                  border: '1px solid #c9d4be',
                  fontSize: 13,
                  color: THEME.brand,
                  fontWeight: 700,
                }}
              >
                云端 crypto.randomInt
              </div>
            </div>
          </div>

          {/* Main Lottery Ticket Card (faithful to venue-ticket) */}
          <div
            style={{
              marginTop: 18,
              borderRadius: 18,
              padding: '24px 26px',
              background: isRevealed ? '#eaf0e5' : '#fffdf8',
              border: isRevealed ? '2px solid #9db88a' : '2px solid #d5dccb',
              boxShadow: isRevealed
                ? '0 14px 32px rgba(26, 92, 46, 0.14)'
                : '0 8px 22px rgba(42, 65, 30, 0.05)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, letterSpacing: 2, color: '#697c5e', fontWeight: 600 }}>
                {isRevealed
                  ? '本场签位已揭晓 · 全桌共享'
                  : reel.phase === 'idle'
                  ? '等待确认抽取今日唯一签位'
                  : reel.phase === 'slowing'
                  ? '云端签位落定中...'
                  : '正在等概率轮换候选名单...'}
              </span>
              {!isRevealed && (
                <span
                  style={{
                    fontSize: 14,
                    padding: '4px 10px',
                    border: '1.5px solid #9db88a',
                    color: '#6b845b',
                    fontFamily: FONTS.serif,
                  }}
                >
                  {reel.phase === 'idle' ? '待抽签' : '抽签中'}
                </span>
              )}
            </div>

            {/* Reel Window */}
            <div
              style={{
                marginTop: 18,
                height: 112,
                borderRadius: 14,
                background: isRevealed ? 'rgba(255,255,255,0.68)' : '#edf2e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Scanning bar while drawing */}
              {!isRevealed && reel.phase !== 'idle' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: `${((frame * 8) % 140) - 40}%`,
                    width: '36%',
                    height: 4,
                    background: '#6e9756',
                    borderRadius: 4,
                  }}
                />
              )}

              <div
                style={{
                  fontFamily: FONTS.serif,
                  fontSize: isRevealed ? 48 : 42,
                  fontWeight: 700,
                  color: isRevealed ? THEME.brand : '#245b32',
                  letterSpacing: 5,
                  transform: isRevealed
                    ? `scale(${interpolate(revealSp, [0, 1], [0.85, 1])})`
                    : `translateY(${interpolate(Math.min(reel.stepAge, 5), [0, 5], [14, 0])}px)`,
                  opacity: isRevealed ? 1 : interpolate(Math.min(reel.stepAge, 4), [0, 4], [0.45, 1]),
                }}
              >
                {activeVenueName}
              </div>

              {/* Dramatic Vermilion Seal Stamp upon Reveal! */}
              <SealStamp
                lines={['已定', '此签']}
                triggerFrame={VENUE_STAMP_LOCAL_FRAME}
                size={80}
                rotation={-8}
                style={{
                  position: 'absolute',
                  right: 20,
                  top: 16,
                  background: 'rgba(255, 253, 248, 0.92)',
                }}
              />
            </div>

            <div
              style={{
                marginTop: 14,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13.5,
                color: '#727f67',
              }}
            >
              <span>全桌每日限抽 1 次 · 同一牌局日永久不可重抽</span>
              <span>{isRevealed ? '由 清风 抽取 · 已同步 4 人' : '5 家启用候选等概率抽取'}</span>
            </div>
          </div>

          {/* Candidate List with Live Running Highlight */}
          <div
            style={{
              marginTop: 18,
              borderRadius: 16,
              background: '#fffdf8',
              border: '1px solid #e1e2d7',
              padding: '14px 22px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {DEMO_VENUE.candidates.map((v, idx) => {
              const isRolling = !isRevealed && reel.activeIdx === idx
              const isWinner = isRevealed && idx === DEMO_VENUE.winnerIndex
              return (
                <div
                  key={v.no}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '11px 14px',
                    borderRadius: 10,
                    background: isWinner ? '#e6efe0' : isRolling ? '#f0f5ea' : 'transparent',
                    borderTop: idx > 0 ? '1px solid #eeeee4' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontFamily: FONTS.num, fontSize: 16, color: '#969e89' }}>{v.no}</span>
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: isWinner || isRolling ? 700 : 500,
                        color: isWinner ? THEME.brand : isRolling ? '#3c6e2f' : '#2d3f32',
                      }}
                    >
                      {v.name}
                    </span>
                  </div>
                  {isWinner ? (
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: THEME.vermilion,
                        background: 'rgba(167, 78, 58, 0.12)',
                        padding: '3px 12px',
                        borderRadius: 99,
                      }}
                    >
                      ★ 已中签
                    </span>
                  ) : isRolling ? (
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#6f9c54' }} />
                  ) : (
                    <span style={{ fontSize: 13, color: '#a0a695' }}>候选</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}
