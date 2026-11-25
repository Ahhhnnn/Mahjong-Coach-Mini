import React from 'react'
import { interpolate, useCurrentFrame } from 'remotion'
import { SUBTITLE_CUES } from '../data/demoData'
import { FONTS, THEME } from '../theme'

export const SubtitleBar: React.FC = () => {
  const frame = useCurrentFrame()
  const cue = SUBTITLE_CUES.find((c) => frame >= c.from && frame <= c.to)
  if (!cue) return null

  const fadeIn = interpolate(frame, [cue.from, cue.from + 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const fadeOut = interpolate(frame, [cue.to - 14, cue.to], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const opacity = Math.min(fadeIn, fadeOut)
  const translateY = interpolate(fadeIn, [0, 1], [14, 0])

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 34,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 50,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 26px 12px 16px',
          borderRadius: 999,
          background: 'rgba(10, 27, 16, 0.92)',
          border: '1px solid rgba(237, 199, 121, 0.36)',
          boxShadow: '0 14px 36px rgba(0, 0, 0, 0.36)',
          fontFamily: FONTS.sans,
        }}
      >
        <span
          style={{
            padding: '5px 14px',
            borderRadius: 999,
            background: `linear-gradient(135deg, ${THEME.brandMid}, ${THEME.brand})`,
            border: '1px solid rgba(86, 201, 160, 0.45)',
            color: THEME.goldBright,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 1.2,
          }}
        >
          {cue.tag}
        </span>
        <span
          style={{
            color: '#f7f7f2',
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: 0.6,
          }}
        >
          {cue.text}
        </span>
      </div>
    </div>
  )
}
