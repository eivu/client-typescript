import {type Variant} from '@experiments/spike/types.js'
import {simpleVariant} from '@experiments/spike/variant-runner.js'
import {ClaudeAgent} from '@src/ai/claude-agent.js'

const SPIKE_MAX_TOKENS = 8192
const OPUS_4_7 = 'claude-opus-4-7'

/**
 * Phase 2 variant: full Opus 4.7 swap across every pipeline (comics, audio,
 * video, other). Same call shape, web budget, and assembled prompts as
 * `phase1-fragments` — only the model identifier changes.
 *
 * Question this answers: does the agentic-coding-focused 4.7 upgrade help
 * eivu's web-research-then-emit-YAML workflow enough to justify the ~35%
 * tokenization tax (per Anthropic's pricing docs, Opus 4.7 uses a new
 * tokenizer that produces up to 35% more tokens for the same fixed text)?
 *
 * Cost note: the harness's per-fixture cost is computed via the model passed
 * to `computeCost` — see `inferModelForCost(variant, fixture)` in `harness.ts`.
 * Opus 4.7 has identical per-token pricing to 4.6 (Anthropic's pricing page),
 * so the cost delta in the report comes entirely from observed token-count
 * differences in the API response.
 */
export const phase2Opus47Variant: Variant = simpleVariant({
  // Assembler mode + global model override: ClaudeAgent's constructor
  // forwards `model` to every pipeline factory.
  buildAgent: () =>
    new ClaudeAgent({
      maxTokens: SPIKE_MAX_TOKENS,
      model: OPUS_4_7,
      webSearchMaxUses: 10,
    }),
  description:
    'Phase 2 model swap: Opus 4.7 across all media types via per-pipeline override. Same prompts as phase1-fragments.',
  name: 'phase2-opus-4-7',
})
