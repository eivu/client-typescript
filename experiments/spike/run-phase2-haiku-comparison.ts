/**
 * Phase 2 Haiku-for-non-comics comparison spike runner.
 *
 * Runs three variants against the standard 8 fixtures × 3 reruns = 72 API
 * calls (~$0.97 calibrated):
 *   - phase1-fragments          (Opus 4.6 control, matches Phase 1 production)
 *   - phase2-sonnet-non-comics  (Sonnet 4.6 for audio/video, Opus 4.6 comics — current production)
 *   - phase2-haiku-non-comics   (Haiku 4.5 for audio/video, Opus 4.6 comics)
 *
 * The Sonnet re-baseline is included so any Anthropic-side drift between
 * the prior Phase 2 run (2026-05-26) and this one shows up as a control shift
 * rather than getting mis-attributed to Haiku.
 *
 * Usage (from repo root):
 *   ANTHROPIC_API_KEY=sk-... npx tsx experiments/spike/run-phase2-haiku-comparison.ts
 *
 * Outputs:
 *   tmp/phase2-haiku-comparison.json — full raw runs (consumable by build-explorer.mjs)
 *   tmp/phase2-haiku-comparison.md   — standard spike report
 */
import {runComparisonMain} from '@experiments/spike/run-comparison.js'

await runComparisonMain({
  banner: 'Phase 2 Haiku-for-non-comics spike',
  nextSteps: ['npx tsx experiments/spike/analyze-phase2-haiku-comparison.ts'],
  outputPrefix: 'phase2-haiku-comparison',
  variants: ['phase1-fragments', 'phase2-sonnet-non-comics', 'phase2-haiku-non-comics'],
})
