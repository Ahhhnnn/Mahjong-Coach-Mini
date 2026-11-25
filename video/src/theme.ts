export const THEME = {
  brand: '#1a5c2e',
  brandMid: '#23753c',
  brandDeep: '#0d3219',
  brandDarkest: '#071c0e',
  jade: '#56c9a0',
  gold: '#edc779',
  goldBright: '#f8df9c',
  vermilion: '#a74e3a',
  vermilionBright: '#c95c44',
  paper: '#f5f5f0',
  paperAntique: '#f5f0e5',
  paperCard: '#fcf9f1',
  ink: '#1f3326',
  inkMuted: '#6f7363',
  sky: '#78b8ef',
  violet: '#ba9af4',
  white: '#ffffff',
} as const

export const FONTS = {
  serif: "'Songti SC', 'STSong', 'Noto Serif SC', 'Source Han Serif SC', Georgia, serif",
  sans: "'PingFang SC', 'Hiragino Sans GB', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  num: "Georgia, 'DIN Alternate', 'SF Pro Display', serif",
} as const

export const SPRING_SNAPPY = {
  damping: 16,
  stiffness: 180,
  mass: 0.75,
}

export const SPRING_GENTLE = {
  damping: 20,
  stiffness: 110,
  mass: 0.9,
}

export const SPRING_STAMP = {
  damping: 12,
  stiffness: 260,
  mass: 0.7,
}
