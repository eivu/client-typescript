/**
 * Phase 1 comparison spike runner.
 *
 * Runs `baseline` + `phase1-fragments` against the standard FIXTURES set (8
 * fixtures × 3 reruns × 2 variants = 48 API calls, ~$0.72 at calibrated rates)
 * and writes the raw JSON + a quick markdown summary.
 *
 * Usage (from repo root):
 *   ANTHROPIC_API_KEY=sk-... npx tsx experiments/spike/run-phase1-comparison.ts
 *
 * Outputs:
 *   tmp/phase1-comparison.json — full raw runs (consumable by build-explorer.mjs)
 *   tmp/phase1-comparison.md   — human-readable summary
 */
import {runComparisonMain} from '@experiments/spike/run-comparison.js'

await runComparisonMain({
  banner: 'Phase 1 comparison spike',
  outputPrefix: 'phase1-comparison',
  variants: ['baseline', 'phase1-fragments'],
})
