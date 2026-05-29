import type {Pipeline} from '@src/ai/pipeline'
import type {PipelineFactoryOptions} from '@src/ai/pipelines/types'

import {buildUserMessage} from '@src/ai/base-agent'
import {assemble} from '@src/ai/prompt-assembler'

const COMICS_DEFAULTS = {
  maxTokens: 16_384,
  model: 'claude-opus-4-6',
  webSearchMaxUses: 10,
} as const

/**
 * Comics pipeline (Phase 2 primary): single Opus 4.6 stage with the assembled
 * comics fragment prompt and 10-search web budget. Matches today's production
 * call shape exactly — only the system-prompt assembly path changed in Phase 1.
 *
 * Comics keep Opus by design: comics research (S## mapping tables, universe
 * disambiguation, full creator credits, character labeling) is the heaviest
 * lift in the eivu workflow, so the model tier is not a candidate for the
 * Sonnet sub-experiment.
 *
 * Options act as overrides on the per-stage defaults — used by spike variants
 * (e.g. `phase1-fragments` runs at maxTokens=8192 to match the historical
 * baseline). Production callers pass no overrides.
 */
export function buildComicsPipeline(options: PipelineFactoryOptions = {}): Pipeline {
  return {
    name: 'comics',
    stages: [
      {
        buildUserMessage,
        maxTokens: options.maxTokens ?? COMICS_DEFAULTS.maxTokens,
        model: options.model ?? COMICS_DEFAULTS.model,
        systemPrompt: assemble({fragmentsRoot: options.fragmentsRoot, mediaType: 'comics'}),
        webSearchMaxUses: options.webSearchMaxUses ?? COMICS_DEFAULTS.webSearchMaxUses,
      },
    ],
  }
}
