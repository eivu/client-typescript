import type {RawAgentUsage} from '@src/ai/types'

/** USD cost breakdown for one API call. All values are billing-adjusted. */
export type Cost = {
  cachedInputUsd: number
  inputUsd: number
  outputUsd: number
  totalUsd: number
  webSearchUsd: number
}

/**
 * Posted Anthropic per-million-token rates (USD).
 * Cached input tokens bill at 10% of normal input rate.
 * Cache creation input tokens bill at 125% of normal input rate (one-time write cost).
 * Web search billed per request at $10/1000 = $0.01 per request.
 */
const PRICING = {
  'claude-haiku-4-5': {input: 1, output: 5},
  'claude-opus-4-6': {input: 15, output: 75},
  'claude-sonnet-4-6': {input: 3, output: 15},
} as const

const CACHE_READ_DISCOUNT = 0.1
const CACHE_WRITE_PREMIUM = 1.25
const WEB_SEARCH_USD_PER_REQUEST = 0.01

/**
 * Anthropic Messages Batches API discount. Applied to all token types
 * (input, output, cache read, cache write). Web search billing is NOT
 * discounted by batch mode per Anthropic's posted rates.
 */
const BATCHES_API_DISCOUNT = 0.5

/**
 * Empirical billing-adjustment factor.
 *
 * The posted-rate calculation (PRICING + CACHE_* + BATCHES_API_DISCOUNT) was
 * compared against the actual dashboard charge on 2026-05-21:
 *   - 208 requests across 20 batches today (full spike + smoke + ad-hoc)
 *   - 27.4M total tokens (195K uncached input + 8.8M cache write + 18M cache read + 393K output)
 *   - Posted-rate computation: $122.36
 *   - Anthropic dashboard actual: $2.72
 *   - Ratio: $2.72 / $122.36 = 0.0222
 *
 * The leading hypothesis for the gap: Anthropic reports cumulative tokens
 * across internal agentic-loop sub-turns (each web_search round-trip re-reads
 * the cached prefix and re-writes growing context), but does NOT bill all
 * those reported counts. Until we get an admin key to query usage_report
 * directly, all cost values surfaced to users multiply through this factor.
 */
const EMPIRICAL_BILLING_FACTOR = 0.0222

const ZERO_COST: Cost = {cachedInputUsd: 0, inputUsd: 0, outputUsd: 0, totalUsd: 0, webSearchUsd: 0}

function rateFor(model: string): {input: number; output: number} {
  const entry = (PRICING as Record<string, undefined | {input: number; output: number}>)[model]
  if (entry) return entry
  // Unknown model — fall back to Opus rates (most conservative for budgeting).
  return PRICING['claude-opus-4-6']
}

/**
 * Computes USD cost for one batch API call given the model and usage.
 * Returns billing-adjusted values via `EMPIRICAL_BILLING_FACTOR`. For raw
 * posted-rate cost (debugging), see `computeRawCost`.
 */
export function computeCost(model: string, usage: RawAgentUsage): Cost {
  const raw = computeRawCost(model, usage)
  return {
    cachedInputUsd: raw.cachedInputUsd * EMPIRICAL_BILLING_FACTOR,
    inputUsd: raw.inputUsd * EMPIRICAL_BILLING_FACTOR,
    outputUsd: raw.outputUsd * EMPIRICAL_BILLING_FACTOR,
    totalUsd: raw.totalUsd * EMPIRICAL_BILLING_FACTOR,
    webSearchUsd: raw.webSearchUsd * EMPIRICAL_BILLING_FACTOR,
  }
}

/**
 * Computes posted-rate cost (no empirical factor). Used by the spike for
 * billing-model debugging — diagnose the gap between computed and actual
 * billing. Production cost reporting should use `computeCost`.
 */
export function computeRawCost(model: string, usage: RawAgentUsage): Cost {
  const rate = rateFor(model)
  const inputUsd = (usage.inputTokens / 1_000_000) * rate.input * BATCHES_API_DISCOUNT
  const cacheReadUsd =
    (usage.cacheReadInputTokens / 1_000_000) * rate.input * CACHE_READ_DISCOUNT * BATCHES_API_DISCOUNT
  const cacheWriteUsd =
    (usage.cacheCreationInputTokens / 1_000_000) * rate.input * CACHE_WRITE_PREMIUM * BATCHES_API_DISCOUNT
  const cachedInputUsd = cacheReadUsd + cacheWriteUsd
  const outputUsd = (usage.outputTokens / 1_000_000) * rate.output * BATCHES_API_DISCOUNT
  const webSearchUsd = usage.webSearchRequests * WEB_SEARCH_USD_PER_REQUEST

  return {
    cachedInputUsd,
    inputUsd,
    outputUsd,
    totalUsd: inputUsd + cachedInputUsd + outputUsd + webSearchUsd,
    webSearchUsd,
  }
}

/** Sums multiple cost lines for aggregate reporting. */
export function sumCosts(costs: Cost[]): Cost {
  const acc: Cost = {...ZERO_COST}
  for (const c of costs) {
    acc.cachedInputUsd += c.cachedInputUsd
    acc.inputUsd += c.inputUsd
    acc.outputUsd += c.outputUsd
    acc.totalUsd += c.totalUsd
    acc.webSearchUsd += c.webSearchUsd
  }

  return acc
}

/** Empty zero-cost line. Used when a run errors before any API call completes. */
export function zeroCost(): Cost {
  return {...ZERO_COST}
}
