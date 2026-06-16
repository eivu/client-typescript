import type {Cost as SpikeCost} from '@src/ai/cost.js'
import type {RawAgentUsage} from '@src/ai/types'

// eslint-disable-next-line unicorn/prefer-export-from -- SpikeCost is used locally below in SpikeRun, so we need a local import alias; the re-export is for consumers who don't want to know about @src/ai/cost.js
export type {SpikeCost}

/** Status of one run of one variant against one fixture. */
export type SpikeStatus = 'model_error' | 'parse_failure' | 'success' | 'validation_failure'

/** A single run of (variant × fixture × rerun-index). */
export type SpikeRun = {
  cost: SpikeCost
  errorMessage: null | string
  fixture: string
  /** Multi-sample variant only: per-sample ratings before median. */
  perSampleRatings?: Array<null | number>
  rating: null | number
  rawText: null | string
  /** Cumulative usage across all API calls in this run (variant 3 = 2 calls; variant 4 = 3 calls). */
  reasoning: null | string
  rerun: number
  status: SpikeStatus
  usage: RawAgentUsage
  variant: string
}

/** Tier label for fixture organization. Descriptive only — not used in scoring. */
export type FixtureTier = 'award-winner' | 'mid-tier' | 'obscure'

/** One fixture entry. */
export type Fixture = {
  category: 'audio' | 'comic' | 'video'
  /** Optional one-line note about what the fixture is and why it's in the set. */
  expectation?: string
  /** Filename string passed to buildUserMessage — basename only. */
  filename: string
  /** Short label used in the report and command-line filters. */
  name: string
  tier: FixtureTier
}

/** Result of one variant's invocation on one fixture (one rerun). */
export type VariantRunResult = {
  errorMessage: null | string
  /** Multi-sample only: each sample's rating before median. */
  perSampleRatings?: Array<null | number>
  rating: null | number
  rawText: null | string
  reasoning: null | string
  status: SpikeStatus
  usage: RawAgentUsage
}

/** Variant strategy interface — one per row in the spike's variant table. */
export type Variant = {
  description: string
  name: string
  /**
   * Runs the variant against a batch of (fixture × rerun) pairs and returns
   * a result per pair, in the same order. The variant owns its own batching
   * strategy (single batch, multiple sequential batches, etc.).
   */
  runBatch: (jobs: VariantJob[]) => Promise<VariantRunResult[]>
}

/** A single (fixture, rerun) job submitted to a variant. */
export type VariantJob = {
  customId: string
  fixture: Fixture
  rerun: number
}