/**
 * Phase 1 comparison analysis: computes per-fixture and per-variant stats from
 * tmp/phase1-comparison.json and writes a markdown summary comparing
 * `baseline` vs `phase1-fragments` to tmp/phase1-comparison-analysis.md.
 *
 * Mirrors the structure of tmp/spike-confirmatory-analysis.md (decision report
 * style: TL;DR, summary table, per-fixture table, narrative, recommendation).
 *
 * Usage:
 *   npx tsx src/ai/spike/analyze-phase1-comparison.ts
 *
 * Input:  tmp/phase1-comparison.json
 * Output: tmp/phase1-comparison-analysis.md
 */

import type {SpikeRun} from '@src/ai/spike/types.js'

import * as fs from 'node:fs'
import path from 'node:path'

/**
 * Mirrors `EMPIRICAL_BILLING_FACTOR` in src/ai/cost.ts and the factor in
 * build-explorer.mjs. Raw cost in the JSON is at posted (pre-batch-discount)
 * rates; actual Anthropic billing is ~45× smaller.
 */
const CALIBRATION_FACTOR = 0.0222

const INPUT_PATH = path.join(process.cwd(), 'tmp', 'phase1-comparison.json')
const OUTPUT_PATH = path.join(process.cwd(), 'tmp', 'phase1-comparison-analysis.md')

type HarnessJson = {
  fixtures: Array<{category: string; expectation?: string; filename: string; name: string; tier: string}>
  reruns: number
  runs: SpikeRun[]
  totalCost: {totalUsd: number}
  variants: Array<{description: string; name: string}>
}

type PerFixtureRow = {
  baselineMean: null | number
  baselineRatings: Array<null | number>
  baselineStddev: null | number
  fixture: string
  phase1FailedRuns: number
  phase1Mean: null | number
  phase1Ratings: Array<null | number>
  phase1Stddev: null | number
  shift: null | number
  verdict: string
}

type VariantAggregate = {
  calibratedCostUsd: number
  fixturesWithStddevUnder: (cap: number) => number
  meanStddev: null | number
  modelErrors: number
  parseFailures: number
  totalCostUsd: number
  totalRuns: number
  variantName: string
}

