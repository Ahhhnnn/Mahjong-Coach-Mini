import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { FONTS, SPRING_STAMP, THEME } from '../theme'

interface SealStampProps {
  lines: [string, string]
  triggerFrame?: number
  size?: number
  rotation?: number
  style?: React.CSSProperties
}

export const SealStamp: React.FC<SealStampProps> = ({
  lines,
  triggerFrame = 0,
  size = 86,
  rotation = -6,
  style,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const local = Math.max(0, frame - triggerFrame)

  const progress = spring({
    frame: local,
    fps,
    config: SPRING_STAMP,
  })

  if (frame < triggerFrame) return null

  const scale = interpolate(progress, [0, 1], [2.15, 1])
  const rot = interpolate(progress, [0, 1], [rotation - 16, rotation])
  const opacity = interpolate(local, [0, 5], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        border: `3.5px double ${THEME.vermilion}`,
        background: 'rgba(167, 78, 58, 0.08)',
        color: THEME.vermilion,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONTS.serif,
        fontWeight: 800,
        fontSize: Math.round(size * 0.31),
        lineHeight: 1.15,
        letterSpacing: 4,
        paddingLeft: 4,
        boxSizing: 'border-box',
        transform: `scale(${scale}) rotate(${rot}deg)`,
        opacity,
        boxShadow: '0 6px 18px rgba(167, 78, 58, 0.22)',
        ...style,
      }}
    >
      <span>{lines[0]}</span>
      <span>{lines[1]}</span>
    </div>
  )
}
