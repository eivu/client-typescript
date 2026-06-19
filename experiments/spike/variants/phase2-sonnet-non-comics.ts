import {type Variant} from '@experiments/spike/types.js'
import {simpleVariant} from '@experiments/spike/variant-runner.js'
import {ClaudeAgent} from '@src/ai/claude-agent.js'
import {
  buildAudioPipeline,
  buildComicsPipeline,
  buildOtherPipeline,
  buildVideoPipeline,
} from '@src/ai/pipelines/index.js'

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
export const phase2SonnetNonComicsVariant: Variant = simpleVariant({
  // Per-pipeline custom mode: build each pipeline with its target model and
  // pass the full record to ClaudeAgent via options.pipelines.
  buildAgent() {
    const pipelines = {
      audio: buildAudioPipeline({maxTokens: SPIKE_MAX_TOKENS, model: SONNET_4_6}),
      comics: buildComicsPipeline({maxTokens: SPIKE_MAX_TOKENS, model: OPUS_4_6}),
      video: buildVideoPipeline({maxTokens: SPIKE_MAX_TOKENS, model: SONNET_4_6}),
    } as const

    const other = buildOtherPipeline({maxTokens: SPIKE_MAX_TOKENS, model: SONNET_4_6})
    const allPipelines = other ? {...pipelines, other} : pipelines

    return new ClaudeAgent({
      pipelines: allPipelines,
      webSearchMaxUses: 10,
    })
  },
  description:
    'Phase 2 model-tiering: Opus 4.6 for comics, Sonnet 4.6 for audio/video and other. Tests whether non-comics tolerates a smaller model.',
  name: 'phase2-sonnet-non-comics',
})