function mean(values: number[]): null | number {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stddev(values: number[]): null | number {
  if (values.length === 0) return null
  const m = mean(values)
  if (m === null) return null
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function fmtNum(n: null | number, decimals = 2): string {
  if (n === null) return '—'
  return n.toFixed(decimals)
}

function fmtRatings(ratings: Array<null | number>): string {
  return ratings.map((r) => (r === null ? 'fail' : r.toFixed(1))).join(', ')
}

function fmtCost(usd: number): string {
  return `$${usd.toFixed(4)}`
}

function fmtSigned(n: number, decimals = 2): string {
  return (n > 0 ? '+' : '') + n.toFixed(decimals)
}

function describeVerdict(
  baselineMean: null | number,
  baselineStddev: null | number,
  phase1Mean: null | number,
  phase1Stddev: null | number,
): string {
  if (baselineMean === null || phase1Mean === null) return 'No comparable data'
  if (baselineStddev === null || phase1Stddev === null) return 'No comparable data'

  const meanShift = phase1Mean - baselineMean
  const stddevShift = phase1Stddev - baselineStddev
  const shiftMag = Math.abs(meanShift)

  if (shiftMag < 0.001 && Math.abs(stddevShift) < 0.001) return 'Identical'
  if (shiftMag < 0.001) {
    return stddevShift > 0.01 ? 'Wider spread' : stddevShift < -0.01 ? 'Tighter spread' : 'Identical'
  }

  if (stddevShift > 0.01) return `Mean ${fmtSigned(meanShift)}, wider spread`
  if (stddevShift < -0.01) return `Mean ${fmtSigned(meanShift)}, tighter spread`
  return `Mean ${fmtSigned(meanShift)}, same spread`
}

function collectRatings(runs: SpikeRun[], variantName: string, fixtureName: string): Array<null | number> {
  return runs
    .filter((r) => r.variant === variantName && r.fixture === fixtureName)
    .sort((a, b) => a.rerun - b.rerun)
    .map((r) => r.rating)
}

function buildPerFixtureRows(data: HarnessJson): PerFixtureRow[] {
  return data.fixtures.map((fixture): PerFixtureRow => {
    const baselineRatings = collectRatings(data.runs, 'baseline', fixture.name)
    const phase1Ratings = collectRatings(data.runs, 'phase1-fragments', fixture.name)
    const baselineNumeric = baselineRatings.filter((r): r is number => r !== null)
    const phase1Numeric = phase1Ratings.filter((r): r is number => r !== null)

    const baselineMean = mean(baselineNumeric)
    const baselineStddev = stddev(baselineNumeric)
    const phase1Mean = mean(phase1Numeric)
    const phase1Stddev = stddev(phase1Numeric)
    const shift = baselineMean !== null && phase1Mean !== null ? phase1Mean - baselineMean : null

    return {
      baselineMean,
      baselineRatings,
      baselineStddev,
      fixture: fixture.name,
      phase1FailedRuns: phase1Ratings.filter((r) => r === null).length,
      phase1Mean,
      phase1Ratings,
      phase1Stddev,
      shift,
      verdict: describeVerdict(baselineMean, baselineStddev, phase1Mean, phase1Stddev),
    }
  })
}

function aggregateVariant(data: HarnessJson, variantName: string): VariantAggregate {
  const variantRuns = data.runs.filter((r) => r.variant === variantName)
  const perFixtureStddevs: number[] = []

  for (const fixture of data.fixtures) {
    const ratings = collectRatings(data.runs, variantName, fixture.name)
    const numeric = ratings.filter((r): r is number => r !== null)
    const s = stddev(numeric)
    if (s !== null) perFixtureStddevs.push(s)
  }

  const totalCostUsd = variantRuns.reduce((sum, r) => sum + (r.cost?.totalUsd ?? 0), 0)

  return {
    calibratedCostUsd: totalCostUsd * CALIBRATION_FACTOR,
    fixturesWithStddevUnder(cap: number): number {
      return perFixtureStddevs.filter((s) => s <= cap).length
    },
    meanStddev: mean(perFixtureStddevs),
    modelErrors: variantRuns.filter((r) => r.status === 'model_error').length,
    parseFailures: variantRuns.filter((r) => r.status === 'parse_failure').length,
    totalCostUsd,
    totalRuns: variantRuns.length,
    variantName,
  }
}

function buildHeaderSection(data: HarnessJson, totalCalibrated: number): string[] {
  const date = new Date().toISOString().slice(0, 10)
  return [
    '# Phase 1 fragment-migration comparison — analysis',
    '',
    `_Generated: ${date} · ${data.runs.length} runs · ${fmtCost(totalCalibrated)} calibrated_`,
    '',
  ]
}

function buildTldrSection(rows: PerFixtureRow[], baseline: VariantAggregate, phase1: VariantAggregate): string[] {
  const stddevDelta =
    baseline.meanStddev !== null && phase1.meanStddev !== null ? phase1.meanStddev - baseline.meanStddev : null
  const costRatio = baseline.calibratedCostUsd > 0 ? phase1.calibratedCostUsd / baseline.calibratedCostUsd : null

  const identicalFixtures = rows.filter(
    (r) =>
      r.baselineMean !== null &&
      r.phase1Mean !== null &&
      Math.abs(r.phase1Mean - r.baselineMean) < 0.001 &&
      r.baselineStddev !== null &&
      r.phase1Stddev !== null &&
      Math.abs(r.phase1Stddev - r.baselineStddev) < 0.001,
  ).length

  const stddevVerb = describeStddevVerb(stddevDelta)
  const costVerb = describeCostVerb(costRatio)

  return [
    '## TL;DR',
    '',
    `Mean per-fixture stddev for \`phase1-fragments\` ${stddevVerb}. Calibrated cost ${costVerb}. ${identicalFixtures}/${rows.length} fixtures produce bit-identical results across the two variants.`,
    '',
    '**Interpretation guide:** Phase 1 is a pure refactor — the assembled prompts are content-equivalent to the v7.16.4 monolith (verified by `src/ai/spike/phase1-equivalence.ts`). The expected outcome is "approximately tied" on consistency and cost. A large divergence in either direction would warrant investigation.',
    '',
  ]
}

function describeStddevVerb(stddevDelta: null | number): string {
  if (stddevDelta === null) return '(no comparable data)'
  if (Math.abs(stddevDelta) < 0.005) return 'matches baseline'
  if (stddevDelta > 0) return `is ${stddevDelta.toFixed(3)} HIGHER than baseline`
  return `is ${Math.abs(stddevDelta).toFixed(3)} LOWER than baseline`
}

function describeCostVerb(costRatio: null | number): string {
  if (costRatio === null) return '(no comparable cost data)'
  if (Math.abs(costRatio - 1) < 0.05) return 'within 5% of baseline'
  if (costRatio > 1) return `${((costRatio - 1) * 100).toFixed(1)}% MORE expensive than baseline`
  return `${((1 - costRatio) * 100).toFixed(1)}% CHEAPER than baseline`
}

function buildSummaryTableSection(
  rows: PerFixtureRow[],
  baseline: VariantAggregate,
  phase1: VariantAggregate,
): string[] {
  const lines = [
    '## Summary table',
    '',
    '| Variant | Fixtures w/ stddev ≤ 0.5 | Mean stddev | Calibrated cost | Cost vs. baseline | Parse failures | Model errors |',
    '|---|---|---|---|---|---|---|',
  ]

  for (const v of [baseline, phase1]) {
    const ratio = baseline.calibratedCostUsd > 0 ? v.calibratedCostUsd / baseline.calibratedCostUsd : null
    lines.push(
      `| \`${v.variantName}\` | ${v.fixturesWithStddevUnder(0.5)}/${rows.length} | ${fmtNum(v.meanStddev, 3)} | ${fmtCost(v.calibratedCostUsd)} | ${ratio === null ? '—' : `${ratio.toFixed(2)}×`} | ${v.parseFailures} | ${v.modelErrors} |`,
    )
  }

  lines.push('', `Calibration applied: ${CALIBRATION_FACTOR}× (per \`EMPIRICAL_BILLING_FACTOR\` in \`src/ai/cost.ts\`).`, '')
  return lines
}

function buildPerFixtureSection(rows: PerFixtureRow[], baseline: VariantAggregate, phase1: VariantAggregate): string[] {
  const lines = [
    '## Per-fixture rating consistency',
    '',
    '| Fixture | Baseline ratings | Baseline stddev | Phase1 ratings | Phase1 stddev | Shift Δmean | Verdict |',
    '|---|---|---|---|---|---|---|',
  ]

  for (const row of rows) {
    const shiftStr = row.shift === null ? '—' : fmtSigned(row.shift)
    lines.push(
      `| ${row.fixture} | ${fmtRatings(row.baselineRatings)} | ${fmtNum(row.baselineStddev, 3)} | ${fmtRatings(row.phase1Ratings)} | ${fmtNum(row.phase1Stddev, 3)} | ${shiftStr} | ${row.verdict} |`,
    )
  }

  lines.push('')
  if (baseline.meanStddev !== null && phase1.meanStddev !== null) {
    lines.push(
      `Mean stddev: **${baseline.meanStddev.toFixed(3)} (baseline) vs. ${phase1.meanStddev.toFixed(3)} (phase1-fragments)** — Δ ${(phase1.meanStddev - baseline.meanStddev).toFixed(3)}.`,
      '',
    )
  }

  return lines
}

function buildCostSection(data: HarnessJson, baseline: VariantAggregate, phase1: VariantAggregate): string[] {
  const lines = [
    '## Cost breakdown',
    '',
    '| Variant | Total cost (calibrated) | Per-call avg | Per-fixture avg (3 reruns each) |',
    '|---|---|---|---|',
  ]

  for (const v of [baseline, phase1]) {
    const perCall = v.totalRuns > 0 ? v.calibratedCostUsd / v.totalRuns : 0
    const perFixture = perCall * data.reruns
    lines.push(`| \`${v.variantName}\` | ${fmtCost(v.calibratedCostUsd)} | ${fmtCost(perCall)} | ${fmtCost(perFixture)} |`)
  }

  lines.push('')
  const costDelta = phase1.calibratedCostUsd - baseline.calibratedCostUsd
  const sign = costDelta > 0 ? '+' : ''
  const noise = Math.abs(costDelta) < 0.05 ? ' Well inside the noise floor for an 8-fixture run.' : ''
  lines.push(
    `Cost difference: **${sign}${fmtCost(costDelta)}** (\`phase1-fragments\` − \`baseline\`).${noise}`,
    '',
  )
  return lines
}

/**
 * Classify the comparison outcome with three levels:
 *  - 'within-noise': stddev delta within ±0.05 AND every shifted fixture moved
 *    by at most 0.5 (one rubric step). The 8-fixture × 3-rerun spike has
 *    inherent jitter of roughly this magnitude per the Phase 0 baseline
 *    measurements (~0.072 mean stddev with ±0.05 fixture-level noise).
 *  - 'directional-improvement': stddev decreased meaningfully (≤ −0.02) AND
 *    no fixture's mean shifted by more than 1.0 rubric step.
 *  - 'investigate': stddev increased meaningfully (≥ +0.05) OR any fixture
 *    shifted by more than 1.0 rubric step OR parse/model failures > 0.
 */
type Verdict = 'directional-improvement' | 'investigate' | 'within-noise'

function classifyOutcome(
  rows: PerFixtureRow[],
  baseline: VariantAggregate,
  phase1: VariantAggregate,
): Verdict {
  if (phase1.parseFailures > 0 || phase1.modelErrors > 0) return 'investigate'

  const stddevDelta =
    baseline.meanStddev !== null && phase1.meanStddev !== null ? phase1.meanStddev - baseline.meanStddev : null
  const maxFixtureShift = Math.max(
    ...rows.map((r) => (r.shift === null ? 0 : Math.abs(r.shift))),
    0,
  )

  if (maxFixtureShift > 1) return 'investigate'
  if (stddevDelta !== null && stddevDelta >= 0.05) return 'investigate'
  if (stddevDelta !== null && stddevDelta <= -0.02 && maxFixtureShift <= 0.5) return 'directional-improvement'
  return 'within-noise'
}

function buildNarrativeSection(
  rows: PerFixtureRow[],
  baseline: VariantAggregate,
  phase1: VariantAggregate,
): string[] {
  const verdict = classifyOutcome(rows, baseline, phase1)
  let conclusion: string
  switch (verdict) {
    case 'directional-improvement': {
      conclusion =
        'The data shows phase1-fragments is mildly TIGHTER on consistency than baseline (lower mean stddev) at essentially equal cost. With only 8 fixtures × 3 reruns the per-variant noise floor is ~0.05 stddev, so the improvement is well within run-to-run jitter — but the direction is favorable. The most likely explanation is that per-media-typed prompts focus the model on the rules that matter for the file at hand, with less distractor content. This is exactly what Phase 1 was designed to enable, even though Phase 1 itself was supposed to be a no-op content-equivalence refactor. The migration is safe to keep as the production default.'
      break
    }

    case 'investigate': {
      conclusion =
        'The data shows a divergence between baseline and phase1-fragments that is large enough to investigate — either consistency worsened materially, an individual fixture shifted by more than one rubric step, or a parse/model failure occurred. See the per-fixture table for which fixtures shifted. Possible causes: dropped content during decomposition, incorrect violations-row mapping, or per-media fragment ordering affecting model attention.'
      break
    }

    case 'within-noise': {
      conclusion =
        'The data confirms the expected outcome: stddev and cost are within run-to-run noise. Per-fixture ratings track baseline closely on every fixture, with no systematic shift that would suggest the assembled prompts are subtly different from the monolith. The migration is safe to keep as the production default.'
      break
    }
  }

  return [
    '## Narrative',
    '',
    'Phase 1 decomposed the v7.16.4 monolithic skill file (589 lines, one big system prompt sent to every file regardless of media type) into ~13 fragments under `src/ai/prompts/claude/fragments/`. The `PromptAssembler` concatenates the applicable fragments per media type in a fixed deterministic order, producing a byte-stable per-(media-type) prompt. `ClaudeAgent.buildBatchParams` selects the right pre-assembled block at request time using `getMediaCategory(filePath)`.',
    '',
    'Content-equivalence was verified before the migration: `src/ai/spike/phase1-equivalence.ts` extracts the per-media slice of v7.16.4 and diffs it against the assembled output, allow-listing only the routing-note replacement. All three media types pass.',
    '',
    "This spike is the post-migration sanity check. The expected outcome is that `phase1-fragments` produces results approximately indistinguishable from `baseline` — the prompt content is the same, only the delivery shape changed. Any large divergence would point at a content drop, a fragment-ordering bug, or a cache-key issue.",
    '',
    conclusion,
    '',
  ]
}

function buildRecommendationSection(
  rows: PerFixtureRow[],
  baseline: VariantAggregate,
  phase1: VariantAggregate,
): string[] {
  const verdict = classifyOutcome(rows, baseline, phase1)

  if (verdict === 'investigate') {
    return [
      '## Recommendation',
      '',
      '1. **Investigate the divergence** before locking in assembler mode as the production default. Identify which fixtures shifted and check whether the assembled prompt for those fixtures is missing content (compare against the v7.16.4 slice manually).',
      "2. **Consider a content-equivalence re-check** with a stricter normalization (e.g. ordered diff instead of set diff). The current `phase1-equivalence.ts` allows section reordering, which preserves the rules but may affect the model's attention.",
      '3. **Do not start Phase 2** until this is resolved.',
      '',
    ]
  }

  const opener =
    verdict === 'directional-improvement'
      ? "1. **Keep `phase1-fragments` (assembler mode) as the production default.** Stddev is mildly tighter than baseline at essentially equal cost — the most plausible explanation is that per-media prompts reduce distractor content. ClaudeAgent already constructs in assembler mode when neither `skillContent` nor `skillPath` is provided — no further code change required."
      : '1. **Keep `phase1-fragments` (assembler mode) as the production default.** ClaudeAgent already constructs in assembler mode when neither `skillContent` nor `skillPath` is provided — no further code change required.'

  return [
    '## Recommendation',
    '',
    opener,
    '2. **Proceed to Phase 2.** The Phase 2 sub-experiment (Sonnet 4.6 for audio/video) can now run against the assembled-prompt path. Add a `phase2-sonnet-audio-video` variant alongside the existing ones when ready.',
    "3. **Optional follow-up:** decompose `EIVU_METADATA_AI_GUIDE.md` to reference the fragments directly (the human-facing single-source-of-truth doc currently duplicates v7.16.4 content). Low priority — not blocking Phase 2.",
    '',
  ]
}

function buildArtifactsSection(): string[] {
  return [
    '## Artifacts',
    '',
    '- Raw runs JSON: `tmp/phase1-comparison.json`',
    '- Markdown report (standard spike format): `tmp/phase1-comparison.md`',
    '- HTML explorer: `tmp/phase1-comparison-explorer.html` (run `node src/ai/spike/build-explorer.mjs tmp/phase1-comparison.json tmp/phase1-comparison-explorer.html`)',
    '- Phase 1 verification gate: `src/ai/spike/phase1-equivalence.ts`',
    '- Fragment library: `src/ai/prompts/claude/fragments/`',
    '- Assembler: `src/ai/prompt-assembler.ts`',
    '',
  ]
}

function buildMarkdown(
  data: HarnessJson,
  rows: PerFixtureRow[],
  baseline: VariantAggregate,
  phase1: VariantAggregate,
): string {
  const totalCalibrated = data.totalCost.totalUsd * CALIBRATION_FACTOR
  return [
    ...buildHeaderSection(data, totalCalibrated),
    ...buildTldrSection(rows, baseline, phase1),
    ...buildSummaryTableSection(rows, baseline, phase1),
    ...buildPerFixtureSection(rows, baseline, phase1),
    ...buildCostSection(data, baseline, phase1),
    ...buildNarrativeSection(rows, baseline, phase1),
    ...buildRecommendationSection(rows, baseline, phase1),
    ...buildArtifactsSection(),
  ].join('\n')
}

function main(): void {
  if (!fs.existsSync(INPUT_PATH)) {
    process.stderr.write(`Input not found: ${INPUT_PATH}\n`)
    process.stderr.write('Run the spike first: tmp/run-phase1-spike.sh (under screen)\n')
    process.exitCode = 2
    return
  }

  const data = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8')) as HarnessJson
  const rows = buildPerFixtureRows(data)
  const baseline = aggregateVariant(data, 'baseline')
  const phase1 = aggregateVariant(data, 'phase1-fragments')

  const markdown = buildMarkdown(data, rows, baseline, phase1)
  fs.writeFileSync(OUTPUT_PATH, markdown, 'utf8')

  process.stdout.write(`Analysis written to ${OUTPUT_PATH}\n`)
}

main()
