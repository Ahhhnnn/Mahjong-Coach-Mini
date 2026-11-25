import React from 'react'
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { BackgroundCanvas } from '../components/BackgroundCanvas'
import { MahjongTile } from '../components/MahjongTile'
import { SealStamp } from '../components/SealStamp'
import { FONTS, SPRING_GENTLE, SPRING_SNAPPY, THEME } from '../theme'

const FAN_TILES = ['1p', '2p', '3p', '5p', '8p', '1s', '4s', '7s', '9s']
const PILLARS = [
  { icon: '01', title: '拆搭算法', sub: '向听 · 进张秒算' },
  { icon: '02', title: '双人设 AI', sub: '温和 · 犀利陪练' },
  { icon: '03', title: '四人风云', sub: '共享牌局 · 14 枚荣誉' },
  { icon: '04', title: '玄学定签', sub: '克星福地 · 抽签选店' },
]

export const Scene1Intro: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const heroSpring = spring({ frame: Math.max(0, frame - 42), fps, config: SPRING_GENTLE })
  const titleY = interpolate(heroSpring, [0, 1], [44, 0])
  const titleOpacity = interpolate(frame, [42, 72], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const subOpacity = interpolate(frame, [88, 118], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const subY = interpolate(frame, [88, 118], [18, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const pandaSpring = spring({ frame: Math.max(0, frame - 32), fps, config: SPRING_SNAPPY })
  const pandaFloat = Math.sin(frame / 28) * 5

  return (
    <AbsoluteFill style={{ fontFamily: FONTS.sans }}>
      <BackgroundCanvas variant="bamboo" />

      {/* Top curved fan of authentic Sichuan Mahjong tiles */}
      <div
        style={{
          position: 'absolute',
          top: 96,
          left: 0,
          right: 0,
          height: 230,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {FAN_TILES.map((tile, idx) => {
          const offset = idx - 4 // -4..4
          const delay = 8 + idx * 5
          const sp = spring({ frame: Math.max(0, frame - delay), fps, config: SPRING_SNAPPY })
          const yArc = offset * offset * 5.2
          const rot = offset * 5.8
          const xPos = offset * 96
          const enterY = interpolate(sp, [0, 1], [-180, 0])
          const enterScale = interpolate(sp, [0, 1], [0.7, 1])
          const gentleBob = Math.sin((frame + idx * 14) / 36) * 3.5

          return (
            <div
              key={tile}
              style={{
                position: 'absolute',
                transform: `translate(${xPos}px, ${yArc + enterY + gentleBob}px) rotate(${rot}deg) scale(${enterScale})`,
                opacity: interpolate(sp, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' }),
                zIndex: 10 - Math.abs(offset),
              }}
            >
              <MahjongTile tile={tile} width={88} highlighted={idx === 4} />
            </div>
          )
        })}
      </div>

      {/* Central brand identity lockup */}
      <div
        style={{
          position: 'absolute',
          top: 345,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Panda Mascot Medallion */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            transform: `translateY(${titleY}px)`,
            opacity: titleOpacity,
          }}
        >
          <div
            style={{
              width: 118,
              height: 118,
              borderRadius: '50%',
              background: 'linear-gradient(145deg, rgba(255,255,255,0.96), rgba(242,238,225,0.92))',
              border: `3px solid ${THEME.gold}`,
              boxShadow: '0 18px 42px rgba(0,0,0,0.42), 0 0 36px rgba(237,199,121,0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              transform: `scale(${interpolate(pandaSpring, [0, 1], [0.5, 1])}) translateY(${pandaFloat}px)`,
            }}
          >
            <Img
              src={staticFile('assets/mascot/panda.png')}
              style={{ width: 96, height: 96, objectFit: 'contain' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
              <span
                style={{
                  fontFamily: FONTS.serif,
                  fontSize: 108,
                  fontWeight: 700,
                  color: '#fffef8',
                  letterSpacing: 14,
                  lineHeight: 1.08,
                  textShadow: '0 10px 32px rgba(0, 0, 0, 0.45)',
                }}
              >
                麻将教练
              </span>
              <SealStamp
                lines={['川麻', '精研']}
                triggerFrame={126}
                size={84}
                rotation={-7}
                style={{ background: 'rgba(252, 249, 241, 0.92)' }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginTop: 8,
                opacity: subOpacity,
                transform: `translateY(${subY}px)`,
              }}
            >
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: 7,
                  color: THEME.goldBright,
                  textTransform: 'uppercase',
                }}
              >
                MAHJONG COACH
              </span>
              <div style={{ width: 46, height: 1.5, background: 'rgba(237,199,121,0.55)' }} />
              <span style={{ fontSize: 24, color: 'rgba(245, 245, 240, 0.88)', letterSpacing: 2 }}>
                四川麻将拆搭训练 · 牌桌生态小程序
              </span>
            </div>
          </div>
        </div>

        {/* 4 Pillar Cards */}
        <div
          style={{
            marginTop: 72,
            display: 'flex',
            gap: 24,
          }}
        >
          {PILLARS.map((item, i) => {
            const delay = 152 + i * 14
            const sp = spring({ frame: Math.max(0, frame - delay), fps, config: SPRING_SNAPPY })
            const op = interpolate(frame, [delay, delay + 16], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
            return (
              <div
                key={item.icon}
                style={{
                  width: 300,
                  padding: '22px 26px',
                  borderRadius: 18,
                  background: 'rgba(13, 44, 24, 0.72)',
                  border: '1px solid rgba(237, 199, 121, 0.25)',
                  boxShadow: '0 16px 32px rgba(0, 0, 0, 0.24)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  opacity: op,
                  transform: `translateY(${interpolate(sp, [0, 1], [36, 0])}px)`,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(237,199,121,0.25), rgba(86,201,160,0.22))',
                    border: '1px solid rgba(237,199,121,0.42)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: FONTS.num,
                    fontSize: 21,
                    fontWeight: 700,
                    color: THEME.goldBright,
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 23, fontWeight: 700, color: '#ffffff', letterSpacing: 1 }}>
                    {item.title}
                  </span>
                  <span style={{ fontSize: 16, color: 'rgba(232, 245, 236, 0.78)' }}>
                    {item.sub}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </AbsoluteFill>
  )
}
