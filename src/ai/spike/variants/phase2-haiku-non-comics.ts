import type {RawAgentResult} from '@src/ai/types'

import {buildUserMessage} from '@src/ai/base-agent.js'
import {ClaudeAgent} from '@src/ai/claude-agent.js'
import {
  buildAudioPipeline,
  buildComicsPipeline,
  buildOtherPipeline,
  buildVideoPipeline,
} from '@src/ai/pipelines/index.js'
import {extractRatingFromYaml} from '@src/ai/spike/extract-rating.js'
import {zeroUsage} from '@src/ai/spike/skill-loader.js'
import {type Variant, type VariantJob, type VariantRunResult} from '@src/ai/spike/types.js'

const SPIKE_MAX_TOKENS = 8192
const OPUS_4_6 = 'claude-opus-4-6'
const HAIKU_4_5 = 'claude-haiku-4-5'

/**
 * Phase 2 follow-up variant: comics on Opus 4.6, audio/video/other on Haiku 4.5.
 *
 * Question this answers: now that the Sonnet sub-experiment confirmed
 * audio/video tolerate a lighter model, can we go one tier further to Haiku 4.5?
 * Haiku is $1/$5 per MTok vs Sonnet $3/$15 — roughly 3× cheaper than Sonnet
 * (≈5-6× cheaper than Opus) per token, but with notably weaker reasoning.
 *
 * The risk profile is the same axis as the Sonnet test: rating stability under
 * web-search-light research workflows. If Haiku holds stddev ≤ 0.10 for non-comics
 * AND web-search count per call stays within ~30% of control, it's worth adopting.
 * If web-search count drops sharply (like Opus 4.7 did), it's a behavioral regression.
 *
 * Comics stays on Opus by design — comics research is the heaviest workflow and
 * model-tier risk there is highest.
 */
export const phase2HaikuNonComicsVariant: Variant = {
  description:
    'Phase 2 follow-up: Opus 4.6 for comics, Haiku 4.5 for audio/video and other. Tests whether non-comics tolerates the lightest production tier.',
  name: 'phase2-haiku-non-comics',
  async runBatch(jobs: VariantJob[]): Promise<VariantRunResult[]> {
    if (jobs.length === 0) return []

    const pipelines = {
      audio: buildAudioPipeline({maxTokens: SPIKE_MAX_TOKENS, model: HAIKU_4_5}),
      comics: buildComicsPipeline({maxTokens: SPIKE_MAX_TOKENS, model: OPUS_4_6}),
      video: buildVideoPipeline({maxTokens: SPIKE_MAX_TOKENS, model: HAIKU_4_5}),
    } as const

    const other = buildOtherPipeline({maxTokens: SPIKE_MAX_TOKENS, model: HAIKU_4_5})
    const allPipelines = other ? {...pipelines, other} : pipelines

    const agent = new ClaudeAgent({
      pipelines: allPipelines,
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
