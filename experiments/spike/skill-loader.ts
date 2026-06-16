import type {RawAgentUsage} from '@src/ai/types'

import * as fs from 'node:fs'
import path from 'node:path'

const DEFAULT_SKILL_PATH = path.join('src', 'ai', 'prompts', 'claude', 'EIVU_METADATA_SKILL_v7_16_4_RUNTIME.md')

let cached: null | string = null

/**
 * Loads the v7.16.4 monolithic skill file from disk and caches it.
 * Resolves relative to process.cwd() — the harness must be run from the repo root.
 */
export function loadBaselineSkill(): string {
  if (cached !== null) return cached
  const fullPath = path.join(process.cwd(), DEFAULT_SKILL_PATH)
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Baseline skill file not found: ${fullPath} — run the spike from the repo root.`)
  }

  cached = fs.readFileSync(fullPath, 'utf8')
  return cached
}

/** Sums multiple usage records, taking the max of latencies (parallel-equivalent timing). */
export function sumUsage(...usages: RawAgentUsage[]): RawAgentUsage {
  const acc: RawAgentUsage = {
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    inputTokens: 0,
    latencyMs: 0,
    outputTokens: 0,
    webSearchRequests: 0,
  }

  for (const u of usages) {
    acc.cacheCreationInputTokens += u.cacheCreationInputTokens
    acc.cacheReadInputTokens += u.cacheReadInputTokens
    acc.inputTokens += u.inputTokens
    acc.latencyMs = Math.max(acc.latencyMs, u.latencyMs)
    acc.outputTokens += u.outputTokens
    acc.webSearchRequests += u.webSearchRequests
  }

  return acc
}

/** Returns a zero-usage record for error cases. */
export function zeroUsage(): RawAgentUsage {
  return {
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    inputTokens: 0,
    latencyMs: 0,
    outputTokens: 0,
    webSearchRequests: 0,
  }
}
