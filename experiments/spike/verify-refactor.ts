/**
 * Refactor regression gate: compares a pre-refactor spike snapshot against a
 * post-refactor one and asserts every fixture's behavior is within tolerance.
 *
 * Used by the per-phase spike gates for Phase B.4 / B.5 / B.6 and by the final
 * Phase E end-to-end check. See `docs/refactor-plan.md` → "Per-phase spike gates".
 *
 * Run from the repo root with:
 *   npx tsx experiments/spike/verify-refactor.ts \
 *     --pre  tmp/refactor-baseline.json \
 *     --post tmp/phase1-comparison.json
 *
 * Defaults: --pre tmp/refactor-baseline.json, --post tmp/refactor-verification.json,
 * --variant phase1-fragments (the variant that exercises the production assembled-prompt
 * path). Both files are spike comparison JSONs as written by `run-phase1-comparison.ts`.
 *
 * Tolerance (per fixture — all must hold for a PASS):
 *   |Δmean rating|        ≤ 0.25   (half a rating step)
 *   |Δstddev|             ≤ 0.05
 *    parse-failure delta  =  0
 *   |Δmean web-searches| / pre ≤ 0.30  (30%; skipped when pre mean is 0)
 *
 * These are deliberately looser than statistical equivalence because production
 * data is non-deterministic (web-search results drift day to day). Exit code is
 * 0 on PASS, 1 on any per-fixture regression, 2 on a usage error (missing file).
 */
import * as fs from 'node:fs'

const TOLERANCE = {
  meanRating: 0.25,
  stddev: 0.05,
  webSearchRatio: 0.3,
} as const

/** One run row from the spike comparison JSON (only the fields this gate reads). */
type SpikeRun = {
  fixture: string
  rating: null | number
  status: string
  usage: {webSearchRequests: number}
  variant: string
}

type SpikeReport = {
  runs: SpikeRun[]
}

/** Aggregated per-fixture stats for one side (pre or post). */
type FixtureStats = {
  meanRating: number
  meanWebSearches: number
  parseFailures: number
  ratingCount: number
  stddev: number
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0
  const m = mean(values)
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)))
}

/**
 * Group a variant's runs by fixture and compute per-fixture stats. A run with a
 * null rating (or a non-success status) counts as a parse failure and is excluded
 * from rating mean/stddev — matching how the analyze scripts treat unparseable runs.
 */
function statsByFixture(report: SpikeReport, variant: string): Map<string, FixtureStats> {
  const byFixture = new Map<string, SpikeRun[]>()
  for (const run of report.runs) {
    if (run.variant !== variant) continue
    const list = byFixture.get(run.fixture) ?? []
    list.push(run)
    byFixture.set(run.fixture, list)
  }

  const out = new Map<string, FixtureStats>()
  for (const [fixture, runs] of byFixture) {
    const parsed = runs.filter((r) => r.status === 'success' && r.rating !== null)
    const ratings = parsed.map((r) => r.rating as number)
    out.set(fixture, {
      meanRating: mean(ratings),
      meanWebSearches: mean(runs.map((r) => r.usage?.webSearchRequests ?? 0)),
      parseFailures: runs.length - parsed.length,
      ratingCount: ratings.length,
      stddev: stddev(ratings),
    })
  }

  return out
}

function loadReport(label: string, filePath: string): SpikeReport {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} snapshot not found: ${filePath}`)
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as SpikeReport
}

type AxisResult = {
  axis: string
  delta: string
  ok: boolean
  post: string
  pre: string
}

/** Compute the four tolerance axes for one fixture. */
function evaluateFixture(pre: FixtureStats, post: FixtureStats): AxisResult[] {
  const dMean = post.meanRating - pre.meanRating
  const dStddev = post.stddev - pre.stddev
  const dFail = post.parseFailures - pre.parseFailures
  const dWeb = post.meanWebSearches - pre.meanWebSearches
  // When the pre web-search mean is 0, a ratio is undefined; treat any increase as
  // out of tolerance and an unchanged 0 as fine.
  const webRatio = pre.meanWebSearches === 0 ? (dWeb === 0 ? 0 : Infinity) : Math.abs(dWeb) / pre.meanWebSearches

  return [
    {
      axis: 'mean rating',
      delta: dMean.toFixed(3),
      ok: Math.abs(dMean) <= TOLERANCE.meanRating,
      post: post.meanRating.toFixed(3),
      pre: pre.meanRating.toFixed(3),
    },
    {
      axis: 'stddev',
      delta: dStddev.toFixed(3),
      ok: Math.abs(dStddev) <= TOLERANCE.stddev,
      post: post.stddev.toFixed(3),
      pre: pre.stddev.toFixed(3),
    },
    {
      axis: 'parse failures',
      delta: String(dFail),
      ok: dFail === 0,
      post: String(post.parseFailures),
      pre: String(pre.parseFailures),
    },
    {
      axis: 'mean web-searches',
      delta: `${dWeb.toFixed(2)} (${(webRatio * 100).toFixed(0)}%)`,
      ok: webRatio <= TOLERANCE.webSearchRatio,
      post: post.meanWebSearches.toFixed(2),
      pre: pre.meanWebSearches.toFixed(2),
    },
  ]
}

/** Minimal `--flag value` reader (avoids node:util.parseArgs, unstable on Node 18). */
function readFlag(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`)
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : fallback
}

function main(): number {
  const prePath = readFlag('pre', 'tmp/refactor-baseline.json')
  const postPath = readFlag('post', 'tmp/refactor-verification.json')
  const variant = readFlag('variant', 'phase1-fragments')

  let preReport: SpikeReport
  let postReport: SpikeReport
  try {
    preReport = loadReport('pre', prePath)
    postReport = loadReport('post', postPath)
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`)
    return 2
  }

  const preStats = statsByFixture(preReport, variant)
  const postStats = statsByFixture(postReport, variant)

  if (preStats.size === 0) {
    process.stderr.write(`No runs for variant "${variant}" in ${prePath}\n`)
    return 2
  }

  process.stdout.write(`Refactor verification — variant "${variant}"\n`)
  process.stdout.write(`  pre:  ${prePath}\n`)
  process.stdout.write(`  post: ${postPath}\n\n`)

  const fixtures = [...preStats.keys()].sort()
  let failed = false

  for (const fixture of fixtures) {
    const pre = preStats.get(fixture)
    const post = postStats.get(fixture)
    if (!post) {
      process.stdout.write(`✗ ${fixture}: MISSING from post snapshot\n`)
      failed = true
      continue
    }

    const axes = evaluateFixture(pre as FixtureStats, post)
    const fixtureOk = axes.every((a) => a.ok)
    if (!fixtureOk) failed = true

    process.stdout.write(`${fixtureOk ? '✓' : '✗'} ${fixture}\n`)
    if (!fixtureOk) {
      for (const a of axes) {
        if (a.ok) continue
        process.stdout.write(`    ${a.axis}: pre=${a.pre} post=${a.post} Δ=${a.delta}  OUT OF TOLERANCE\n`)
      }
    }
  }

  process.stdout.write(`\n${failed ? 'FAIL' : 'PASS'} — refactor verification\n`)
  return failed ? 1 : 0
}

process.exitCode = main()
