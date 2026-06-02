import { afterEach, expect, test } from 'bun:test'
import {
  clearRouterRateLimit,
  formatRouterRateLimitDisplay,
  getRouterRateLimitSnapshot,
  resetRouterRateLimitForTesting,
  updateRouterRateLimitFromHeaders,
} from './routerRateLimit.js'

afterEach(() => {
  resetRouterRateLimitForTesting()
})

test('parses router rate limit headers into the shared snapshot', () => {
  updateRouterRateLimitFromHeaders(
    new Headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '12',
      'x-ratelimit-reset': '1700000060',
      'retry-after': '60',
    }),
  )

  expect(getRouterRateLimitSnapshot()).toEqual({
    limit: 60,
    remaining: 12,
    resetAt: 1700000060,
    retryAfter: 60,
  })
})

test('clears the shared snapshot when rate limit headers are missing or malformed', () => {
  updateRouterRateLimitFromHeaders(
    new Headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '12',
      'x-ratelimit-reset': '1700000060',
    }),
  )

  updateRouterRateLimitFromHeaders(
    new Headers({
      'x-ratelimit-limit': 'oops',
      'x-ratelimit-remaining': 'still-oops',
      'x-ratelimit-reset': 'nope',
    }),
  )

  expect(getRouterRateLimitSnapshot()).toBeNull()
})

test('ignores rate limit headers from model listing endpoints', () => {
  updateRouterRateLimitFromHeaders(
    new Headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '12',
      'x-ratelimit-reset': '1700000060',
    }),
    { sourceUrl: 'https://router.example/v1/chat/completions' },
  )

  updateRouterRateLimitFromHeaders(
    new Headers({
      'x-ratelimit-limit': '999',
      'x-ratelimit-remaining': '999',
      'x-ratelimit-reset': '1700000999',
    }),
    { sourceUrl: 'https://router.example/v1/models' },
  )

  expect(getRouterRateLimitSnapshot()).toEqual({
    limit: 60,
    remaining: 12,
    resetAt: 1700000060,
  })
})

test('does not initialize rate limit state from model listing endpoints', () => {
  updateRouterRateLimitFromHeaders(
    new Headers({
      'x-ratelimit-limit': '999',
      'x-ratelimit-remaining': '999',
      'x-ratelimit-reset': '1700000999',
    }),
    { sourceUrl: '/v1/models?cached=true' },
  )

  expect(getRouterRateLimitSnapshot()).toBeNull()
})

test('clears the shared snapshot when the active model changes', () => {
  updateRouterRateLimitFromHeaders(
    new Headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '12',
      'x-ratelimit-reset': '1700000060',
    }),
  )

  clearRouterRateLimit()

  expect(getRouterRateLimitSnapshot()).toBeNull()
})

test('formats the remaining requests and reset countdown', () => {
  const snapshot = {
    limit: 60,
    remaining: 12,
    resetAt: 1700000060,
  }

  expect(formatRouterRateLimitDisplay(snapshot, 1700000000000)).toEqual({
    availableRequests: 12,
    requestLabel: '12 requests left',
    resetLabel: 'resets in 1m',
    isResetReached: false,
  })
})

test('switches to full availability once the window has reset', () => {
  const snapshot = {
    limit: 60,
    remaining: 0,
    resetAt: 1700000060,
  }

  expect(formatRouterRateLimitDisplay(snapshot, 1700000060000)).toEqual({
    availableRequests: 60,
    requestLabel: '60 requests left',
    resetLabel: 'resets now',
    isResetReached: true,
  })
})
