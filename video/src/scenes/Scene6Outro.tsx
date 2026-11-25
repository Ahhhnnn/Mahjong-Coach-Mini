import React from 'react'
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { BackgroundCanvas } from '../components/BackgroundCanvas'
import { MahjongTile } from '../components/MahjongTile'
import { SealStamp } from '../components/SealStamp'
import { FONTS, SPRING_GENTLE, SPRING_SNAPPY, THEME } from '../theme'

const TABS = [
  { icon: 'assets/icons/home-active.png', label: '首页概览' },
  { icon: 'assets/icons/train-active.png', label: '拆搭题库' },
  { icon: 'assets/icons/records-active.png', label: '共享牌局' },
  { icon: 'assets/icons/chart-active.png', label: '成长雷达' },
  { icon: 'assets/icons/user-active.png', label: '我的服务' },
]

const TECH_TAGS = [
  'Taro 4.2',
  'React 18 + TS',
  'ECharts 5.6',
  '微信云开发',
  'Multi-LLM AI 教练',
  '微信小程序 & H5 双端',
]

export const Scene6Outro: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const centerSp = spring({ frame: Math.max(0, frame - 28), fps, config: SPRING_GENTLE })
  const sloganSp = spring({ frame: Math.max(0, frame - 88), fps, config: SPRING_GENTLE })
  const fadeOut = interpolate(frame, [388, 434], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ fontFamily: FONTS.sans, opacity: fadeOut }}>
      <BackgroundCanvas variant="bamboo" />

      {/* Decorative flanking tiles */}
      <div style={{ position: 'absolute', left: 96, top: 280, opacity: 0.24, transform: 'rotate(-14deg)' }}>
        <MahjongTile tile="1s" width={92} />
      </div>
      <div style={{ position: 'absolute', left: 162, top: 380, opacity: 0.18, transform: 'rotate(-6deg)' }}>
        <MahjongTile tile="8p" width={84} />
      </div>
      <div style={{ position: 'absolute', right: 96, top: 270, opacity: 0.24, transform: 'rotate(14deg)' }}>
        <MahjongTile tile="6s" width={92} />
      </div>
      <div style={{ position: 'absolute', right: 162, top: 380, opacity: 0.18, transform: 'rotate(6deg)' }}>
        <MahjongTile tile="4p" width={84} />
      </div>

      <div
        style={{
          position: 'absolute',
          inset: '78px 96px 118px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Top Row: 5 Mini-Program TabBar Modules */}
        <div style={{ display: 'flex', gap: 28 }}>
          {TABS.map((t, idx) => {
            const sp = spring({ frame: Math.max(0, frame - (12 + idx * 10)), fps, config: SPRING_SNAPPY })
            return (
              <div
                key={t.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  transform: `translateY(${interpolate(sp, [0, 1], [-28, 0])}px)`,
                  opacity: interpolate(sp, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
                }}
              >
                <div
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 20,
                    background: 'rgba(255, 255, 255, 0.94)',
                    border: `2px solid ${THEME.gold}`,
                    boxShadow: '0 12px 26px rgba(0, 0, 0, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Img src={staticFile(t.icon)} style={{ width: 38, height: 38, objectFit: 'contain' }} />
                </div>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(245,245,240,0.9)' }}>{t.label}</span>
              </div>
            )
          })}
        </div>

        {/* Center Brand Finale */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transform: `scale(${interpolate(centerSp, [0, 1], [0.88, 1])})`,
            opacity: interpolate(centerSp, [0, 0.45], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          <div
            style={{
              width: 136,
              height: 136,
              borderRadius: '50%',
              background: 'linear-gradient(145deg, #ffffff, #f2eee2)',
              border: `3.5px solid ${THEME.gold}`,
              boxShadow: '0 22px 54px rgba(0,0,0,0.45), 0 0 48px rgba(237,199,121,0.34)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              marginBottom: 26,
            }}
          >
            <Img src={staticFile('assets/mascot/panda.png')} style={{ width: 112, height: 112, objectFit: 'contain' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <span
              style={{
                fontFamily: FONTS.serif,
                fontSize: 96,
                fontWeight: 700,
                color: '#fffef8',
                letterSpacing: 14,
                textShadow: '0 10px 30px rgba(0,0,0,0.42)',
              }}
            >
              麻将教练
            </span>
            <SealStamp
              lines={['川麻', '神器']}
              triggerFrame={124}
              size={78}
              rotation={-6}
              style={{ background: 'rgba(252, 249, 241, 0.94)' }}
            />
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 8,
              color: THEME.goldBright,
            }}
          >
            MAHJONG COACH
          </div>

          {/* Poetic 4-Part Closing Slogan */}
          <div
            style={{
              marginTop: 32,
              padding: '16px 40px',
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(237, 199, 121, 0.42)',
              fontFamily: FONTS.serif,
              fontSize: 34,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: 6,
              opacity: interpolate(sloganSp, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
              transform: `translateY(${interpolate(sloganSp, [0, 1], [24, 0])}px)`,
            }}
          >
            练牌效 · 记风云 · 算玄学 · 定去处
          </div>
        </div>

        {/* Bottom Full-Stack Tech Badges */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          {TECH_TAGS.map((tag, idx) => {
            const tOp = interpolate(frame, [130 + idx * 10, 150 + idx * 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
            return (
              <span
                key={tag}
                style={{
                  padding: '9px 20px',
                  borderRadius: 999,
                  background: 'rgba(8, 28, 15, 0.65)',
                  border: '1px solid rgba(86, 201, 160, 0.38)',
                  color: '#d8f3e6',
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: 0.6,
                  opacity: tOp,
                }}
              >
                {tag}
              </span>
            )
          })}
        </div>
      </div>
    </AbsoluteFill>
  )
}
