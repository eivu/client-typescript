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

import {runHarness} from '@experiments/spike/harness.js'
import {renderReport, summarize} from '@experiments/spike/report.js'
import {promises as fsp} from 'node:fs'
import path from 'node:path'

const OUTPUT_DIR = path.join(process.cwd(), 'tmp')
const MARKDOWN_PATH = path.join(OUTPUT_DIR, 'phase2-haiku-comparison.md')
const JSON_PATH = path.join(OUTPUT_DIR, 'phase2-haiku-comparison.json')

const VARIANTS = ['phase1-fragments', 'phase2-sonnet-non-comics', 'phase2-haiku-non-comics']

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set — required to run the comparison spike.')
  }

  process.stdout.write('Phase 2 Haiku-for-non-comics spike — starting\n')
  process.stdout.write(`  variants:  ${VARIANTS.join(', ')}\n`)
  process.stdout.write('  fixtures:  all 8 (3 comics + 3 audio + 2 video)\n')
  process.stdout.write('  reruns:    3\n')
  process.stdout.write(`  calls:     ${VARIANTS.length * 8 * 3}\n\n`)

  const result = await runHarness({
    reruns: 3,
    variantNames: VARIANTS,
  })

  await fsp.mkdir(OUTPUT_DIR, {recursive: true})
  await fsp.writeFile(JSON_PATH, JSON.stringify(result, null, 2), 'utf8')

  const summaries = summarize(result)
  const markdown = renderReport(result, summaries)
  await fsp.writeFile(MARKDOWN_PATH, markdown, 'utf8')

  process.stdout.write('\n')
  process.stdout.write(`Spike complete. ${result.runs.length} runs · $${result.totalCost.totalUsd.toFixed(4)} calibrated.\n`)
  process.stdout.write(`JSON:     ${JSON_PATH}\n`)
  process.stdout.write(`Markdown: ${MARKDOWN_PATH}\n`)
  process.stdout.write(`\nNext:\n`)
  process.stdout.write(`  node experiments/spike/build-explorer.mjs ${JSON_PATH} tmp/phase2-haiku-comparison-explorer.html\n`)
  process.stdout.write(`  npx tsx experiments/spike/analyze-phase2-haiku-comparison.ts\n`)
}

try {
  await main()
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Spike failed: ${message}\n`)
  if (error instanceof Error && error.stack) process.stderr.write(`${error.stack}\n`)
  process.exitCode = 1
}
