import { PropsWithChildren } from 'react'

import { initCloud } from './core/cloud'

import './app.scss'

function App({ children }: PropsWithChildren) {
  initCloud()
  return children
}

export default App
