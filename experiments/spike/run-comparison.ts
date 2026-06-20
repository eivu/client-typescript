/**
 * Shared comparison-spike driver. The `run-phase1-comparison`,
 * `run-phase2-comparison`, and `run-phase2-haiku-comparison` scripts are thin
 * wrappers that call `runComparison()` with their variant list, output prefix,
 * and banner. Everything else — the API-key guard, the standard 8-fixture × N-rerun
 * harness call, writing the JSON + markdown report, and the completion summary —
 * is identical and lives here.
 *
 * Intentionally `tsx`-runnable (no dist/ build needed); the production CLI path is
 * `bin/run.js test:spike`.
 */
import {runHarness} from '@experiments/spike/harness.js'
import {renderReport, summarize} from '@experiments/spike/report.js'
import {promises as fsp} from 'node:fs'
import path from 'node:path'

export type ComparisonConfig = {
  /** Banner printed at the top of the run, e.g. 'Phase 1 comparison spike'. */
  banner: string
  /**
   * Extra `Next:` follow-up command lines (e.g. the matching `analyze-*` script).
   * The `build-explorer` line is always printed; these are appended after it.
   */
  nextSteps?: string[]
  /** Output basename: writes `tmp/<outputPrefix>.json` and `tmp/<outputPrefix>.md`. */
  outputPrefix: string
  /** Reruns per (variant × fixture). Defaults to 3. */
  reruns?: number
  /** Variant names to run, in report order. */
  variants: string[]
}

const OUTPUT_DIR = path.join(process.cwd(), 'tmp')

/** Runs one comparison spike end-to-end. Throws if `ANTHROPIC_API_KEY` is unset. */
export async function runComparison(config: ComparisonConfig): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set — required to run the comparison spike.')
  }

  const reruns = config.reruns ?? 3
  const jsonPath = path.join(OUTPUT_DIR, `${config.outputPrefix}.json`)
  const markdownPath = path.join(OUTPUT_DIR, `${config.outputPrefix}.md`)

  process.stdout.write(`${config.banner} — starting\n`)
  process.stdout.write(`  variants:  ${config.variants.join(', ')}\n`)
  process.stdout.write('  fixtures:  all 8 (3 comics + 3 audio + 2 video)\n')
  process.stdout.write(`  reruns:    ${reruns}\n`)
  process.stdout.write(`  calls:     ${config.variants.length * 8 * reruns} (8 × ${reruns} × ${config.variants.length})\n\n`)

  const result = await runHarness({reruns, variantNames: config.variants})

  await fsp.mkdir(OUTPUT_DIR, {recursive: true})
  await fsp.writeFile(jsonPath, JSON.stringify(result, null, 2), 'utf8')

  const summaries = summarize(result)
  await fsp.writeFile(markdownPath, renderReport(result, summaries), 'utf8')

  process.stdout.write('\n')
  process.stdout.write(`Spike complete. ${result.runs.length} runs · $${result.totalCost.totalUsd.toFixed(4)} total.\n`)
  process.stdout.write(`JSON:     ${jsonPath}\n`)
  process.stdout.write(`Markdown: ${markdownPath}\n`)
  process.stdout.write('\nNext:\n')
  process.stdout.write(`  node experiments/spike/build-explorer.mjs ${jsonPath} tmp/${config.outputPrefix}-explorer.html\n`)
  for (const line of config.nextSteps ?? []) {
    process.stdout.write(`  ${line}\n`)
  }
}

/** Wraps `runComparison` with the standard error-reporting + exit-code handling. */
export async function runComparisonMain(config: ComparisonConfig): Promise<void> {
  try {
    await runComparison(config)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`Spike failed: ${message}\n`)
    if (error instanceof Error && error.stack) process.stderr.write(`${error.stack}\n`)
    process.exitCode = 1
  }
}
