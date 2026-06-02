import { formatDuration } from '../utils/format.js'

export type RouterRateLimitSnapshot = {
  limit: number
  remaining: number
  resetAt: number
  retryAfter?: number
}

export type RouterRateLimitDisplay = {
  availableRequests: number
  requestLabel: string
  resetLabel: string
  isResetReached: boolean
}

type Listener = () => void

let currentRouterRateLimit: RouterRateLimitSnapshot | null = null
const listeners = new Set<Listener>()

function parseHeaderInt(
  headers: globalThis.Headers,
  name: string,
): number | undefined {
  const raw = headers.get(name)
  if (raw === null) return undefined

  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function areSnapshotsEqual(
  left: RouterRateLimitSnapshot | null,
  right: RouterRateLimitSnapshot | null,
): boolean {
  if (left === right) return true
  if (!left || !right) return false

  return (
    left.limit === right.limit &&
    left.remaining === right.remaining &&
    left.resetAt === right.resetAt &&
    left.retryAfter === right.retryAfter
  )
}

function emit(next: RouterRateLimitSnapshot | null): void {
  if (areSnapshotsEqual(currentRouterRateLimit, next)) {
    return
  }

  currentRouterRateLimit = next
  for (const listener of listeners) {
    listener()
  }
}

function isModelsEndpoint(sourceUrl: string | undefined): boolean {
  if (!sourceUrl) return false

  try {
    const parsed = new URL(sourceUrl, 'http://localhost')
    const pathname = parsed.pathname.replace(/\/+$/, '')
    return pathname === '/models' || pathname.endsWith('/v1/models')
  } catch {
    return false
  }
}

export function getRouterRateLimitSnapshot(): RouterRateLimitSnapshot | null {
  return currentRouterRateLimit
}

export function subscribeRouterRateLimit(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function clearRouterRateLimit(): void {
  emit(null)
}

export function resetRouterRateLimitForTesting(): void {
  clearRouterRateLimit()
}

export function updateRouterRateLimitFromHeaders(
  headers: globalThis.Headers,
  opts: { sourceUrl?: string } = {},
): RouterRateLimitSnapshot | null {
  if (isModelsEndpoint(opts.sourceUrl)) {
    return currentRouterRateLimit
  }

  const limit = parseHeaderInt(headers, 'x-ratelimit-limit')
  const remaining = parseHeaderInt(headers, 'x-ratelimit-remaining')
  const resetAt = parseHeaderInt(headers, 'x-ratelimit-reset')
  const retryAfter = parseHeaderInt(headers, 'retry-after')

  if (
    limit === undefined ||
    remaining === undefined ||
    resetAt === undefined
  ) {
    clearRouterRateLimit()
    return currentRouterRateLimit
  }

  const next: RouterRateLimitSnapshot = {
    limit,
    remaining,
    resetAt,
    ...(retryAfter !== undefined ? { retryAfter } : {}),
  }

  emit(next)
  return currentRouterRateLimit
}

export function formatRouterRateLimitDisplay(
  snapshot: RouterRateLimitSnapshot,
  nowMs = Date.now(),
): RouterRateLimitDisplay {
  const resetAtMs = snapshot.resetAt * 1000
  const resetInMs = Math.max(0, resetAtMs - nowMs)
  const isResetReached = resetInMs === 0
  const availableRequests = isResetReached ? snapshot.limit : snapshot.remaining

  return {
    availableRequests,
    requestLabel:
      availableRequests === 1
        ? '1 request left'
        : `${availableRequests} requests left`,
    resetLabel: isResetReached
      ? 'resets now'
      : `resets in ${formatDuration(resetInMs, { hideTrailingZeros: true })}`,
    isResetReached,
  }
}
