import type {Variant} from '@experiments/spike/types.js'

import {anchoredRubricDisjointVariant} from '@experiments/spike/variants/anchored-rubric-disjoint.js'
import {anchoredRubricVariant} from '@experiments/spike/variants/anchored-rubric.js'
import {baselineVariant} from '@experiments/spike/variants/baseline.js'
import {haikuComicsResearchVariant} from '@experiments/spike/variants/haiku-comics-research.js'
import {multiSampleVariant} from '@experiments/spike/variants/multi-sample.js'
import {phase1FragmentsVariant} from '@experiments/spike/variants/phase1-fragments.js'
import {phase2HaikuNonComicsVariant} from '@experiments/spike/variants/phase2-haiku-non-comics.js'
import {phase2Opus47Variant} from '@experiments/spike/variants/phase2-opus-4-7.js'
import {phase2SonnetNonComicsVariant} from '@experiments/spike/variants/phase2-sonnet-non-comics.js'
import {structuredOutputVariant} from '@experiments/spike/variants/structured-output.js'
import {twoStageVariant} from '@experiments/spike/variants/two-stage.js'

/**
 * Variants 1-5 are the primary consistency comparison set.
 * Variant 6 (haiku-comics-research) is the model-tier sweep run AFTER the
 * consistency winner is picked — not included by default.
 * anchored-rubric-disjoint is a confirmatory follow-up to anchored-rubric.
 * phase1-fragments is the Phase 1 landing-verification variant (post-decomposition
 * baseline equivalent — same model, same user message, same tools, system prompt
 * assembled per-media via PromptAssembler).
 * phase2-opus-4-7 and phase2-sonnet-non-comics are the Phase 2 model-tiering
 * sub-experiment variants (full Opus 4.7 swap vs. Sonnet for non-comics).
 * phase2-haiku-non-comics is the Phase 2 follow-up: now that Sonnet shipped for
 * audio/video, can we go one tier further to Haiku 4.5?
 */
export const PRIMARY_VARIANTS: Variant[] = [
  baselineVariant,
  anchoredRubricVariant,
  twoStageVariant,
  multiSampleVariant,
  structuredOutputVariant,
]

export const ALL_VARIANTS: Variant[] = [
  ...PRIMARY_VARIANTS,
  haikuComicsResearchVariant,
  anchoredRubricDisjointVariant,
  phase1FragmentsVariant,
  phase2Opus47Variant,
  phase2SonnetNonComicsVariant,
  phase2HaikuNonComicsVariant,
]

export function variantByName(name: string): undefined | Variant {
  return ALL_VARIANTS.find((v) => v.name === name)
}
