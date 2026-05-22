import type {RawAgentResult} from '@src/ai/types'

import {buildUserMessage} from '@src/ai/base-agent.js'
import {ClaudeAgent} from '@src/ai/claude-agent.js'
import {RATING_ANCHORS_DISJOINT_FRAGMENT} from '@src/ai/spike/content/anchors-disjoint.js'
import {extractRatingFromYaml} from '@src/ai/spike/extract-rating.js'
import {loadBaselineSkill, zeroUsage} from '@src/ai/spike/skill-loader.js'
import {type Variant, type VariantJob, type VariantRunResult} from '@src/ai/spike/types.js'

const SPIKE_MAX_TOKENS = 8192

/**
 * Confirmatory variant: anchored rubric with a DISJOINT exemplar set.
 *
 * Same call shape as anchored-rubric, but the §E.1 fragment uses 15 anchors
 * that have zero overlap with the 8 spike fixtures. This isolates whether
 * the variance reduction in the original spike came from genuine rubric
 * calibration vs. the model copying anchor ratings onto matching fixtures.
 */
export const anchoredRubricDisjointVariant: Variant = {
  description:
    'Baseline + §E.1 anchor exemplars with ZERO fixture overlap. Confirmatory follow-up to anchored-rubric to rule out anchor-copying.',
  name: 'anchored-rubric-disjoint',
  async runBatch(jobs: VariantJob[]): Promise<VariantRunResult[]> {
    if (jobs.length === 0) return []

    const augmentedSkill = loadBaselineSkill() + '\n\n' + RATING_ANCHORS_DISJOINT_FRAGMENT

    const agent = new ClaudeAgent({
      maxTokens: SPIKE_MAX_TOKENS,
      model: 'claude-opus-4-6',
      skillContent: augmentedSkill,
      webSearchMaxUses: 10,
    })

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
