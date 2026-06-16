import type {RawAgentResult} from '@src/ai/types'

import {RATING_ANCHORS_FRAGMENT} from '@experiments/spike/content/anchors.js'
import {extractRatingFromYaml} from '@experiments/spike/extract-rating.js'
import {loadBaselineSkill, zeroUsage} from '@experiments/spike/skill-loader.js'
import {type Variant, type VariantJob, type VariantRunResult} from '@experiments/spike/types.js'
import {buildUserMessage} from '@src/ai/base-agent.js'
import {ClaudeAgent} from '@src/ai/claude-agent.js'

const SPIKE_MAX_TOKENS = 8192

/**
 * Variant 2: Anchored rubric. Same monolithic call as baseline, but the system
 * prompt appends a §E.1 fragment with 3 concrete exemplars per integer rating.
 * The exemplars give the model fixed reference points to calibrate against,
 * which is the standard lever for reducing scoring variance in human raters.
 */
export const anchoredRubricVariant: Variant = {
  description: 'Baseline + §E.1 anchor exemplars (3 per integer rating, 15 total). Tests rubric calibration.',
  name: 'anchored-rubric',
  async runBatch(jobs: VariantJob[]): Promise<VariantRunResult[]> {
    if (jobs.length === 0) return []

    const augmentedSkill = loadBaselineSkill() + '\n\n' + RATING_ANCHORS_FRAGMENT

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
