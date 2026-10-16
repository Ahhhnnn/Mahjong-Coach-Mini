/// <reference types="@tarojs/taro" />

declare module '*.png'
declare module '*.gif'
declare module '*.jpg'
declare module '*.jpeg'
declare module '*.svg'
declare module '*.css'
declare module '*.scss'
declare module '*.sass'
declare module '*.less'
declare module '*.styl'

declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: 'development' | 'production'
    readonly TARO_ENV: 'weapp' | 'h5'
  }
}

// 微信原生组件，仅由 weapp 图表适配层使用。
declare namespace JSX {
  interface IntrinsicElements {
    'ec-canvas': { id: string; 'canvas-id': string; ec: { lazyLoad: boolean }; style?: import('react').CSSProperties }
  }
}
