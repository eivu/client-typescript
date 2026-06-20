import {
  buildStage1UserMessage,
  buildStage2UserMessage,
  STAGE_1_RESEARCH_SYSTEM_PROMPT,
  STAGE_2_SCORE_SYSTEM_PROMPT,
} from '@experiments/spike/content/evidence-schema.js'
import {extractRatingFromYaml} from '@experiments/spike/extract-rating.js'
import {sumUsage, zeroUsage} from '@experiments/spike/skill-loader.js'
import {type Variant, type VariantJob, type VariantRunResult} from '@experiments/spike/types.js'
import {ClaudeAgent} from '@src/ai/claude-agent.js'

const STAGE_1_MAX_TOKENS = 4096
const STAGE_2_MAX_TOKENS = 4096

/**
 * Variant 3: Two-stage research → score.
 * - Stage 1: Sonnet 4.6 + web_search(10) produces JSON evidence (no rating).
 * - Stage 2: Opus 4.6, NO tools, reads JSON evidence + filename, emits final YAML.
 *
 * The split aims to (a) make scoring deterministic by giving Stage 2 only
 * structured evidence (no noisy web prose), and (b) drop the research cost
 * by using a cheaper model for the harder I/O-bound work.
 */
export const twoStageVariant: Variant = {
  description:
    'Stage1=Sonnet+web→JSON evidence; Stage2=Opus no-tools→YAML score. Splits research from rating.',
  name: 'two-stage',
  async runBatch(jobs: VariantJob[]): Promise<VariantRunResult[]> {
    if (jobs.length === 0) return []

    // Stage 1 — research with Sonnet + web search
    const researchAgent = new ClaudeAgent({
      maxTokens: STAGE_1_MAX_TOKENS,
      model: 'claude-sonnet-4-6',
      skillContent: STAGE_1_RESEARCH_SYSTEM_PROMPT,
      webSearchMaxUses: 10,
    })

    const stage1Results = await researchAgent.processRequestsRaw(
      jobs.map((job) => ({
        customId: job.customId,
        filePath: job.fixture.filename,
        userMessage: buildStage1UserMessage(job.fixture.filename),
      })),
    )

    // Build Stage 2 requests using each job's Stage 1 evidence.
    // Jobs whose Stage 1 errored still get a Stage 2 attempt with whatever rawText
    // came back (often empty) so we can attribute the failure correctly downstream.
    const stage2Requests = jobs.map((job) => {
      const stage1 = stage1Results.find((r) => r.customId === job.customId)
      const evidenceJson = stage1?.rawText ?? '{}'
      return {
        customId: job.customId,
        filePath: job.fixture.filename,
        userMessage: buildStage2UserMessage(job.fixture.filename, evidenceJson),
      }
    })

    const scoreAgent = new ClaudeAgent({
      maxTokens: STAGE_2_MAX_TOKENS,
      model: 'claude-opus-4-6',
      skillContent: STAGE_2_SCORE_SYSTEM_PROMPT,
      webSearchMaxUses: 0,
    })

    const stage2Results = await scoreAgent.processRequestsRaw(stage2Requests)

    return jobs.map((job): VariantRunResult => {
      const s1 = stage1Results.find((r) => r.customId === job.customId)
      const s2 = stage2Results.find((r) => r.customId === job.customId)

      if (!s1 || !s2) {
        return {
          errorMessage: 'missing stage result',
          rating: null,
          rawText: null,
          reasoning: null,
          status: 'model_error',
          usage: zeroUsage(),
        }
      }

      const combinedUsage = sumUsage(s1.usage, s2.usage)

      if (s1.status === 'error') {
        return {
          errorMessage: `stage1 error: ${s1.error ?? 'unknown'}`,
          rating: null,
          rawText: null,
          reasoning: null,
          status: 'model_error',
          usage: combinedUsage,
        }
      }

      if (s2.status === 'error') {
        return {
          errorMessage: `stage2 error: ${s2.error ?? 'unknown'}`,
          rating: null,
          rawText: s1.rawText,
          reasoning: null,
          status: 'model_error',
          usage: combinedUsage,
        }
      }

      const extracted = extractRatingFromYaml(s2.rawText)
      return {
        errorMessage: extracted.errorMessage,
        rating: extracted.rating,
        rawText: `--- stage1-evidence ---\n${s1.rawText}\n--- stage2-yaml ---\n${s2.rawText}`,
        reasoning: extracted.reasoning,
        status: extracted.rating === null ? 'parse_failure' : 'success',
        usage: combinedUsage,
      }
    })
  },
}
