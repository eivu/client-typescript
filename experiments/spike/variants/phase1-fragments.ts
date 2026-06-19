import {type Variant} from '@experiments/spike/types.js'
import {simpleVariant} from '@experiments/spike/variant-runner.js'
import {ClaudeAgent} from '@src/ai/claude-agent.js'

const SPIKE_MAX_TOKENS = 8192

/**
 * Phase 1 variant: same shape as baseline, but the agent runs in assembler mode
 * (no `skillContent` / `skillPath`), so the system prompt is built per-request
 * from per-media fragments via `PromptAssembler`.
 *
 * What this measures (vs baseline):
 *   - Whether assembling per-media prompts changes rating consistency.
 *   - Whether token counts differ (smaller assembled prompts vs the full monolith).
 *   - Whether prompt-cache hit rate improves (per-media cache lanes vs one
 *     monolith reused for all media types — within one rerun's 8-fixture batch,
 *     comics fixtures will share a cache key separate from audio/video).
 *
 * Everything else is identical to baseline: same model, same web_search budget,
 * same user message, same Anthropic Batches API path.
 */
export const phase1FragmentsVariant: Variant = simpleVariant({
  // Assembler mode: omit skillContent/skillPath so the constructor builds
  // per-media-type prompts and the 'other' fallback via PromptAssembler.
  buildAgent: () =>
    new ClaudeAgent({
      maxTokens: SPIKE_MAX_TOKENS,
      model: 'claude-opus-4-6',
      webSearchMaxUses: 10,
    }),
  description:
    'Phase 1 assembler mode: Opus 4.6 + per-media fragments via PromptAssembler + web_search(max=10).',
  name: 'phase1-fragments',
})
