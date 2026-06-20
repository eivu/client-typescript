import {RATING_ANCHORS_FRAGMENT} from '@experiments/spike/content/anchors.js'
import {loadBaselineSkill} from '@experiments/spike/skill-loader.js'
import {type Variant} from '@experiments/spike/types.js'
import {simpleVariant} from '@experiments/spike/variant-runner.js'
import {ClaudeAgent} from '@src/ai/claude-agent.js'

const SPIKE_MAX_TOKENS = 8192

/**
 * Variant 2: Anchored rubric. Same monolithic call as baseline, but the system
 * prompt appends a §E.1 fragment with 3 concrete exemplars per integer rating.
 * The exemplars give the model fixed reference points to calibrate against,
 * which is the standard lever for reducing scoring variance in human raters.
 */
export const anchoredRubricVariant: Variant = simpleVariant({
  buildAgent: () =>
    new ClaudeAgent({
      maxTokens: SPIKE_MAX_TOKENS,
      model: 'claude-opus-4-6',
      skillContent: loadBaselineSkill() + '\n\n' + RATING_ANCHORS_FRAGMENT,
      webSearchMaxUses: 10,
    }),
  description: 'Baseline + §E.1 anchor exemplars (3 per integer rating, 15 total). Tests rubric calibration.',
  name: 'anchored-rubric',
})
