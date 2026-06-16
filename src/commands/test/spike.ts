import type {Fixture} from '@experiments/spike/types.js'

import {FIXTURES} from '@experiments/spike/fixtures.js'
import {runHarness} from '@experiments/spike/harness.js'
import {renderReport, summarize} from '@experiments/spike/report.js'
import {ALL_VARIANTS, PRIMARY_VARIANTS} from '@experiments/spike/variants/index.js'
import {Command, Flags} from '@oclif/core'
import {getMediaCategory} from '@src/ai/base-agent.js'
import logger from '@src/logger.js'
import {promises as fsp, readFileSync} from 'node:fs'
import path from 'node:path'

/**
 * Phase 0 measurement spike — internal command.
 *
 * Runs `variants × fixtures × reruns` of the metadata-rating pipeline, captures
 * per-call usage and timing, computes per-variant rating-consistency (stddev),
 * cost, parse-failure rate, and end-to-end failure rate, and writes a report
 * to `tmp/spike-report.md`.
 *
 * Defaults: 5 primary variants × 8 fixtures × 3 reruns = 120 API calls
 * (variant 4 = multi-sample adds another 2×24 = 48 calls; total ≈ 168).
 *
 * Use `--fixtures` / `--variants` to constrain the matrix (e.g. for a 1-fixture
 * smoke test). Use `--reruns=1` to halve the cost during smoke runs.
 */
export default class TestSpike extends Command {
  static override description = 'Runs the Phase 0 metadata-pipeline consistency spike. Internal use.'
static override examples = [
    '<%= config.bin %> <%= command.id %> --list',
    '<%= config.bin %> <%= command.id %> --fixtures obscure-comic-werewolf-001 --variants baseline --reruns 1',
    '<%= config.bin %> <%= command.id %> --filenames-file tmp/my-comics.txt --variants anchored-rubric --reruns 1',
    '<%= config.bin %> <%= command.id %>',
  ]
static override flags = {
    'filenames-file': Flags.string({
      description:
        'Path to a text file with one filename per line. Each becomes an ad-hoc fixture (category auto-detected by extension). Overrides --fixtures.',
    }),
    fixtures: Flags.string({
      description: 'Comma-separated fixture names to run (default: all 8). Use --list to see options.',
      multiple: false,
    }),
    list: Flags.boolean({default: false, description: 'List available fixtures and variants and exit.'}),
    output: Flags.string({
      default: path.join('tmp', 'spike-report.md'),
      description: 'Output path for the markdown report.',
    }),
    reruns: Flags.integer({
      default: 3,
      description: 'Reruns per (variant × fixture). Default 3 per Phase 0 spec.',
    }),
    variants: Flags.string({
      description: 'Comma-separated variant names to run (default: 5 primary variants).',
      multiple: false,
    }),
  }
static override hidden = true

  public async run(): Promise<void> {
    const {flags} = await this.parse(TestSpike)

    if (flags.list) {
      this.printList()
      return
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      this.error('ANTHROPIC_API_KEY is not set — required to run the spike.')
    }

    const fixtureNames = flags.fixtures?.split(',').map((s) => s.trim()).filter(Boolean)
    const variantNames = flags.variants?.split(',').map((s) => s.trim()).filter(Boolean)

    // Ad-hoc fixtures from a file (one filename per line). De-duplicates exact
    // duplicates so the user can paste a list that may contain repeats.
    let customFixtures: Fixture[] | undefined
    const filenamesFile = flags['filenames-file']
    if (filenamesFile) {
      const raw = readFileSync(filenamesFile, 'utf8')
      const seen = new Set<string>()
      const uniqueFilenames: string[] = []
      for (const line of raw.split('\n')) {
        const f = line.trim().replace(/^\*\s+/, '')
        if (!f || f.startsWith('#') || seen.has(f)) continue
        seen.add(f)
        uniqueFilenames.push(f)
      }

      customFixtures = uniqueFilenames.map((filename, i) => {
        const detected = getMediaCategory(filename)
        const category: 'audio' | 'comic' | 'video' = detected === 'other' ? 'comic' : detected
        return {
          category,
          expectation: 'Ad-hoc user-provided fixture.',
          filename,
          name: `adhoc-${String(i + 1).padStart(2, '0')}-${filename.replaceAll(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`,
          tier: 'mid-tier' as const,
        }
      })
      this.log(`Loaded ${customFixtures.length} ad-hoc fixtures from ${filenamesFile}`)
    }

    const result = await runHarness({
      ...(customFixtures ? {customFixtures} : {}),
      ...(fixtureNames ? {fixtureNames} : {}),
      reruns: flags.reruns,
      ...(variantNames ? {variantNames} : {}),
    })

    const summaries = summarize(result)
    const markdown = renderReport(result, summaries)

    const outputPath = path.resolve(flags.output)
    await fsp.mkdir(path.dirname(outputPath), {recursive: true})
    await fsp.writeFile(outputPath, markdown, 'utf8')

    // Also persist raw runs as JSON for follow-up analysis.
    const jsonPath = outputPath.replace(/\.md$/, '.json')
    await fsp.writeFile(jsonPath, JSON.stringify(result, null, 2), 'utf8')

    logger.info({jsonPath, outputPath, runs: result.runs.length, totalUsd: result.totalCost.totalUsd.toFixed(4)}, 'Spike report written')

    this.log('')
    this.log(`Spike complete. ${result.runs.length} runs · $${result.totalCost.totalUsd.toFixed(4)} total.`)
    this.log(`Report: ${outputPath}`)
    this.log(`Raw runs: ${jsonPath}`)
  }

   
  private printList(): void {
    this.log('Available fixtures:')
    for (const f of FIXTURES) {
      this.log(`  ${f.name.padEnd(40)}  [${f.category}, ${f.tier}]`)
      if (f.expectation) this.log(`    ${f.expectation}`)
    }

    this.log('')
    this.log('Available variants:')
    for (const v of ALL_VARIANTS) {
      const isPrimary = PRIMARY_VARIANTS.some((p) => p.name === v.name)
      this.log(`  ${v.name.padEnd(28)}  ${isPrimary ? '[primary]' : '[post-winner sweep]'}`)
      this.log(`    ${v.description}`)
    }
  }
}
