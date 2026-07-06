import {describe, expect, it} from '@jest/globals'

import type {RawAgentUsage} from '../src/ai/types'

import {computeCost} from '../src/ai/cost'

// Token-only usage (no web searches, which are never batch-discounted) so the
// batch vs. full-rate difference is a clean 2×.
const usage: RawAgentUsage = {
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
  inputTokens: 1_000_000,
  latencyMs: 0,
  outputTokens: 1_000_000,
  webSearchRequests: 0,
}

describe('computeCost batch discount', () => {
  it('defaults to the batch-discounted rate', () => {
    expect(computeCost('claude-opus-4-6', usage).totalUsd).toBeCloseTo(
      computeCost('claude-opus-4-6', usage, {batch: true}).totalUsd,
    )
  })

  it('bills synchronous (non-batch) calls at 2× the batch rate', () => {
    const batch = computeCost('claude-opus-4-6', usage, {batch: true}).totalUsd
    const sync = computeCost('claude-opus-4-6', usage, {batch: false}).totalUsd
    expect(sync).toBeCloseTo(batch * 2)
  })
})
