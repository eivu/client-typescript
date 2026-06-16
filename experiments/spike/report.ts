import type {HarnessResult} from '@experiments/spike/harness.js'
import type {Fixture, SpikeCost, SpikeRun} from '@experiments/spike/types.js'

/** Per-variant summary statistics derived from raw runs. */
export type VariantSummary = {
  endToEndFailureCount: number
  endToEndFailureRate: number
  fixtureStats: FixtureStats[]
  fixturesWithLowStddev: number
  modelErrorCount: number
  name: string
  parseFailureCount: number
  parseFailureRate: number
  totalCost: SpikeCost
  totalRuns: number
}

/** Per-fixture stats within one variant. */
export type FixtureStats = {
  fixture: string
  meanRating: null | number
  ratings: Array<null | number>
  stddev: null | number
  tier: Fixture['tier']
  validRatings: number
}

const LOW_STDDEV_THRESHOLD = 0.5

/** Builds the full per-variant summary table from harness output. */
export function summarize(result: HarnessResult): VariantSummary[] {
  return result.variants.map((variant) => {
    const myRuns = result.runs.filter((r) => r.variant === variant.name)

    const fixtureStats: FixtureStats[] = result.fixtures.map((fixture) => {
      const fixtureRuns = myRuns.filter((r) => r.fixture === fixture.name)
      const ratings = fixtureRuns.map((r) => r.rating)
      const validRatings = ratings.filter((r): r is number => typeof r === 'number')

      return {
        fixture: fixture.name,
        meanRating: validRatings.length > 0 ? mean(validRatings) : null,
        ratings,
        stddev: validRatings.length >= 2 ? stddev(validRatings) : null,
        tier: fixture.tier,
        validRatings: validRatings.length,
      }
    })

    const totalRuns = myRuns.length
    const parseFailureCount = myRuns.filter((r) => r.status === 'parse_failure').length
    const validationFailureCount = myRuns.filter((r) => r.status === 'validation_failure').length
    const modelErrorCount = myRuns.filter((r) => r.status === 'model_error').length
    const endToEndFailureCount = parseFailureCount + validationFailureCount + modelErrorCount

    const totalCost = sumCostsLocal(myRuns)
    const fixturesWithLowStddev = fixtureStats.filter(
      (f) => f.stddev !== null && f.stddev <= LOW_STDDEV_THRESHOLD,
    ).length

    return {
      endToEndFailureCount,
      endToEndFailureRate: totalRuns === 0 ? 0 : endToEndFailureCount / totalRuns,
      fixtureStats,
      fixturesWithLowStddev,
      modelErrorCount,
      name: variant.name,
      parseFailureCount,
      parseFailureRate: totalRuns === 0 ? 0 : parseFailureCount / totalRuns,
      totalCost,
      totalRuns,
    }
  })
}

