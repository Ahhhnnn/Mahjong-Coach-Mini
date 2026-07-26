import { PropsWithChildren } from 'react'

import { initCloud } from './core/cloud'
import { ensureLogin } from './core/auth'

import '@taroify/icons/index.scss'
import '@taroify/core/button/style'
import '@taroify/core/cell/style'
import '@taroify/core/grid/style'
import '@taroify/core/badge/style'
import './app.scss'

function App({ children }: PropsWithChildren) {
  initCloud()
  // 静默登录：用户无感知，自动获取 openid 关联身份
  // 失败不阻塞（降级为本地模式），后续关键节点再引导
  ensureLogin()
  return children
}

export default App
