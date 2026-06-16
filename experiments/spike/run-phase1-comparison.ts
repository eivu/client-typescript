/**
 * Phase 1 comparison spike runner.
 *
 * Runs `baseline` + `phase1-fragments` against the standard FIXTURES set (8
 * fixtures × 3 reruns × 2 variants = 48 API calls, ~$0.72 at calibrated rates)
 * and writes the raw JSON + a quick markdown summary. Intentionally a
 * `tsx`-runnable standalone script so we don't have to `npm run build` to run
 * the spike — the production CLI command is `bin/run.js test:spike`, but that
 * path requires a dist/ rebuild.
 *
 * Usage (from repo root):
 *   ANTHROPIC_API_KEY=sk-... npx tsx experiments/spike/run-phase1-comparison.ts
 *
 * Outputs:
 *   tmp/phase1-comparison.json — full raw runs (consumable by build-explorer.mjs)
 *   tmp/phase1-comparison.md   — human-readable summary
 */

import {runHarness} from '@experiments/spike/harness.js'
import {renderReport, summarize} from '@experiments/spike/report.js'
import {promises as fsp} from 'node:fs'
import path from 'node:path'

const OUTPUT_DIR = path.join(process.cwd(), 'tmp')
const MARKDOWN_PATH = path.join(OUTPUT_DIR, 'phase1-comparison.md')
const JSON_PATH = path.join(OUTPUT_DIR, 'phase1-comparison.json')

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set — required to run the comparison spike.')
  }

  process.stdout.write('Phase 1 comparison spike — starting\n')
  process.stdout.write('  variants:  baseline, phase1-fragments\n')
  process.stdout.write('  fixtures:  all 8 (3 comics + 3 audio + 2 video)\n')
  process.stdout.write('  reruns:    3\n')
  process.stdout.write('  calls:     48 (8 × 3 × 2)\n\n')

  const result = await runHarness({
    reruns: 3,
    variantNames: ['baseline', 'phase1-fragments'],
  })

  await fsp.mkdir(OUTPUT_DIR, {recursive: true})
  await fsp.writeFile(JSON_PATH, JSON.stringify(result, null, 2), 'utf8')

  const summaries = summarize(result)
  const markdown = renderReport(result, summaries)
  await fsp.writeFile(MARKDOWN_PATH, markdown, 'utf8')

  process.stdout.write('\n')
  process.stdout.write(`Spike complete. ${result.runs.length} runs · $${result.totalCost.totalUsd.toFixed(4)} total (pre-calibration).\n`)
  process.stdout.write(`JSON:     ${JSON_PATH}\n`)
  process.stdout.write(`Markdown: ${MARKDOWN_PATH}\n`)
  process.stdout.write(`\nNext:     node experiments/spike/build-explorer.mjs ${JSON_PATH} tmp/phase1-comparison-explorer.html\n`)
}

try {
  await main()
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Spike failed: ${message}\n`)
  if (error instanceof Error && error.stack) process.stderr.write(`${error.stack}\n`)
  process.exitCode = 1
}
