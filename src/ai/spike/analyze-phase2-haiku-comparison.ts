/**
 * Phase 2 Haiku-for-non-comics analysis: computes per-fixture and per-variant
 * stats from tmp/phase2-haiku-comparison.json and writes a markdown decision
 * report to tmp/phase2-haiku-comparison-analysis.md.
 *
 * Same structure as `analyze-phase2-comparison.ts`; control is again
 * `phase1-fragments` (Opus 4.6 across the board). Other variants are
 * `phase2-sonnet-non-comics` (re-baselining the prior decision) and
 * `phase2-haiku-non-comics` (the new candidate).
 *
 * Usage:
 *   npx tsx src/ai/spike/analyze-phase2-haiku-comparison.ts
 */

import type {SpikeRun} from '@src/ai/spike/types.js'

import * as fs from 'node:fs'
import path from 'node:path'

const INPUT_PATH = path.join(process.cwd(), 'tmp', 'phase2-haiku-comparison.json')
const OUTPUT_PATH = path.join(process.cwd(), 'tmp', 'phase2-haiku-comparison-analysis.md')

const CONTROL_VARIANT = 'phase1-fragments'

type HarnessJson = {
  fixtures: Array<{category: string; expectation?: string; filename: string; name: string; tier: string}>
  reruns: number
  runs: SpikeRun[]
  totalCost: {totalUsd: number}
  variants: Array<{description: string; name: string}>
}

type PerFixtureRow = {
  controlMean: null | number
  controlRatings: Array<null | number>
  controlStddev: null | number
  fixture: string
  variantStats: Map<string, {mean: null | number; ratings: Array<null | number>; shift: null | number; stddev: null | number}>
}

