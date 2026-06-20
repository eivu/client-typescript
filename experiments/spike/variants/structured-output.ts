import type {RawAgentResult} from '@src/ai/types'

import {
  buildStructuredOutputSystemPrompt,
  SUBMIT_RATING_TOOL,
  SUBMIT_RATING_TOOL_CHOICE,
} from '@experiments/spike/content/structured-output-tool.js'
import {extractRatingFromToolInput} from '@experiments/spike/extract-rating.js'
import {loadBaselineSkill, zeroUsage} from '@experiments/spike/skill-loader.js'
import {type Variant, type VariantJob, type VariantRunResult} from '@experiments/spike/types.js'
import {buildUserMessage} from '@src/ai/base-agent.js'
import {ClaudeAgent} from '@src/ai/claude-agent.js'

const SPIKE_MAX_TOKENS = 8192

/**
 * Variant 5: Structured output. Adds a `submit_rating` tool with a JSON schema
 * that constrains the rating to the 0.5-step enum. The model is forced to call
 * SOME tool on every turn (tool_choice 'any'): it uses web_search during
 * research and submit_rating to finalize.
 *
 * The hypothesis: by routing the final score through a schema-validated tool
 * call, we eliminate parse failures and force the model to emit a number in
 * the valid set (rather than freeform text that occasionally drifts).
 */
export const structuredOutputVariant: Variant = {
  description:
    'Opus 4.6 + web_search + submit_rating tool with rating enum (0.5 steps). Forces tool use; rating cannot drift outside valid set.',
  name: 'structured-output',
  async runBatch(jobs: VariantJob[]): Promise<VariantRunResult[]> {
    if (jobs.length === 0) return []

    const skill = buildStructuredOutputSystemPrompt(loadBaselineSkill())

    // Build the tool list: web_search + submit_rating. `tools` option in
    // AgentOptions takes over from the auto-built web_search list, so we
    // declare both explicitly here.
    const tools = [
      {
        // eslint-disable-next-line camelcase -- Anthropic API uses snake_case
        max_uses: 10,
        name: 'web_search',
        type: 'web_search_20250305',
      },
      SUBMIT_RATING_TOOL,
    ]

    const agent = new ClaudeAgent({
      maxTokens: SPIKE_MAX_TOKENS,
      model: 'claude-opus-4-6',
      skillContent: skill,
      toolChoice: SUBMIT_RATING_TOOL_CHOICE,
      tools,
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

  if (!raw.toolUseInput || raw.toolUseName !== 'submit_rating') {
    return {
      errorMessage: `model did not call submit_rating (last tool: ${raw.toolUseName ?? 'none'})`,
      rating: null,
      rawText: raw.rawText,
      reasoning: null,
      status: 'parse_failure',
      usage: raw.usage,
    }
  }

  const extracted = extractRatingFromToolInput(raw.toolUseInput)
  return {
    errorMessage: extracted.errorMessage,
    rating: extracted.rating,
    rawText: `[tool_use submit_rating] ${JSON.stringify(raw.toolUseInput)}`,
    reasoning: extracted.reasoning,
    status: extracted.rating === null ? 'parse_failure' : 'success',
    usage: raw.usage,
  }
}
