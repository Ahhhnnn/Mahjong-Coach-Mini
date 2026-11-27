export default definePageConfig({
  ...(process.env.TARO_ENV === 'weapp' ? {
    usingComponents: { 'ec-canvas': '../../components/ec-canvas/ec-canvas' },
  } : {}),
  navigationBarTitleText: '四人牌桌',
  navigationBarBackgroundColor: '#1a5c2e',
  navigationBarTextStyle: 'white',
  backgroundColor: '#f5f5f0',
})
