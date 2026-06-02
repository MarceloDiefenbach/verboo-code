import { describe, expect, it } from 'bun:test'
import { tokenCountWithEstimation } from './tokens.js'
import { IncrementalTokenCounter } from './incrementalTokenCounter.js'

describe('tokens', () => {
  it('counts the effective context window, including cached input tokens', () => {
    const messages = [
      {
        type: 'assistant',
        message: {
          id: 'msg_1',
          model: 'test-model',
          content: [{ type: 'text', text: 'ok' }],
          usage: {
            input_tokens: 200,
            output_tokens: 50,
            cache_read_input_tokens: 800,
            cache_creation_input_tokens: 25,
          },
        },
      },
    ] as any

    expect(tokenCountWithEstimation(messages)).toBe(1075)
  })

  it('adds an estimate for messages created after the last API response', () => {
    const messages = [
      {
        type: 'assistant',
        message: {
          id: 'msg_1',
          model: 'test-model',
          content: [{ type: 'text', text: 'ok' }],
          usage: {
            input_tokens: 200,
            output_tokens: 50,
            cache_read_input_tokens: 800,
            cache_creation_input_tokens: 25,
          },
        },
      },
      {
        type: 'user',
        message: {
          content: 'A new user message should move the context counter before the next API response.',
        },
      },
    ] as any

    expect(tokenCountWithEstimation(messages)).toBeGreaterThan(1075)
  })
})

describe('IncrementalTokenCounter', () => {
  it('uses cached count for same message length', () => {
    const counter = new IncrementalTokenCounter()
    
    counter.getCount([
      { type: 'user', message: { content: 'hello' } } as any,
    ])
    
    expect(counter.cachedCount).toBeGreaterThan(0)
  })

  it('increments for new messages', () => {
    const counter = new IncrementalTokenCounter()
    
    const count1 = counter.getCount([
      { type: 'user', message: { content: 'hello' } } as any,
    ])
    
    const count2 = counter.getCount([
      { type: 'user', message: { content: 'hello' } } as any,
      { type: 'user', message: { content: 'world' } } as any,
    ])
    
    expect(count2).toBeGreaterThan(count1)
  })

  it('resets correctly', () => {
    const counter = new IncrementalTokenCounter()
    
    counter.getCount([{ type: 'user', message: { content: 'hello' } } as any])
    counter.reset()
    
    expect(counter.cachedCount).toBe(0)
    expect(counter.messageCount).toBe(0)
  })
})