/** Renders the markdown report for tmp/spike-report.md. */
export function renderReport(result: HarnessResult, summaries: VariantSummary[]): string {
  const baseline = summaries.find((s) => s.name === 'baseline')
  const lines: string[] = []

  lines.push(
    '# Phase 0 Spike Report',
    '',
    `_Generated: ${new Date().toISOString()}_`,
    '',
    `**Configuration:** ${result.variants.length} variants × ${result.fixtures.length} fixtures × ${result.reruns} reruns = ${result.runs.length} runs`,
    '',
    `**Total cost:** $${result.totalCost.totalUsd.toFixed(4)} (input $${result.totalCost.inputUsd.toFixed(4)} + cached $${result.totalCost.cachedInputUsd.toFixed(4)} + output $${result.totalCost.outputUsd.toFixed(4)} + web search $${result.totalCost.webSearchUsd.toFixed(4)})`,
    '',
    '---',
    '',
    '## Summary table — variants ranked by consistency + cost + failure rate',
    '',
    '| Variant | Fixtures w/ stddev ≤ 0.5 (of ' + result.fixtures.length + ') | Mean stddev | Cost (USD) | Cost vs. baseline | Parse-fail % | End-to-end fail % |',
    '|---|---|---|---|---|---|---|',
  )

  for (const s of summaries) {
    const meanStddev = computeMeanStddev(s.fixtureStats)
    const costVsBaseline = baseline && baseline.totalCost.totalUsd > 0
      ? `${(s.totalCost.totalUsd / baseline.totalCost.totalUsd).toFixed(2)}×`
      : '—'

    lines.push(
      `| ${s.name} | ${s.fixturesWithLowStddev} | ${meanStddev === null ? '—' : meanStddev.toFixed(3)} | $${s.totalCost.totalUsd.toFixed(4)} | ${costVsBaseline} | ${(s.parseFailureRate * 100).toFixed(1)}% | ${(s.endToEndFailureRate * 100).toFixed(1)}% |`,
    )
  }

  lines.push('', '---', '', '## Decision points', '', '### 1. Consistency winner (stddev ≤ 0.5 on ≥ 6 of 8 fixtures with cost ≤ 1.5× baseline)', '')

  const minLowStddev = Math.ceil(result.fixtures.length * 0.75)
  const consistencyCandidates = summaries.filter((s) => {
    if (s.fixturesWithLowStddev < minLowStddev) return false
    if (!baseline || baseline.totalCost.totalUsd === 0) return true
    return s.totalCost.totalUsd <= 1.5 * baseline.totalCost.totalUsd
  })

  if (consistencyCandidates.length === 0) {
    lines.push('**No variant meets the consistency threshold.** Consider:', '', '- Loosening the stddev threshold (currently 0.5)', '- Loosening the cost ceiling (currently 1.5× baseline)', '- Re-running with more reruns to reduce sample noise', '')
  } else {
    lines.push('**Variants meeting the threshold:**', '')
    for (const c of consistencyCandidates) {
      lines.push(`- \`${c.name}\` — ${c.fixturesWithLowStddev}/${result.fixtures.length} low-stddev fixtures, $${c.totalCost.totalUsd.toFixed(4)}`)
    }

    lines.push('')
  }

  // Failure-rate / FallbackProfile decision
  lines.push('### 2. FallbackProfile ship/skip rule', '', 'Apply to the chosen consistency winner:', '', '- If end-to-end failure rate ≤ 5% → **do NOT ship FallbackProfile**. Pipelines use in-pipeline retry only.', '- If failure rate > 5% AND a fallback variant recovers ≥ 50% of failures → **ship FallbackProfile** per media type.', '- Otherwise → don\'t ship.', '')

  for (const s of summaries) {
    const verdict = s.endToEndFailureRate <= 0.05 ? 'NO FallbackProfile needed' : 'consider FallbackProfile + follow-up measurement'
    lines.push(`- \`${s.name}\`: end-to-end ${(s.endToEndFailureRate * 100).toFixed(1)}% → ${verdict}`)
  }

  lines.push('', '---', '', '## Per-variant detail', '')

  for (const s of summaries) {
    lines.push(`### \`${s.name}\``, '')
    const variant = result.variants.find((v) => v.name === s.name)
    if (variant) lines.push(`_${variant.description}_`, '')

    lines.push(
      '**Cost:** $' +
        s.totalCost.totalUsd.toFixed(4) +
        ` (input $${s.totalCost.inputUsd.toFixed(4)} · cached $${s.totalCost.cachedInputUsd.toFixed(4)} · output $${s.totalCost.outputUsd.toFixed(4)} · web search $${s.totalCost.webSearchUsd.toFixed(4)})`,
      '',
      `**Failure rates:** parse ${s.parseFailureCount}/${s.totalRuns} (${(s.parseFailureRate * 100).toFixed(1)}%) · model-error ${s.modelErrorCount}/${s.totalRuns} · end-to-end ${(s.endToEndFailureRate * 100).toFixed(1)}%`,
      '',
      '**Per-fixture rating consistency:**',
      '',
      '| Fixture | Tier | Ratings | Mean | Stddev |',
      '|---|---|---|---|---|',
    )

    for (const fs of s.fixtureStats) {
      const ratingStr = fs.ratings.map((r) => (r === null ? 'fail' : r.toFixed(1))).join(', ')
      const meanStr = fs.meanRating === null ? '—' : fs.meanRating.toFixed(2)
      const stddevStr = fs.stddev === null ? '—' : fs.stddev.toFixed(3)
      const stddevFlag = fs.stddev !== null && fs.stddev <= LOW_STDDEV_THRESHOLD ? ' ✓' : ''
      lines.push(`| ${fs.fixture} | ${fs.tier} | ${ratingStr} | ${meanStr} | ${stddevStr}${stddevFlag} |`)
    }

    lines.push('')
  }

  lines.push('---', '', '## Raw runs (for debugging)', '', '| Variant | Fixture | Rerun | Status | Rating | Tokens in/out (cached) | Latency (ms) | Cost |', '|---|---|---|---|---|---|---|---|')

  for (const run of result.runs) {
    const ratingStr = run.rating === null ? '—' : run.rating.toFixed(1)
    const tokensStr = `${run.usage.inputTokens}/${run.usage.outputTokens} (${run.usage.cacheReadInputTokens})`
    lines.push(
      `| ${run.variant} | ${run.fixture} | ${run.rerun} | ${run.status} | ${ratingStr} | ${tokensStr} | ${run.usage.latencyMs} | $${run.cost.totalUsd.toFixed(4)} |`,
    )
  }

  return lines.join('\n') + '\n'
}

function computeMeanStddev(fixtureStats: FixtureStats[]): null | number {
  const valid = fixtureStats.map((f) => f.stddev).filter((s): s is number => s !== null)
  if (valid.length === 0) return null
  return mean(valid)
}

function mean(values: number[]): number {
  let total = 0
  for (const v of values) total += v
  return total / values.length
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  let varianceSum = 0
  for (const v of values) varianceSum += (v - m) ** 2
  return Math.sqrt(varianceSum / (values.length - 1))
}

function sumCostsLocal(runs: SpikeRun[]): SpikeCost {
  const acc: SpikeCost = {cachedInputUsd: 0, inputUsd: 0, outputUsd: 0, totalUsd: 0, webSearchUsd: 0}
  for (const r of runs) {
    acc.cachedInputUsd += r.cost.cachedInputUsd
    acc.inputUsd += r.cost.inputUsd
    acc.outputUsd += r.cost.outputUsd
    acc.totalUsd += r.cost.totalUsd
    acc.webSearchUsd += r.cost.webSearchUsd
  }

  return acc
}
