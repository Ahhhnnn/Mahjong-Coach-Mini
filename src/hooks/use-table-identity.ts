import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { ensureLogin } from '../core/auth'
import { getTableIdentity, IDENTITY_CHANGED, identityScope } from '../core/table-identity-service'

export function useTableIdentity() {
  const [identity, setIdentity] = useState(getTableIdentity)
  const [scope, setScope] = useState(identityScope)
  useEffect(() => {
    const update = () => { setIdentity(getTableIdentity()); setScope(identityScope()) }
    Taro.eventCenter.on(IDENTITY_CHANGED, update)
    return () => { Taro.eventCenter.off(IDENTITY_CHANGED, update) }
  }, [])
  useDidShow(() => {
    setIdentity(getTableIdentity())
    setScope(identityScope())
    void ensureLogin().then(() => { setIdentity(getTableIdentity()); setScope(identityScope()) })
  })
  return { identity, scope }
}
