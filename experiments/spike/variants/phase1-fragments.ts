import type {RawAgentResult} from '@src/ai/types'

import {extractRatingFromYaml} from '@experiments/spike/extract-rating.js'
import {zeroUsage} from '@experiments/spike/skill-loader.js'
import {type Variant, type VariantJob, type VariantRunResult} from '@experiments/spike/types.js'
import {buildUserMessage} from '@src/ai/base-agent.js'
import {ClaudeAgent} from '@src/ai/claude-agent.js'

const SPIKE_MAX_TOKENS = 8192

/**
 * Phase 1 variant: same shape as baseline, but the agent runs in assembler mode
 * (no `skillContent` / `skillPath`), so the system prompt is built per-request
 * from per-media fragments via `PromptAssembler`.
 *
 * What this measures (vs baseline):
 *   - Whether assembling per-media prompts changes rating consistency.
 *   - Whether token counts differ (smaller assembled prompts vs the full monolith).
 *   - Whether prompt-cache hit rate improves (per-media cache lanes vs one
 *     monolith reused for all media types — within one rerun's 8-fixture batch,
 *     comics fixtures will share a cache key separate from audio/video).
 *
 * Everything else is identical to baseline: same model, same web_search budget,
 * same user message, same Anthropic Batches API path.
 */
export const phase1FragmentsVariant: Variant = {
  description:
    'Phase 1 assembler mode: Opus 4.6 + per-media fragments via PromptAssembler + web_search(max=10).',
  name: 'phase1-fragments',
  async runBatch(jobs: VariantJob[]): Promise<VariantRunResult[]> {
    if (jobs.length === 0) return []

    // Assembler mode: omit skillContent/skillPath so the constructor builds
    // per-media-type prompts and the 'other' fallback via PromptAssembler.
    const agent = new ClaudeAgent({
      maxTokens: SPIKE_MAX_TOKENS,
      model: 'claude-opus-4-6',
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
