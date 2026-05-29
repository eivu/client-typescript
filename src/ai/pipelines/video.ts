import type {Pipeline} from '@src/ai/pipeline'
import type {PipelineFactoryOptions} from '@src/ai/pipelines/types'

import {buildUserMessage} from '@src/ai/base-agent'
import {assemble} from '@src/ai/prompt-assembler'

const VIDEO_DEFAULTS = {
  maxTokens: 16_384,
  model: 'claude-sonnet-4-6',
  webSearchMaxUses: 10,
} as const

/**
 * Video pipeline (Phase 2 primary, post-Sonnet-swap): single Sonnet 4.6 stage
 * with the assembled video fragment prompt and 10-search web budget.
 *
 * Sonnet was adopted 2026-05-28 alongside audio after the Phase 2 model-tiering
 * sub-experiment confirmed non-comics media tolerates the lighter model
 * without behavioral regression. See tmp/phase2-comparison-analysis.md.
 */
export function buildVideoPipeline(options: PipelineFactoryOptions = {}): Pipeline {
  return {
    name: 'video',
    stages: [
      {
        buildUserMessage,
        maxTokens: options.maxTokens ?? VIDEO_DEFAULTS.maxTokens,
        model: options.model ?? VIDEO_DEFAULTS.model,
        systemPrompt: assemble({fragmentsRoot: options.fragmentsRoot, mediaType: 'video'}),
        webSearchMaxUses: options.webSearchMaxUses ?? VIDEO_DEFAULTS.webSearchMaxUses,
      },
    ],
  }
}
