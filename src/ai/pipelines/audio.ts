import type {Pipeline} from '@src/ai/pipeline'
import type {PipelineFactoryOptions} from '@src/ai/pipelines/types'

import {buildUserMessage} from '@src/ai/base-agent'
import {assemble} from '@src/ai/prompt-assembler'

const AUDIO_DEFAULTS = {
  maxTokens: 16_384,
  model: 'claude-sonnet-4-6',
  webSearchMaxUses: 10,
} as const

/**
 * Audio pipeline (Phase 2 primary, post-Sonnet-swap): single Sonnet 4.6 stage
 * with the assembled audio fragment prompt and 10-search web budget.
 *
 * Sonnet was adopted 2026-05-28 after the Phase 2 model-tiering sub-experiment
 * showed 25% cost savings, tighter stddev (0.029 vs 0.088), and preserved
 * web-search budget (4.7/call vs 5.6 control) for non-comics media. See
 * tmp/phase2-comparison-analysis.md for the data.
 */
export function buildAudioPipeline(options: PipelineFactoryOptions = {}): Pipeline {
  return {
    name: 'audio',
    stages: [
      {
        buildUserMessage,
        maxTokens: options.maxTokens ?? AUDIO_DEFAULTS.maxTokens,
        model: options.model ?? AUDIO_DEFAULTS.model,
        systemPrompt: assemble({fragmentsRoot: options.fragmentsRoot, mediaType: 'audio'}),
        webSearchMaxUses: options.webSearchMaxUses ?? AUDIO_DEFAULTS.webSearchMaxUses,
      },
    ],
  }
}
