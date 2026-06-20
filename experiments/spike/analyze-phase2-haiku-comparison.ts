/**
 * Phase 2 Haiku-for-non-comics analysis: computes per-fixture and per-variant
 * stats from tmp/phase2-haiku-comparison.json and writes a markdown decision
 * report to tmp/phase2-haiku-comparison-analysis.md.
 *
 * Thin wrapper over the shared `analyzeComparison()` — see analyze-comparison.ts.
 * Control is again `phase1-fragments` (Opus 4.6 across the board). Other variants
 * are `phase2-sonnet-non-comics` (re-baselining the prior decision) and
 * `phase2-haiku-non-comics` (the new candidate).
 *
 * Usage:
 *   npx tsx experiments/spike/analyze-phase2-haiku-comparison.ts
 */
import {analyzeComparison} from '@experiments/spike/analyze-comparison.js'
import path from 'node:path'

analyzeComparison({
  artifactsLines: [
    '- Raw runs JSON: `tmp/phase2-haiku-comparison.json`',
    '- Markdown report (standard spike format): `tmp/phase2-haiku-comparison.md`',
    '- HTML explorer: `tmp/phase2-haiku-comparison-explorer.html` (run `node experiments/spike/build-explorer.mjs tmp/phase2-haiku-comparison.json tmp/phase2-haiku-comparison-explorer.html`)',
    '- Pipeline definitions: `src/ai/pipelines/`',
    '- Spike variant: `experiments/spike/variants/phase2-haiku-non-comics.ts`',
    '- Prior sub-experiment analysis: `tmp/phase2-comparison-analysis.md`',
  ],
  inputPath: path.join(process.cwd(), 'tmp', 'phase2-haiku-comparison.json'),
  narrativeIntro: [
    'Phase 2 landed Sonnet 4.6 for audio + video (2026-05-28) after the prior model-tiering sub-experiment confirmed non-comics media tolerates the lighter model. This follow-up tests whether non-comics can go one tier further to Haiku 4.5 — another ~3× cost cut if it holds, but with notably weaker reasoning capacity.',
    '',
    'Three variants are compared:',
    '- **`phase1-fragments`** (control): Opus 4.6 across every media type. Pre-Sonnet-swap baseline; lets us check that the Sonnet-vs-Opus delta from the prior run is reproducible.',
    '- **`phase2-sonnet-non-comics`**: comics on Opus 4.6, audio/video on Sonnet 4.6. Current production behavior (since 2026-05-28). Included as a re-baseline so Anthropic-side drift between runs surfaces here rather than getting mis-attributed to Haiku.',
    '- **`phase2-haiku-non-comics`** (new): comics on Opus 4.6, audio/video on Haiku 4.5. Haiku is $1/$5 per MTok vs Sonnet $3/$15 — roughly 3× cheaper than Sonnet per token. The risk is the same as the Sonnet test (rating stability under web-research workflows) but with a wider gap from the control model.',
    '',
  ],
  outputPath: path.join(process.cwd(), 'tmp', 'phase2-haiku-comparison-analysis.md'),
  rerunHint: 'Run the spike first: npx tsx experiments/spike/run-phase2-haiku-comparison.ts',
  title: 'Phase 2 Haiku-for-non-comics — analysis',
})
