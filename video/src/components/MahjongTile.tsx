import React from 'react'
import { Img, staticFile } from 'remotion'
import { THEME } from '../theme'

interface MahjongTileProps {
  tile: string // e.g. '1p', '9s', 'back'
  width?: number
  highlighted?: boolean
  dimmed?: boolean
  badge?: string
  style?: React.CSSProperties
}

export const MahjongTile: React.FC<MahjongTileProps> = ({
  tile,
  width = 76,
  highlighted = false,
  dimmed = false,
  badge,
  style,
}) => {
  const height = Math.round(width * 1.38)
  const radius = Math.max(7, Math.round(width * 0.13))
  const depth = Math.max(5, Math.round(width * 0.1))

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(180deg, #ffffff 0%, #f7f6ee 88%, #e8e5d8 100%)',
        boxShadow: highlighted
          ? `0 ${depth}px 0 #1f7a3f, 0 ${depth + 14}px 28px rgba(0, 0, 0, 0.45), 0 0 0 3px ${THEME.gold}`
          : `0 ${depth}px 0 #1d5d33, 0 ${depth + 8}px 18px rgba(0, 0, 0, 0.34)`,
        border: highlighted
          ? `1.5px solid ${THEME.goldBright}`
          : '1px solid rgba(255, 255, 255, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        opacity: dimmed ? 0.45 : 1,
        ...style,
      }}
    >
      <Img
        src={staticFile(`assets/tiles/${tile}.png`)}
        style={{
          width: '88%',
          height: '88%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
      {badge && (
        <div
          style={{
            position: 'absolute',
            top: -14,
            left: '50%',
            transform: 'translateX(-50%)',
            background: THEME.vermilion,
            color: '#fff',
            fontSize: Math.max(12, Math.round(width * 0.19)),
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 10px rgba(0,0,0,0.35)',
          }}
        >
          {badge}
        </div>
      )}
    </div>
  )
}
