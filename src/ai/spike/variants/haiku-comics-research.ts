import {ClaudeAgent} from '@src/ai/claude-agent.js'
import {
  buildStage1UserMessage,
  buildStage2UserMessage,
  STAGE_1_RESEARCH_SYSTEM_PROMPT,
  STAGE_2_SCORE_SYSTEM_PROMPT,
} from '@src/ai/spike/content/evidence-schema.js'
import {extractRatingFromYaml} from '@src/ai/spike/extract-rating.js'
import {sumUsage, zeroUsage} from '@src/ai/spike/skill-loader.js'
import {type Variant, type VariantJob, type VariantRunResult} from '@src/ai/spike/types.js'

const STAGE_1_MAX_TOKENS = 4096
const STAGE_2_MAX_TOKENS = 4096

/**
 * Variant 6: Haiku-for-comics-research. Same two-stage shape as variant 3,
 * but Stage 1 uses Haiku 4.5 instead of Sonnet 4.6.
 *
 * Intended for the model-tier validation sweep — runs only AFTER a consistency
 * winner is picked (variant 1-5). If Haiku's research evidence is within
 * tolerance of Sonnet's for comics fixtures, the Phase 2 `comics` pipeline
 * drops to Haiku for research.
 */
export const haikuComicsResearchVariant: Variant = {
  description:
    'Two-stage with Haiku 4.5 for research (vs. Sonnet 4.6). Comics-only model-tier validation sweep.',
  name: 'haiku-comics-research',
  async runBatch(jobs: VariantJob[]): Promise<VariantRunResult[]> {
    if (jobs.length === 0) return []

    const researchAgent = new ClaudeAgent({
      maxTokens: STAGE_1_MAX_TOKENS,
      model: 'claude-haiku-4-5',
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

    const scoreAgent = new ClaudeAgent({
      maxTokens: STAGE_2_MAX_TOKENS,
      model: 'claude-opus-4-6',
      skillContent: STAGE_2_SCORE_SYSTEM_PROMPT,
      webSearchMaxUses: 0,
    })

    const stage2Results = await scoreAgent.processRequestsRaw(
      jobs.map((job) => {
        const s1 = stage1Results.find((r) => r.customId === job.customId)
        return {
          customId: job.customId,
          filePath: job.fixture.filename,
          userMessage: buildStage2UserMessage(job.fixture.filename, s1?.rawText ?? '{}'),
        }
      }),
    )

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
        rawText: `--- stage1-evidence (haiku) ---\n${s1.rawText}\n--- stage2-yaml (opus) ---\n${s2.rawText}`,
        reasoning: extracted.reasoning,
        status: extracted.rating === null ? 'parse_failure' : 'success',
        usage: combinedUsage,
      }
    })
  },
}
