import {computeCost, sumCosts, zeroCost} from '@src/ai/spike/cost.js'
import {FIXTURES} from '@src/ai/spike/fixtures.js'
import {
  type Fixture,
  type SpikeCost,
  type SpikeRun,
  type Variant,
  type VariantJob,
  type VariantRunResult,
} from '@src/ai/spike/types.js'
import {ALL_VARIANTS, PRIMARY_VARIANTS, variantByName} from '@src/ai/spike/variants/index.js'
import logger from '@src/logger.js'

/** Options for the spike harness. */
export type HarnessOptions = {
  /**
   * Override the entire fixture list with these ad-hoc fixtures. When set,
   * `fixtureNames` is ignored. Used for one-shot runs against user-supplied
   * filenames (e.g. real comics from a library).
   */
  customFixtures?: Fixture[]
  /** Restrict to these fixture names. If omitted, all built-in fixtures are used. */
  fixtureNames?: string[]
  /** Number of reruns per (variant, fixture) — default 3. */
  reruns?: number
  /** Restrict to these variant names. If omitted, all 5 primary variants run. */
  variantNames?: string[]
}

/** Full result of a spike run: all per-variant-per-fixture-per-rerun records. */
export type HarnessResult = {
  fixtures: Fixture[]
  reruns: number
  runs: SpikeRun[]
  totalCost: SpikeCost
  variants: Variant[]
}

/**
 * Runs the configured (variant × fixture × rerun) matrix through the harness.
 *
 * Each variant is invoked ONCE per rerun with the full fixture set as a single
 * batch (the variant owns its internal stage batching). This is the most
 * efficient pattern for the prompt cache: same `(media-type, stage)` content
 * across all fixtures in one rerun shares the same cached system prompt.
 *
 * Reruns are sequential — within one rerun we get cache hits across fixtures;
 * across reruns the 5-minute TTL likely expires, so each rerun's first call
 * is a fresh cache write. That's intentional: the spike measures realistic
 * cost, not best-case cost.
 */
export async function runHarness(options: HarnessOptions = {}): Promise<HarnessResult> {
  const reruns = options.reruns ?? 3

  let fixtures: Fixture[]
  if (options.customFixtures && options.customFixtures.length > 0) {
    fixtures = options.customFixtures
  } else if (options.fixtureNames) {
    fixtures = FIXTURES.filter((f) => options.fixtureNames!.includes(f.name))
  } else {
    fixtures = FIXTURES
  }

  // If specific variant names were provided, look them up across the full set
  // (including haiku-comics-research). Otherwise default to the primary 5.
  const variants = options.variantNames
    ? options.variantNames
        .map((name) => variantByName(name))
        .filter((v): v is Variant => v !== undefined)
    : PRIMARY_VARIANTS

  if (fixtures.length === 0) throw new Error('No fixtures selected — check --fixtures filter')
  if (variants.length === 0) throw new Error('No variants selected — check --variants filter')

  const runs: SpikeRun[] = []

  logger.info(
    {fixtures: fixtures.length, reruns, runs: variants.length * fixtures.length * reruns, variants: variants.length},
    'Starting spike harness',
  )

  for (const variant of variants) {
    for (let rerunIdx = 1; rerunIdx <= reruns; rerunIdx++) {
      const jobs: VariantJob[] = fixtures.map((fixture) => ({
        customId: `${variant.name}__${fixture.name}__r${rerunIdx}`.replaceAll(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64),
        fixture,
        rerun: rerunIdx,
      }))

      logger.info({rerun: rerunIdx, variant: variant.name}, 'Running variant batch')

      let variantResults: VariantRunResult[]
      try {
        // eslint-disable-next-line no-await-in-loop -- reruns must be sequential for cache realism
        variantResults = await variant.runBatch(jobs)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error({error: message, rerun: rerunIdx, variant: variant.name}, 'Variant batch threw')
        // Synthesize error results so the report still has a row for these runs.
        variantResults = jobs.map((): VariantRunResult => ({
          errorMessage: `harness exception: ${message}`,
          rating: null,
          rawText: null,
          reasoning: null,
          status: 'model_error',
          usage: {
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
            inputTokens: 0,
            latencyMs: 0,
            outputTokens: 0,
            webSearchRequests: 0,
          },
        }))
      }

      for (const [idx, job] of jobs.entries()) {
        const result = variantResults[idx]
        const model = inferModelForCost(variant.name, job.fixture.category)
        const cost = result.usage.inputTokens > 0 ? computeCost(model, result.usage) : zeroCost()

        runs.push({
          cost,
          errorMessage: result.errorMessage,
          fixture: job.fixture.name,
          ...(result.perSampleRatings ? {perSampleRatings: result.perSampleRatings} : {}),
          rating: result.rating,
          rawText: result.rawText,
          reasoning: result.reasoning,
          rerun: rerunIdx,
          status: result.status,
          usage: result.usage,
          variant: variant.name,
        })
      }
    }
  }

  const totalCost = sumCosts(runs.map((r) => r.cost))
  logger.info({runs: runs.length, totalUsd: totalCost.totalUsd.toFixed(2)}, 'Spike harness complete')

  return {fixtures, reruns, runs, totalCost, variants}
}

/**
 * Infers the "primary cost-bearing model" for cost attribution.
 *
 * The harness doesn't get a stage-by-stage cost breakdown — usage is summed
 * per variant run. For variants with multiple stages, we attribute cost
 * using the most expensive model in the variant (since input tokens scale
 * with whichever model processed them, and the post-hoc reconstruction is
 * approximate). For more precise per-stage cost, the variants would need
 * to return per-stage usage — left as a Phase 0.1 enhancement if needed.
 *
 * Phase 2 variants use per-(variant, fixture-category) dispatch so the cost
 * column reflects the model that actually ran:
 *   - `phase2-opus-4-7` uses Opus 4.7 across all categories.
 *   - `phase2-sonnet-non-comics` uses Opus 4.6 for comics and Sonnet 4.6 for
 *     audio/video/other.
 */
function inferModelForCost(variantName: string, fixtureCategory: 'audio' | 'comic' | 'video'): string {
  if (variantName === 'phase2-opus-4-7') return 'claude-opus-4-7'
  if (variantName === 'phase2-sonnet-non-comics') {
    return fixtureCategory === 'comic' ? 'claude-opus-4-6' : 'claude-sonnet-4-6'
  }

  if (variantName === 'phase2-haiku-non-comics') {
    return fixtureCategory === 'comic' ? 'claude-opus-4-6' : 'claude-haiku-4-5'
  }

  if (variantName === 'two-stage' || variantName === 'haiku-comics-research') {
    // Stage 2 (Opus) is the dominant cost driver for these variants
    return 'claude-opus-4-6'
  }

  return 'claude-opus-4-6'
}

/** Exports the unfiltered fixture and variant tables for the command layer. */
export const HARNESS_DEFAULTS = {
  fixtures: FIXTURES,
  primaryVariants: PRIMARY_VARIANTS,
  variants: ALL_VARIANTS,
}
