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
const SONNET_4_6 = 'claude-sonnet-4-6'

/**
 * Phase 2 variant: comics on Opus 4.6, audio/video on Sonnet 4.6.
 *
 * Question this answers: can the lighter audio/video research workflows
 * (track/album/credits or cast/director/aggregate-scores) run on Sonnet 4.6
 * without losing rating consistency? Sonnet is $3/$15 per MTok vs Opus
 * $5/$25 — roughly 40% cheaper per token.
 *
 * Comics stays on Opus because its research is the heaviest in eivu (S## mapping
 * tables, universe disambiguation, full creator credits per issue, character
 * universe-labeling). The plan explicitly recommends keeping comics on Opus.
 *
 * Sonnet 4.6 supports extended thinking; the model swap is otherwise
 * transparent to the rest of the pipeline (same Anthropic Messages Batches
 * API, same web_search tool, same prompt format).
 */
export const phase2SonnetNonComicsVariant: Variant = {
  description:
    'Phase 2 model-tiering: Opus 4.6 for comics, Sonnet 4.6 for audio/video and other. Tests whether non-comics tolerates a smaller model.',
  name: 'phase2-sonnet-non-comics',
  async runBatch(jobs: VariantJob[]): Promise<VariantRunResult[]> {
    if (jobs.length === 0) return []

    // Per-pipeline custom mode: build each pipeline with its target model and
    // pass the full record to ClaudeAgent via options.pipelines.
    const pipelines = {
      audio: buildAudioPipeline({maxTokens: SPIKE_MAX_TOKENS, model: SONNET_4_6}),
      comics: buildComicsPipeline({maxTokens: SPIKE_MAX_TOKENS, model: OPUS_4_6}),
      video: buildVideoPipeline({maxTokens: SPIKE_MAX_TOKENS, model: SONNET_4_6}),
    } as const

    const other = buildOtherPipeline({maxTokens: SPIKE_MAX_TOKENS, model: SONNET_4_6})
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
