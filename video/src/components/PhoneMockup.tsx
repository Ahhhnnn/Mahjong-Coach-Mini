import React from 'react'
import { FONTS } from '../theme'

interface PhoneMockupProps {
  width?: number
  height?: number
  title?: string
  bgColor?: string
  children: React.ReactNode
  style?: React.CSSProperties
}

export const PhoneMockup: React.FC<PhoneMockupProps> = ({
  width = 430,
  height = 800,
  title = 'Mahjong Coach',
  bgColor = '#f5f5f0',
  children,
  style,
}) => {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 50,
        padding: 13,
        background: 'linear-gradient(145deg, #2d3831 0%, #101712 52%, #1d2821 100%)',
        boxShadow:
          '0 34px 74px rgba(0, 0, 0, 0.52), 0 0 0 1.5px rgba(237, 199, 121, 0.28), inset 0 1px 2px rgba(255,255,255,0.22)',
        position: 'relative',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Screen viewport */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 38,
          backgroundColor: bgColor,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          fontFamily: FONTS.sans,
        }}
      >
        {/* Status bar + Dynamic Island */}
        <div
          style={{
            height: 44,
            padding: '10px 24px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1b2b20' }}>20:26</span>
          <div
            style={{
              width: 96,
              height: 24,
              borderRadius: 999,
              backgroundColor: '#101411',
              position: 'absolute',
              left: '50%',
              top: 10,
              transform: 'translateX(-50%)',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 14, height: 9, borderRadius: 2, border: '1.5px solid #1b2b20', padding: 1 }}>
              <div style={{ width: '80%', height: '100%', backgroundColor: '#1a5c2e', borderRadius: 1 }} />
            </div>
          </div>
        </div>

        {/* Mini-program Nav Bar */}
        <div
          style={{
            height: 44,
            padding: '0 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid rgba(0,0,0,0.05)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1e2c22' }}>{title}</span>
          {/* WeChat capsule pill */}
          <div
            style={{
              height: 26,
              padding: '0 10px',
              borderRadius: 999,
              border: '1px solid rgba(0,0,0,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'rgba(255,255,255,0.85)',
            }}
          >
            <span style={{ fontSize: 13, letterSpacing: 1, color: '#111', fontWeight: 700 }}>•••</span>
            <div style={{ width: 1, height: 12, backgroundColor: 'rgba(0,0,0,0.14)' }} />
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                border: '2px solid #111',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: '#111' }} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>{children}</div>
      </div>
    </div>
  )
}
