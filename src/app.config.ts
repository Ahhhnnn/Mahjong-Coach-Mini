export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/puzzles/index',
    'pages/records/index',
    'pages/report/index',
    'pages/profile/index',
  ],
  subPackages: [
    {
      root: 'pages/basic',
      pages: ['index'],
    },
    {
      root: 'pages/train',
      pages: ['index'],
    },
    {
      root: 'pages/guess',
      pages: ['index'],
    },
    {
      root: 'pages/mistakes',
      pages: ['index'],
    },
    {
      root: 'pages/favorites',
      pages: ['index'],
    },
    {
      root: 'pages/record-edit',
      pages: ['index'],
    },
    {
      root: 'pages/mystic',
      pages: ['index'],
    },
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'Mahjong Coach',
    navigationBarTextStyle: 'black',
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#1a5c2e',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/icons/home.png',
        selectedIconPath: 'assets/icons/home-active.png',
      },
      {
        pagePath: 'pages/puzzles/index',
        text: '训练',
        iconPath: 'assets/icons/train.png',
        selectedIconPath: 'assets/icons/train-active.png',
      },
      {
        pagePath: 'pages/records/index',
        text: '牌局',
        iconPath: 'assets/icons/records.png',
        selectedIconPath: 'assets/icons/records-active.png',
      },
      {
        pagePath: 'pages/report/index',
        text: '成长',
        iconPath: 'assets/icons/chart.png',
        selectedIconPath: 'assets/icons/chart-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/icons/user.png',
        selectedIconPath: 'assets/icons/user-active.png',
      },
    ],
  },
})
