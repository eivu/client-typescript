/**
 * Phase 1 content-equivalence check: compares the PromptAssembler output for
 * each media type against the equivalent slice of v7.16.4 monolith.
 *
 * Run from the repo root with:
 *   npx tsx src/ai/spike/phase1-equivalence.ts
 *
 * Exit code is 0 on equivalence (allow-listed differences only), 1 on any
 * unexpected line in either direction. The script prints a per-media-type
 * report so the gate failure is actionable.
 *
 * Equivalence definition: every non-blank, non-`---` content line that applies
 * to the given media type in v7.16.4 must appear at least once in the assembled
 * output, and every content line in the assembled output must either be in the
 * v7.16.4 slice or in the explicit ALLOW_LIST (the routing-note replacement).
 *
 * Limitations:
 *   - Whitespace within a line is preserved (so a reformatted table row would
 *     register as a diff). This is deliberate — Phase 1 is verbatim decomposition.
 *   - Heading reordering across fragments does NOT register as a diff because we
 *     compare line sets, not line sequences. That matches the cache-determinism
 *     contract: the prompt cache cares about byte stability per (media, stage),
 *     not about preserving v7.16.4's outer ordering.
 */

import {assemble, type AssemblerMediaType} from '@src/ai/prompt-assembler'
import * as fs from 'node:fs'
import path from 'node:path'

const SOURCE_PATH = path.join(
  process.cwd(),
  'src',
  'ai',
  'prompts',
  'claude',
  'EIVU_METADATA_SKILL_v7_16_4_RUNTIME.md',
)
const FRAGMENTS_ROOT = path.join(process.cwd(), 'src', 'ai', 'prompts', 'claude', 'fragments')

/**
 * Line ranges (1-based, inclusive) per media type. These mirror
 * `tmp/phase1-fragment-mapping.md` and the user-locked fragment scope.
 *
 * Violations rows aren't representable as contiguous line ranges (they're rows
 * 1, 2, ..., 6c, 11, 14, ... in a single table), so they're handled separately
 * by `extractViolationRows` below.
 */
const APPLICABLE_RANGES: Record<AssemblerMediaType, Array<[number, number]>> = {
  audio: [
    [1, 7], // header
    [21, 21], // engine-self-report
    [102, 133], // YAML§Audio
    [163, 167], // Shared Rules
    [169, 177], // Audio-Only Notes
    [238, 252], // §A Audio Tracks
    [483, 502], // §E rubric
    [519, 522], // checklist YAML universal
    [560, 564], // checklist Awards & Ratings universal
    [566, 580], // checklist Audio Files
  ],
  comics: [
    [1, 7], // header
    [21, 21], // engine-self-report
    [74, 100], // YAML§Comics
    [163, 167], // Shared Rules
    [191, 219], // §A Comics name format
    [221, 228], // §A TV Episodes
    [230, 236], // §A Movies
    [268, 289], // Season Mapping Tables
    [292, 431], // §B Characters
    [435, 453], // §C Universe Field Values
    [457, 479], // §D Award Tags
    [483, 502], // §E rubric
    [506, 513], // §F Franchise vs Publisher
    [519, 522], // checklist YAML universal
    [524, 558], // checklist Name + Characters + Comics Structure
    [560, 564], // checklist Awards & Ratings universal
  ],
  video: [
    [1, 7], // header
    [21, 21], // engine-self-report
    [135, 161], // YAML§Video
    [163, 167], // Shared Rules
    [179, 185], // Video-Only Notes
    [221, 228], // §A TV Episodes (📗🎬, duplicated in comics + video per cache decision)
    [230, 236], // §A Movies (📗🎬)
    [254, 264], // §A Video non-TV
    [483, 502], // §E rubric
    [519, 522], // checklist YAML universal
    [560, 564], // checklist Awards & Ratings universal
    [582, 589], // checklist Video Files
  ],
}

/** Violations table rows applicable per media type, by row number ("6a", "6b", "6c" are strings). */
const APPLICABLE_VIOLATIONS: Record<AssemblerMediaType, string[]> = {
  // Universal rules (7, 8, 9, 10, 12, 13, 17, 18, 19, 20, 22, 23, 24, 27, 34) apply to every media type.
  // Audio-specific rows are 29, 30, 31, 33. (Rule 29 is 🎵🎬.)
  audio: ['7', '8', '9', '10', '12', '13', '17', '18', '19', '20', '22', '23', '24', '27', '29', '30', '31', '33', '34'],
  comics: [
    '1', '2', '3', '4', '5', '6', '6a', '6b', '6c',
    '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
    '21', '22', '23', '24', '25', '26', '27', '28', '28a', '34',
  ],
  video: ['7', '8', '9', '10', '12', '13', '17', '18', '19', '20', '22', '23', '24', '27', '29', '32', '34'],
}

/** Lines in the assembled output that are NOT in v7.16.4 but are expected — the routing-note replacement. */
const ALLOW_LIST: Set<string> = new Set([
  '## ROUTING NOTE',
  'This prompt has been pre-filtered for your file type. The rules and sections below all apply to your file type — no FILE TYPE ROUTING evaluation is required, and no sections are to be skipped.',
])