type VariantAggregate = {
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

function fmtSigned(n: number, decimals = 2): string {
  return (n > 0 ? '+' : '') + n.toFixed(decimals)
}

function fmtRatings(ratings: Array<null | number>): string {
  return ratings.map((r) => (r === null ? 'fail' : r.toFixed(1))).join(', ')
}

function fmtCost(usd: number): string {
  return `$${usd.toFixed(4)}`
}

function collectRatings(runs: SpikeRun[], variantName: string, fixtureName: string): Array<null | number> {
  return runs
    .filter((r) => r.variant === variantName && r.fixture === fixtureName)
    .sort((a, b) => a.rerun - b.rerun)
    .map((r) => r.rating)
}

function buildPerFixtureRows(data: HarnessJson, otherVariants: string[]): PerFixtureRow[] {
  return data.fixtures.map((fixture): PerFixtureRow => {
    const controlRatings = collectRatings(data.runs, CONTROL_VARIANT, fixture.name)
    const controlNumeric = controlRatings.filter((r): r is number => r !== null)
    const controlMean = mean(controlNumeric)
    const controlStddev = stddev(controlNumeric)

    const variantStats = new Map<string, {mean: null | number; ratings: Array<null | number>; shift: null | number; stddev: null | number}>()
    for (const variantName of otherVariants) {
      const ratings = collectRatings(data.runs, variantName, fixture.name)
      const numeric = ratings.filter((r): r is number => r !== null)
      const m = mean(numeric)
      const s = stddev(numeric)
      const shift = controlMean !== null && m !== null ? m - controlMean : null
      variantStats.set(variantName, {mean: m, ratings, shift, stddev: s})
    }

    return {
      controlMean,
      controlRatings,
      controlStddev,
      fixture: fixture.name,
      variantStats,
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
    meanStddev: mean(perFixtureStddevs),
    modelErrors: variantRuns.filter((r) => r.status === 'model_error').length,
    parseFailures: variantRuns.filter((r) => r.status === 'parse_failure').length,
    totalCostUsd,
    totalRuns: variantRuns.length,
    variantName,
  }
}

function buildHeader(data: HarnessJson): string[] {
  const date = new Date().toISOString().slice(0, 10)
  return [
    '# Phase 2 Haiku-for-non-comics — analysis',
    '',
    `_Generated: ${date} · ${data.runs.length} runs · ${fmtCost(data.totalCost.totalUsd)} calibrated_`,
    '',
  ]
}

function buildTldr(rows: PerFixtureRow[], control: VariantAggregate, others: VariantAggregate[]): string[] {
  const lines = ['## TL;DR', '']

  lines.push(
    `Control variant: \`${control.variantName}\` (mean per-fixture stddev: ${fmtNum(control.meanStddev, 3)}, total cost: ${fmtCost(control.totalCostUsd)}).`,
    '',
  )

  for (const v of others) {
    const stddevDelta = v.meanStddev !== null && control.meanStddev !== null ? v.meanStddev - control.meanStddev : null
    const costRatio = control.totalCostUsd > 0 ? v.totalCostUsd / control.totalCostUsd : null

    const stddevVerb = stddevDelta === null
      ? '(no comparable data)'
      : Math.abs(stddevDelta) < 0.005
        ? 'matches control'
        : stddevDelta > 0
          ? `is ${stddevDelta.toFixed(3)} HIGHER than control`
          : `is ${Math.abs(stddevDelta).toFixed(3)} LOWER than control`
    const costVerb = costRatio === null
      ? '(no cost data)'
      : Math.abs(costRatio - 1) < 0.05
        ? 'within 5% of control'
        : costRatio > 1
          ? `${((costRatio - 1) * 100).toFixed(0)}% MORE expensive than control`
          : `${((1 - costRatio) * 100).toFixed(0)}% CHEAPER than control`

    const failureFlag = v.parseFailures > 0 || v.modelErrors > 0
      ? ` · ⚠️ ${v.parseFailures} parse failure(s), ${v.modelErrors} model error(s)`
      : ''

    lines.push(`- **\`${v.variantName}\`**: stddev ${stddevVerb}, cost ${costVerb}${failureFlag}.`)
  }

  lines.push('', `_Comparison is per-fixture against \`${CONTROL_VARIANT}\` (8 fixtures × 3 reruns each)._`, '')

  return lines
}

function buildSummaryTable(rows: PerFixtureRow[], control: VariantAggregate, others: VariantAggregate[]): string[] {
  const lines = [
    '## Summary table',
    '',
    '| Variant | Fixtures w/ stddev ≤ 0.5 | Mean stddev | Total cost | Cost vs. control | Parse failures | Model errors |',
    '|---|---|---|---|---|---|---|',
  ]

  const allVariants = [control, ...others]
  const totalFixtures = rows.length

  for (const v of allVariants) {
    const ratio = control.totalCostUsd > 0 && v !== control ? v.totalCostUsd / control.totalCostUsd : null
    const ratioStr = v === control ? '1.00× (control)' : ratio === null ? '—' : `${ratio.toFixed(2)}×`
    const stddevsUnderHalf = countFixturesWithStddevUnder(rows, v.variantName, 0.5)
    lines.push(
      `| \`${v.variantName}\` | ${stddevsUnderHalf}/${totalFixtures} | ${fmtNum(v.meanStddev, 3)} | ${fmtCost(v.totalCostUsd)} | ${ratioStr} | ${v.parseFailures} | ${v.modelErrors} |`,
    )
  }

  lines.push('', `Calibration source: \`EMPIRICAL_BILLING_FACTOR\` in [src/ai/cost.ts](../src/ai/cost.ts) — 0.0667, derived from the 2026-05-21 dashboard comparison rebased on corrected Opus 4.6 posted rates ($5/$25 MTok).`, '')
  return lines
}

function countFixturesWithStddevUnder(rows: PerFixtureRow[], variantName: string, cap: number): number {
  let count = 0
  for (const row of rows) {
    if (variantName === CONTROL_VARIANT) {
      if (row.controlStddev !== null && row.controlStddev <= cap) count++
    } else {
      const s = row.variantStats.get(variantName)
      if (s?.stddev !== null && s?.stddev !== undefined && s.stddev <= cap) count++
    }
  }

  return count
}

function buildPerFixtureTable(rows: PerFixtureRow[], otherVariants: string[]): string[] {
  const headerCols = ['Fixture', 'Control ratings', 'Control σ']
  for (const v of otherVariants) {
    headerCols.push(`${v} ratings`, `${v} σ`, `Δmean`)
  }

  const lines = [
    '## Per-fixture rating consistency',
    '',
    `| ${headerCols.join(' | ')} |`,
    `| ${headerCols.map(() => '---').join(' | ')} |`,
  ]

  for (const row of rows) {
    const cells = [row.fixture, fmtRatings(row.controlRatings), fmtNum(row.controlStddev, 3)]
    for (const v of otherVariants) {
      const s = row.variantStats.get(v)
      cells.push(
        s ? fmtRatings(s.ratings) : '—',
        s ? fmtNum(s.stddev, 3) : '—',
        s?.shift === null || s?.shift === undefined ? '—' : fmtSigned(s.shift),
      )
    }

    lines.push(`| ${cells.join(' | ')} |`)
  }

  lines.push('')
  return lines
}

function buildCostBreakdown(control: VariantAggregate, others: VariantAggregate[], reruns: number): string[] {
  const lines = [
    '## Cost breakdown',
    '',
    '| Variant | Total cost | Per-call avg | Per-fixture avg (3 reruns) |',
    '|---|---|---|---|',
  ]

  for (const v of [control, ...others]) {
    const perCall = v.totalRuns > 0 ? v.totalCostUsd / v.totalRuns : 0
    const perFixture = perCall * reruns
    lines.push(`| \`${v.variantName}\` | ${fmtCost(v.totalCostUsd)} | ${fmtCost(perCall)} | ${fmtCost(perFixture)} |`)
  }

  lines.push('')
  return lines
}

function buildNarrative(rows: PerFixtureRow[], control: VariantAggregate, others: VariantAggregate[]): string[] {
  const lines = [
    '## Narrative',
    '',
    'Phase 2 landed Sonnet 4.6 for audio + video (2026-05-28) after the prior model-tiering sub-experiment confirmed non-comics media tolerates the lighter model. This follow-up tests whether non-comics can go one tier further to Haiku 4.5 — another ~3× cost cut if it holds, but with notably weaker reasoning capacity.',
    '',
    'Three variants are compared:',
    '- **`phase1-fragments`** (control): Opus 4.6 across every media type. Pre-Sonnet-swap baseline; lets us check that the Sonnet-vs-Opus delta from the prior run is reproducible.',
    '- **`phase2-sonnet-non-comics`**: comics on Opus 4.6, audio/video on Sonnet 4.6. Current production behavior (since 2026-05-28). Included as a re-baseline so Anthropic-side drift between runs surfaces here rather than getting mis-attributed to Haiku.',
    '- **`phase2-haiku-non-comics`** (new): comics on Opus 4.6, audio/video on Haiku 4.5. Haiku is $1/$5 per MTok vs Sonnet $3/$15 — roughly 3× cheaper than Sonnet per token. The risk is the same as the Sonnet test (rating stability under web-research workflows) but with a wider gap from the control model.',
    '',
  ]

  // Per-variant verdicts
  for (const v of others) {
    const stddevDelta = v.meanStddev !== null && control.meanStddev !== null ? v.meanStddev - control.meanStddev : null
    const costRatio = control.totalCostUsd > 0 ? v.totalCostUsd / control.totalCostUsd : 0
    const maxShift = Math.max(
      ...rows.map((r) => {
        const s = r.variantStats.get(v.variantName)
        return s?.shift === null || s?.shift === undefined ? 0 : Math.abs(s.shift)
      }),
      0,
    )

    const stddevDirection = stddevDelta === null
      ? 'inconclusive'
      : Math.abs(stddevDelta) < 0.02
        ? 'flat'
        : stddevDelta > 0
          ? 'WORSE consistency'
          : 'BETTER consistency'

    const costNote = costRatio > 1.1
      ? `+${((costRatio - 1) * 100).toFixed(0)}% more expensive`
      : costRatio < 0.9
        ? `${((1 - costRatio) * 100).toFixed(0)}% cheaper`
        : `roughly flat on cost`

    const failureNote = v.parseFailures > 0 || v.modelErrors > 0
      ? ` Output reliability concern: ${v.parseFailures} parse failures, ${v.modelErrors} model errors.`
      : ' Output reliability matches control.'

    const shiftNote = maxShift > 1
      ? ` ⚠️ At least one fixture shifted by more than 1.0 rubric step from control — investigate before promoting this variant.`
      : maxShift > 0.5
        ? ` One or more fixtures shifted by 0.5+ rubric steps from control.`
        : ' All per-fixture rating means are within 0.5 step of control.'

    lines.push(
      `**\`${v.variantName}\`** — ${stddevDirection} (Δσ = ${stddevDelta === null ? '—' : fmtSigned(stddevDelta, 3)}), ${costNote}.${failureNote}${shiftNote}`,
      '',
    )
  }

  return lines
}

function buildRecommendation(rows: PerFixtureRow[], control: VariantAggregate, others: VariantAggregate[]): string[] {
  const lines = ['## Recommendation', '']

  for (const v of others) {
    const stddevDelta = v.meanStddev !== null && control.meanStddev !== null ? v.meanStddev - control.meanStddev : null
    const costRatio = control.totalCostUsd > 0 ? v.totalCostUsd / control.totalCostUsd : 0
    const maxShift = Math.max(
      ...rows.map((r) => {
        const s = r.variantStats.get(v.variantName)
        return s?.shift === null || s?.shift === undefined ? 0 : Math.abs(s.shift)
      }),
      0,
    )

    const failed = v.parseFailures > 0 || v.modelErrors > 0
    const stddevBad = stddevDelta !== null && stddevDelta > 0.05
    const shiftBad = maxShift > 1
    const consistencyOk = !stddevBad && !shiftBad && !failed
    const costBeneficial = costRatio < 0.9

    let verdict: string
    if (!consistencyOk) {
      verdict = `❌ **Do not adopt.** Consistency or reliability deltas exceed the noise floor.`
    } else if (costBeneficial && consistencyOk) {
      verdict = `✅ **Adopt.** Matches control on consistency, saves ${((1 - costRatio) * 100).toFixed(0)}% on cost.`
    } else if (consistencyOk && costRatio > 1.1) {
      verdict = `⚠️ **Adopt only if quality matters more than cost.** Matches control on consistency but costs ${((costRatio - 1) * 100).toFixed(0)}% more.`
    } else {
      verdict = `🔵 **Neutral — keep control.** No meaningful cost or quality difference.`
    }

    lines.push(`- **\`${v.variantName}\`**: ${verdict}`)
  }

  lines.push('')
  return lines
}

function buildArtifacts(): string[] {
  return [
    '## Artifacts',
    '',
    '- Raw runs JSON: `tmp/phase2-haiku-comparison.json`',
    '- Markdown report (standard spike format): `tmp/phase2-haiku-comparison.md`',
    '- HTML explorer: `tmp/phase2-haiku-comparison-explorer.html` (run `node src/ai/spike/build-explorer.mjs tmp/phase2-haiku-comparison.json tmp/phase2-haiku-comparison-explorer.html`)',
    '- Pipeline definitions: `src/ai/pipelines/`',
    '- Spike variant: `src/ai/spike/variants/phase2-haiku-non-comics.ts`',
    '- Prior sub-experiment analysis: `tmp/phase2-comparison-analysis.md`',
    '',
  ]
}

function buildMarkdown(data: HarnessJson, rows: PerFixtureRow[], control: VariantAggregate, others: VariantAggregate[]): string {
  const otherVariantNames = others.map((v) => v.variantName)
  return [
    ...buildHeader(data),
    ...buildTldr(rows, control, others),
    ...buildSummaryTable(rows, control, others),
    ...buildPerFixtureTable(rows, otherVariantNames),
    ...buildCostBreakdown(control, others, data.reruns),
    ...buildNarrative(rows, control, others),
    ...buildRecommendation(rows, control, others),
    ...buildArtifacts(),
  ].join('\n')
}

function main(): void {
  if (!fs.existsSync(INPUT_PATH)) {
    process.stderr.write(`Input not found: ${INPUT_PATH}\n`)
    process.stderr.write('Run the spike first: npx tsx src/ai/spike/run-phase2-haiku-comparison.ts\n')
    process.exitCode = 2
    return
  }

  const data = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8')) as HarnessJson
  const variantNames = [...new Set(data.runs.map((r) => r.variant))]
  if (!variantNames.includes(CONTROL_VARIANT)) {
    process.stderr.write(`Control variant '${CONTROL_VARIANT}' not found in JSON. Variants present: ${variantNames.join(', ')}\n`)
    process.exitCode = 2
    return
  }

  const otherVariantNames = variantNames.filter((v) => v !== CONTROL_VARIANT)
  const rows = buildPerFixtureRows(data, otherVariantNames)
  const control = aggregateVariant(data, CONTROL_VARIANT)
  const others = otherVariantNames.map((v) => aggregateVariant(data, v))

  const markdown = buildMarkdown(data, rows, control, others)
  fs.writeFileSync(OUTPUT_PATH, markdown, 'utf8')

  process.stdout.write(`Analysis written to ${OUTPUT_PATH}\n`)
}

main()
