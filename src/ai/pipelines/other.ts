import type {Pipeline} from '@src/ai/pipeline'
import type {PipelineFactoryOptions} from '@src/ai/pipelines/types'

import {buildUserMessage} from '@src/ai/base-agent'
import * as fs from 'node:fs'
import path from 'node:path'

const OTHER_DEFAULTS = {
  maxTokens: 16_384,
  model: 'claude-opus-4-6',
  webSearchMaxUses: 10,
} as const

const MONOLITH_PATH = path.join('src', 'ai', 'prompts', 'claude', 'EIVU_METADATA_SKILL_v7_16_4_RUNTIME.md')

/**
 * 'Other' pipeline (Phase 2 primary): catch-all for files whose extension does
 * not match a known media category. Uses the v7.16.4 monolith as the system
 * prompt because Phase 1 only authored fragments for comics/audio/video; the
 * monolith remains the most complete ruleset for unknown file types.
 *
 * Returns `undefined` when the monolith is not on disk — production callers
 * should expect this and either skip 'other' files or surface a clear error.
 * `ClaudeAgent.resolvePipeline()` raises in that case rather than silently
 * picking a wrong-shape pipeline.
 */
export function buildOtherPipeline(options: PipelineFactoryOptions = {}): Pipeline | undefined {
  const fullPath = path.join(process.cwd(), MONOLITH_PATH)
  if (!fs.existsSync(fullPath)) return undefined

  const monolith = fs.readFileSync(fullPath, 'utf8')
  return {
    name: 'other',
    stages: [
      {
        buildUserMessage,
        maxTokens: options.maxTokens ?? OTHER_DEFAULTS.maxTokens,
        model: options.model ?? OTHER_DEFAULTS.model,
        systemPrompt: monolith,
        webSearchMaxUses: options.webSearchMaxUses ?? OTHER_DEFAULTS.webSearchMaxUses,
      },
    ],
  }
}
