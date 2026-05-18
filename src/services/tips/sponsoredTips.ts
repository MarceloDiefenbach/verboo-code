import type { Tip } from './types.js'

export function sponsoredTipsEnabled(): boolean {
  return false
}

export function getSponsoredTipsFrequency(): number {
  return 0
}

export const sponsoredTips: Tip[] = []
