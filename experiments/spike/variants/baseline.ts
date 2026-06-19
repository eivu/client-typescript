import {loadBaselineSkill} from '@experiments/spike/skill-loader.js'
import {type Variant} from '@experiments/spike/types.js'
import {simpleVariant} from '@experiments/spike/variant-runner.js'
import {ClaudeAgent} from '@src/ai/claude-agent.js'

const SPIKE_MAX_TOKENS = 8192

/**
 * Variant 1: Baseline. Current production pipeline with no changes.
 * - Model: claude-opus-4-6
 * - System prompt: v7.16.4 monolithic skill file (ephemeral cache)
 * - User message: existing buildUserMessage media-routed prompt
 * - Tools: web_search (max 10)
 *
 * This variant is the control — every other variant is measured relative to it
 * for stddev, cost, parse-failure rate, and end-to-end failure rate.
 */
export const baselineVariant: Variant = simpleVariant({
  buildAgent: () =>
    new ClaudeAgent({
      maxTokens: SPIKE_MAX_TOKENS,
      model: 'claude-opus-4-6',
      skillContent: loadBaselineSkill(),
      webSearchMaxUses: 10,
    }),
  description: 'Current pipeline: Opus 4.6 + v7.16.4 monolithic skill + web_search(max=10). Control.',
  name: 'baseline',
})
