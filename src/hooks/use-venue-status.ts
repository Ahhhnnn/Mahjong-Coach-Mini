import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { fetchVenueStatus, VENUES_CHANGED, type VenueStatus } from '../core/venue-service'
import { identityScope } from '../core/table-identity-service'

export function useVenueStatus(scope: string, targetDate?: string) {
  const [stored, setStored] = useState<{ scope: string; targetDate?: string; status: VenueStatus }>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const sequence = useRef(0)
  const refresh = useCallback(async () => {
    if (!scope || identityScope() !== scope) return
    const id = ++sequence.current
    setLoading(true)
    setError('')
    try {
      const status = await fetchVenueStatus(targetDate)
      if (id === sequence.current && identityScope() === scope) setStored({ scope, targetDate, status })
    } catch (e) {
      if (id === sequence.current && identityScope() === scope) setError(e instanceof Error ? e.message : '加载失败，请重试')
    } finally { if (id === sequence.current) setLoading(false) }
  }, [scope, targetDate])
  useEffect(() => {
    setError('')
    void refresh()
    const update = () => { void refresh() }
    Taro.eventCenter.on(VENUES_CHANGED, update)
    return () => { sequence.current++; Taro.eventCenter.off(VENUES_CHANGED, update) }
  }, [refresh])
  useDidShow(() => { void refresh() })
  return {
    status: stored?.scope === scope && stored.targetDate === targetDate ? stored.status : undefined,
    calendar: stored?.scope === scope ? { today: stored.status.today, maxDate: stored.status.maxDate } : undefined,
    loading, error, refresh,
  }
}
