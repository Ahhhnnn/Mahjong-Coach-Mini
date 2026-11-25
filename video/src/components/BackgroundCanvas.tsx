import React, { useId } from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { THEME } from '../theme'

interface BackgroundCanvasProps {
  variant?: 'bamboo' | 'paper'
}

export const BackgroundCanvas: React.FC<BackgroundCanvasProps> = ({ variant = 'bamboo' }) => {
  const uid = useId().replace(/:/g, '')
  const paperGridId = `paperGrid-${uid}`
  const feltGridId = `feltGrid-${uid}`
  const frame = useCurrentFrame()
  const driftX = Math.sin(frame / 140) * 18
  const driftY = Math.cos(frame / 110) * 14

  if (variant === 'paper') {
    return (
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 25% 20%, #faf6ec 0%, ${THEME.paperAntique} 55%, #eae1cf 100%)`,
          overflow: 'hidden',
        }}
      >
        {/* Subtle antique lattice grid */}
        <svg
          width="1920"
          height="1080"
          style={{ position: 'absolute', inset: 0, opacity: 0.22 }}
        >
          <defs>
            <pattern id={paperGridId} width="72" height="72" patternUnits="userSpaceOnUse">
              <path
                d="M 72 0 L 0 0 0 72"
                fill="none"
                stroke="#c7bda6"
                strokeWidth="0.8"
              />
            </pattern>
          </defs>
          <rect width="1920" height="1080" fill={`url(#${paperGridId})`} />
        </svg>

        {/* Soft warm light halo */}
        <div
          style={{
            position: 'absolute',
            left: 120 + driftX,
            top: -120 + driftY,
            width: 820,
            height: 820,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(26,92,46,0.06) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: -80 - driftX,
            bottom: -140 - driftY,
            width: 780,
            height: 780,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(167,78,58,0.07) 0%, transparent 70%)',
          }}
        />

        {/* Delicate traditional frame corners */}
        <div
          style={{
            position: 'absolute',
            inset: 28,
            border: '1px solid rgba(173, 159, 130, 0.35)',
            borderRadius: 18,
            pointerEvents: 'none',
          }}
        />
      </AbsoluteFill>
    )
  }

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 85% 75% at 50% 38%, #1e6b37 0%, #124221 52%, ${THEME.brandDarkest} 100%)`,
        overflow: 'hidden',
      }}
    >
      {/* Subtle Mahjong table felt pattern */}
      <svg
        width="1920"
        height="1080"
        style={{ position: 'absolute', inset: 0, opacity: 0.14 }}
      >
        <defs>
          <pattern id={feltGridId} width="64" height="64" patternUnits="userSpaceOnUse">
            <path
              d="M 64 0 L 0 0 0 64"
              fill="none"
              stroke="#8ce0b3"
              strokeWidth="0.65"
            />
            <circle cx="0" cy="0" r="1.4" fill="#edc779" opacity="0.55" />
          </pattern>
        </defs>
        <rect width="1920" height="1080" fill={`url(#${feltGridId})`} />
      </svg>

      {/* Ambient jade & gold glow orbs */}
      <div
        style={{
          position: 'absolute',
          left: -140 + driftX * 1.4,
          top: -160 + driftY,
          width: 900,
          height: 900,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(86, 201, 160, 0.16) 0%, transparent 66%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -120 - driftX,
          bottom: -220 - driftY,
          width: 960,
          height: 960,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(237, 199, 121, 0.13) 0%, transparent 68%)',
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 50%, transparent 52%, rgba(4, 15, 8, 0.56) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Hairline gold inner border */}
      <div
        style={{
          position: 'absolute',
          inset: 26,
          border: '1px solid rgba(237, 199, 121, 0.16)',
          borderRadius: 18,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  )
}
