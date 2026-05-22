import type {Variant} from '@src/ai/spike/types.js'

import {anchoredRubricVariant} from '@src/ai/spike/variants/anchored-rubric.js'
import {baselineVariant} from '@src/ai/spike/variants/baseline.js'
import {haikuComicsResearchVariant} from '@src/ai/spike/variants/haiku-comics-research.js'
import {multiSampleVariant} from '@src/ai/spike/variants/multi-sample.js'
import {structuredOutputVariant} from '@src/ai/spike/variants/structured-output.js'
import {twoStageVariant} from '@src/ai/spike/variants/two-stage.js'

/**
 * Variants 1-5 are the primary consistency comparison set.
 * Variant 6 (haiku-comics-research) is the model-tier sweep run AFTER the
 * consistency winner is picked — not included by default.
 */
export const PRIMARY_VARIANTS: Variant[] = [
  baselineVariant,
  anchoredRubricVariant,
  twoStageVariant,
  multiSampleVariant,
  structuredOutputVariant,
]

export const ALL_VARIANTS: Variant[] = [...PRIMARY_VARIANTS, haikuComicsResearchVariant]

export function variantByName(name: string): undefined | Variant {
  return ALL_VARIANTS.find((v) => v.name === name)
}
