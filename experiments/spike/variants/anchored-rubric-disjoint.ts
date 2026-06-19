import {RATING_ANCHORS_DISJOINT_FRAGMENT} from '@experiments/spike/content/anchors-disjoint.js'
import {loadBaselineSkill} from '@experiments/spike/skill-loader.js'
import {type Variant} from '@experiments/spike/types.js'
import {simpleVariant} from '@experiments/spike/variant-runner.js'
import {ClaudeAgent} from '@src/ai/claude-agent.js'

const SPIKE_MAX_TOKENS = 8192

/**
 * Confirmatory variant: anchored rubric with a DISJOINT exemplar set.
 *
 * Same call shape as anchored-rubric, but the §E.1 fragment uses 15 anchors
 * that have zero overlap with the 8 spike fixtures. This isolates whether
 * the variance reduction in the original spike came from genuine rubric
 * calibration vs. the model copying anchor ratings onto matching fixtures.
 */
export const anchoredRubricDisjointVariant: Variant = simpleVariant({
  buildAgent: () =>
    new ClaudeAgent({
      maxTokens: SPIKE_MAX_TOKENS,
      model: 'claude-opus-4-6',
      skillContent: loadBaselineSkill() + '\n\n' + RATING_ANCHORS_DISJOINT_FRAGMENT,
      webSearchMaxUses: 10,
    }),
  description:
    'Baseline + §E.1 anchor exemplars with ZERO fixture overlap. Confirmatory follow-up to anchored-rubric to rule out anchor-copying.',
  name: 'anchored-rubric-disjoint',
})
