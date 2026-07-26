module.exports = {
  presets: [
    ['taro', {
      framework: 'react',
      ts: true,
    }],
  ],
  plugins: [
    [
      'import',
      {
        libraryName: '@taroify/core',
        libraryDirectory: '',
        style: true,
      },
      '@taroify/core',
    ],
    [
      'import',
      {
        libraryName: '@taroify/icons',
        libraryDirectory: '',
        camel2DashComponentName: false,
        style: () => '@taroify/icons/style',
        customName: (name) =>
          name === 'Icon' ? '@taroify/icons/van/VanIcon' : `@taroify/icons/${name}`,
      },
      '@taroify/icons',
    ],
  ],
}