/** A "content line" is any non-blank line that's not a `---` separator and not a markdown table border. */
function isContentLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed === '') return false
  if (trimmed === '---') return false
  // Markdown table separators (`|---|---|...`) carry no semantic content and vary in width across
  // tables, so collapsing them avoids spurious "table header rule" diffs.
  if (/^\|[\s|:-]+\|?$/.test(trimmed)) return false
  return true
}

function readLines(filePath: string): string[] {
  return fs.readFileSync(filePath, 'utf8').split('\n')
}

function extractApplicable(
  sourceLines: string[],
  ranges: Array<[number, number]>,
  applicableViolations: string[],
): string[] {
  const collected = new Set<string>()
  for (const [start, end] of ranges) {
    for (let i = start; i <= end; i++) {
      const line = sourceLines[i - 1] // ranges are 1-based
      if (line !== undefined && isContentLine(line)) {
        collected.add(line.trimEnd())
      }
    }
  }

  // Violations table — extract rows whose `#` column matches applicableViolations.
  for (const line of sourceLines) {
    const match = /^\|\s*([\dA-Za-z]+)\s*\|/.exec(line)
    if (match && applicableViolations.includes(match[1]) && isContentLine(line)) {
      collected.add(line.trimEnd())
    }
  }

  // Universal structural lines: violations table header, scope key, top-level H2s.
  // These appear once per assembled prompt regardless of media type.
  for (const line of sourceLines) {
    if (line.startsWith('| # | Scope | Rule')) collected.add(line.trimEnd())
    if (line.startsWith('## VIOLATIONS')) collected.add(line.trimEnd())
    if (line.startsWith('**Scope key:**')) collected.add(line.trimEnd())
    if (line.startsWith('## FINAL CHECKLIST')) collected.add(line.trimEnd())
    if (line.startsWith('## §A — NAME FIELD')) collected.add(line.trimEnd())
    if (line.startsWith('## YAML STRUCTURE')) collected.add(line.trimEnd())
  }

  return [...collected]
}

function extractAssembled(mediaType: AssemblerMediaType): Set<string> {
  const out = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType})
  const lines = out
    .split('\n')
    .filter((line) => isContentLine(line))
    .map((l) => l.trimEnd())
  return new Set(lines)
}

type DiffReport = {
  expectedNotInAssembled: string[]
  mediaType: AssemblerMediaType
  unexpectedInAssembled: string[]
}

function compareMedia(mediaType: AssemblerMediaType, sourceLines: string[]): DiffReport {
  const expected = new Set(
    extractApplicable(sourceLines, APPLICABLE_RANGES[mediaType], APPLICABLE_VIOLATIONS[mediaType]),
  )
  const assembled = extractAssembled(mediaType)

  const expectedNotInAssembled: string[] = []
  for (const line of expected) {
    if (!assembled.has(line)) expectedNotInAssembled.push(line)
  }

  const unexpectedInAssembled: string[] = []
  for (const line of assembled) {
    if (expected.has(line)) continue
    if (ALLOW_LIST.has(line)) continue
    unexpectedInAssembled.push(line)
  }

  return {expectedNotInAssembled, mediaType, unexpectedInAssembled}
}

function printReport(report: DiffReport): void {
  const heading = `=== ${report.mediaType.toUpperCase()} ===`
  process.stdout.write(`\n${heading}\n`)
  if (report.expectedNotInAssembled.length === 0 && report.unexpectedInAssembled.length === 0) {
    process.stdout.write('OK — assembled output matches the v7.16.4 slice.\n')
    return
  }

  if (report.expectedNotInAssembled.length > 0) {
    process.stdout.write(`MISSING from assembled (${report.expectedNotInAssembled.length} lines):\n`)
    for (const line of report.expectedNotInAssembled) {
      process.stdout.write(`  - ${line}\n`)
    }
  }

  if (report.unexpectedInAssembled.length > 0) {
    process.stdout.write(`EXTRA in assembled (${report.unexpectedInAssembled.length} lines):\n`)
    for (const line of report.unexpectedInAssembled) {
      process.stdout.write(`  + ${line}\n`)
    }
  }
}

function main(): number {
  if (!fs.existsSync(SOURCE_PATH)) {
    process.stderr.write(`Source not found: ${SOURCE_PATH}\n`)
    return 2
  }

  const sourceLines = readLines(SOURCE_PATH)
  const reports: DiffReport[] = (['comics', 'audio', 'video'] as const).map((mediaType) =>
    compareMedia(mediaType, sourceLines),
  )

  for (const report of reports) printReport(report)

  const hasDiff = reports.some(
    (r) => r.expectedNotInAssembled.length > 0 || r.unexpectedInAssembled.length > 0,
  )
  process.stdout.write(`\n${hasDiff ? 'FAIL' : 'PASS'} — Phase 1 content-equivalence check\n`)
  return hasDiff ? 1 : 0
}

process.exitCode = main()
