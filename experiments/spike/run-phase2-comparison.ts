/**
 * Phase 2 model-tiering comparison spike runner.
 *
 * Runs three variants against the standard 8 fixtures × 3 reruns = 72 API
 * calls (~$0.50 calibrated):
 *   - phase1-fragments         (Opus 4.6 control, matches Phase 1 production)
 *   - phase2-opus-4-7          (full Opus 4.7 swap)
 *   - phase2-sonnet-non-comics (Sonnet 4.6 for audio/video, Opus 4.6 comics)
 *
 * Usage (from repo root):
 *   ANTHROPIC_API_KEY=sk-... npx tsx experiments/spike/run-phase2-comparison.ts
 *
 * Outputs:
 *   tmp/phase2-comparison.json — full raw runs (consumable by build-explorer.mjs)
 *   tmp/phase2-comparison.md   — standard spike report
 */
import {runComparisonMain} from '@experiments/spike/run-comparison.js'

await runComparisonMain({
  banner: 'Phase 2 model-tiering spike',
  nextSteps: ['npx tsx experiments/spike/analyze-phase2-comparison.ts'],
  outputPrefix: 'phase2-comparison',
  variants: ['phase1-fragments', 'phase2-opus-4-7', 'phase2-sonnet-non-comics'],
})
