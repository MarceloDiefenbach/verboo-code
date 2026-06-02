import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  formatRouterRateLimitDisplay,
  getRouterRateLimitSnapshot,
  subscribeRouterRateLimit,
  type RouterRateLimitDisplay,
} from './routerRateLimit.js'

export function useRouterRateLimitDisplay(): RouterRateLimitDisplay | null {
  const snapshot = useSyncExternalStore(
    subscribeRouterRateLimit,
    getRouterRateLimitSnapshot,
    getRouterRateLimitSnapshot,
  )
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!snapshot) return

    const tick = () => {
      setNowMs(Date.now())
    }

    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [snapshot?.limit, snapshot?.remaining, snapshot?.resetAt, snapshot?.retryAfter])

  if (!snapshot) {
    return null
  }

  return formatRouterRateLimitDisplay(snapshot, nowMs)
}
