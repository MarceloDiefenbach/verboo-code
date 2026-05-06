export interface StreamingMetrics {
  responseLength: number
  baselineLength: number
  firstTokenTime: number
  lastTokenTime: number
  isStreaming: boolean
}

export const streamingMetricsRef: { current: StreamingMetrics } = {
  current: {
    responseLength: 0,
    baselineLength: 0,
    firstTokenTime: 0,
    lastTokenTime: 0,
    isStreaming: false,
  },
}
