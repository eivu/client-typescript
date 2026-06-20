/**
 * Phase 2 model-tiering comparison analysis: computes per-fixture and
 * per-variant stats from tmp/phase2-comparison.json and writes a markdown
 * decision report to tmp/phase2-comparison-analysis.md.
 *
 * Thin wrapper over the shared `analyzeComparison()` — see analyze-comparison.ts.
 * Control is `phase1-fragments` (Phase 1 production behavior); other variants
 * are compared against it.
 *
 * Usage:
 *   npx tsx experiments/spike/analyze-phase2-comparison.ts
 */
import {analyzeComparison} from '@experiments/spike/analyze-comparison.js'
import path from 'node:path'

analyzeComparison({
  artifactsLines: [
    '- Raw runs JSON: `tmp/phase2-comparison.json`',
    '- Markdown report (standard spike format): `tmp/phase2-comparison.md`',
    '- HTML explorer: `tmp/phase2-comparison-explorer.html` (run `node experiments/spike/build-explorer.mjs tmp/phase2-comparison.json tmp/phase2-comparison-explorer.html`)',
    '- Pipeline definitions: `src/ai/pipelines/`',
    '- Spike variants: `experiments/spike/variants/phase2-opus-4-7.ts` · `experiments/spike/variants/phase2-sonnet-non-comics.ts`',
  ],
  inputPath: path.join(process.cwd(), 'tmp', 'phase2-comparison.json'),
  narrativeIntro: [
    'Phase 2 introduced a `Pipeline` abstraction over the per-media assembled prompts from Phase 1 — each pipeline owns its model, system prompt, max-token budget, and web-search budget. The Phase 2 primary kept all four pipelines on Opus 4.6 (matching Phase 1 production); this sub-experiment is the model-tiering test the original plan deferred until after fragment migration landed.',
    '',
    'Three variants are compared:',
    '- **`phase1-fragments`** (control): Opus 4.6 across every media type. This is the post-Phase-1 / Phase-2-primary production behavior.',
    '- **`phase2-opus-4-7`**: full Opus 4.7 swap. Tests whether the agentic-coding-focused upgrade carries over to eivu\'s web-research-then-emit-YAML workflow. Opus 4.7 uses a new tokenizer that produces up to ~35% more tokens for the same prompt, so cost per file is expected to rise even at identical per-token pricing.',
    '- **`phase2-sonnet-non-comics`**: comics on Opus 4.6, audio/video on Sonnet 4.6. Tests whether the lighter non-comics research workflow tolerates a cheaper model. Sonnet 4.6 is $3/$15 per MTok vs Opus $5/$25 — roughly 40% cheaper per token.',
    '',
  ],
  outputPath: path.join(process.cwd(), 'tmp', 'phase2-comparison-analysis.md'),
  rerunHint: 'Run the spike first: tmp/run-phase2-spike.sh (under screen)',
  title: 'Phase 2 model-tiering comparison — analysis',
})
