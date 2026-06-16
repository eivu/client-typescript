import type {RawAgentResult} from '@src/ai/types'

import {extractRatingFromYaml} from '@experiments/spike/extract-rating.js'
import {zeroUsage} from '@experiments/spike/skill-loader.js'
import {type Variant, type VariantJob, type VariantRunResult} from '@experiments/spike/types.js'
import {buildUserMessage} from '@src/ai/base-agent.js'
import {ClaudeAgent} from '@src/ai/claude-agent.js'

const SPIKE_MAX_TOKENS = 8192
const OPUS_4_7 = 'claude-opus-4-7'

/**
 * Phase 2 variant: full Opus 4.7 swap across every pipeline (comics, audio,
 * video, other). Same call shape, web budget, and assembled prompts as
 * `phase1-fragments` — only the model identifier changes.
 *
 * Question this answers: does the agentic-coding-focused 4.7 upgrade help
 * eivu's web-research-then-emit-YAML workflow enough to justify the ~35%
 * tokenization tax (per Anthropic's pricing docs, Opus 4.7 uses a new
 * tokenizer that produces up to 35% more tokens for the same fixed text)?
 *
 * Cost note: the harness's per-fixture cost is computed via the model passed
 * to `computeCost` — see `inferModelForCost(variant, fixture)` in `harness.ts`.
 * Opus 4.7 has identical per-token pricing to 4.6 (Anthropic's pricing page),
 * so the cost delta in the report comes entirely from observed token-count
 * differences in the API response.
 */
export const phase2Opus47Variant: Variant = {
  description:
    'Phase 2 model swap: Opus 4.7 across all media types via per-pipeline override. Same prompts as phase1-fragments.',
  name: 'phase2-opus-4-7',
  async runBatch(jobs: VariantJob[]): Promise<VariantRunResult[]> {
    if (jobs.length === 0) return []

    // Assembler mode + global model override: ClaudeAgent's constructor
    // forwards `model` to every pipeline factory.
    const agent = new ClaudeAgent({
      maxTokens: SPIKE_MAX_TOKENS,
      model: OPUS_4_7,
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
