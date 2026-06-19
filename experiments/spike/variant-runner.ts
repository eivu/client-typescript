import type {ClaudeAgent} from '@src/ai/claude-agent.js'
import type {RawAgentResult} from '@src/ai/types'

import {extractRatingFromYaml} from '@experiments/spike/extract-rating.js'
import {zeroUsage} from '@experiments/spike/skill-loader.js'
import {type Variant, type VariantJob, type VariantRunResult} from '@experiments/spike/types.js'
import {buildUserMessage} from '@src/ai/base-agent.js'

/**
 * Shared spec for the "boilerplate-shaped" variants: those whose `runBatch` does
 * nothing but build one `ClaudeAgent`, run every job through `processRequestsRaw`
 * with the standard media-routed user message, and extract the rating from each
 * raw YAML response. The only thing that varies between them is how the agent is
 * constructed — captured by `buildAgent`.
 *
 * Variants that do something genuinely different (multi-sample medians, forced
 * tool-use parsing, two-stage research→score) do NOT use this helper and keep
 * their own `runBatch`.
 */
type SimpleVariantSpec = {
  /** Builds the agent for this variant — the sole point of divergence. */
  buildAgent: () => ClaudeAgent
  description: string
  name: string
}

/**
 * Maps one job's raw API result into a `VariantRunResult`: surfaces model errors,
 * extracts the rating/reasoning from the YAML, and classifies parse failures.
 * Shared by every `simpleVariant` (previously copy-pasted verbatim into each).
 */
function mapRawToVariantResult(job: VariantJob, rawResults: RawAgentResult[]): VariantRunResult {
  const raw = rawResults.find((r) => r.customId === job.customId)
  if (!raw) {
    return {
      errorMessage: 'no raw result returned for this job',
      rating: null,
      rawText: null,
      reasoning: null,
      status: 'model_error',
      usage: zeroUsage(),
    }
  }

  if (raw.status === 'error') {
    return {
      errorMessage: raw.error ?? 'model error',
      rating: null,
      rawText: null,
      reasoning: null,
      status: 'model_error',
      usage: raw.usage,
    }
  }

  const extracted = extractRatingFromYaml(raw.rawText)
  return {
    errorMessage: extracted.errorMessage,
    rating: extracted.rating,
    rawText: raw.rawText,
    reasoning: extracted.reasoning,
    status: extracted.rating === null ? 'parse_failure' : 'success',
    usage: raw.usage,
  }
}

/**
 * Builds a `Variant` from a `SimpleVariantSpec`. The returned `runBatch` builds
 * the agent once, runs all jobs through `processRequestsRaw` with the standard
 * `buildUserMessage` prompt, and maps each result with `mapRawToVariantResult`.
 */
export function simpleVariant(spec: SimpleVariantSpec): Variant {
  return {
    description: spec.description,
    name: spec.name,
    async runBatch(jobs: VariantJob[]): Promise<VariantRunResult[]> {
      if (jobs.length === 0) return []

      const agent = spec.buildAgent()
      const rawResults = await agent.processRequestsRaw(
        jobs.map((job) => ({
          customId: job.customId,
          filePath: job.fixture.filename,
          userMessage: buildUserMessage(job.fixture.filename),
        })),
      )

      return jobs.map((job) => mapRawToVariantResult(job, rawResults))
    },
  }
}
