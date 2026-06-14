import {Args, Command, Flags} from '@oclif/core'
import {DEFAULT_TELEMETRY_LOG_PATH, TELEMETRY_COLUMNS, type TelemetryRow} from '@src/ai/telemetry'
import * as fastCsv from 'fast-csv'
import * as fs from 'node:fs'

const MAX_FILE_ROWS = 20

type ParsedRow = TelemetryRow

type PipelineSummary = {
  costUsd: number
  count: number
  totalTokens: number
  totalWebSearches: number
}

type FileSummary = {
  attempts: number
  costUsd: number
  file: string
  finalStatus: TelemetryRow['status']
  model: string
  pipeline: string
}

/**
 * Reads + parses the telemetry CSV at `logPath`. Exported for tests so they can
 * verify rows round-trip through the writer (`telemetry.ts`) → reader without
 * going through the oclif command surface.
 */
export async function readTelemetryRows(logPath: string): Promise<TelemetryRow[]> {
  return GenerateMetadataReport.readRows(logPath)
}

/**
 * Renders the run report. Exported for tests so they can call this directly
 * with hand-crafted rows + assert on the resulting string.
 */
export function renderRunReport(runId: string, runRows: TelemetryRow[], logPath: string): string {
  return GenerateMetadataReport.renderReport(runId, runRows, logPath)
}

export default class GenerateMetadataReport extends Command {
  static override aliases = ['gm:report']
  static override args = {
    runId: Args.string({
      description: 'the run UUID to report on (omit or pass --latest for the most recent run)',
      required: false,
    }),
  }
  static override description = 'Summarize a run of gm:ai using the logs/metadata-runs.csv telemetry log'
  static override examples = [
    '<%= config.bin %> <%= command.id %> 1234abcd-...',
    '<%= config.bin %> <%= command.id %> --latest',
  ]
  static override flags = {
    latest: Flags.boolean({
      default: false,
      description: 'show the most recent run (default when runId is omitted)',
    }),
    log: Flags.string({
      default: DEFAULT_TELEMETRY_LOG_PATH,
      description: 'path to the telemetry CSV (default logs/metadata-runs.csv)',
    }),
  }

  public static byPipeline(runRows: ParsedRow[]): Map<string, PipelineSummary> {
    const summary = new Map<string, PipelineSummary>()
    for (const row of runRows) {
      const entry = summary.get(row.pipeline) ?? {costUsd: 0, count: 0, totalTokens: 0, totalWebSearches: 0}
      entry.count += 1
      entry.costUsd += row.costUsd
      entry.totalTokens += row.tokensIn + row.tokensOut
      entry.totalWebSearches += row.webSearches
      summary.set(row.pipeline, entry)
    }

    return summary
  }

  public static formatTable(headers: string[], rows: string[][]): string {
    if (rows.length === 0) return ''
    const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]?.length ?? 0)))
    const sep = '  '
    const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join(sep)
    const dataLines = rows.map((r) => r.map((cell, i) => (cell ?? '').padEnd(widths[i])).join(sep))
    return [headerLine, ...dataLines].join('\n')
  }

  public static latestRunId(rows: ParsedRow[]): string {
    // Rows are appended in time order, so the last runId in the file is the latest.
    return rows.at(-1)!.runId
  }

  public static parseRow(cells: string[]): ParsedRow {
    const get = (col: keyof TelemetryRow): string => cells[TELEMETRY_COLUMNS.indexOf(col)] ?? ''
    const status = get('status') as TelemetryRow['status']
    return {
      attempt: Number(get('attempt')),
      cachedInputTokens: Number(get('cachedInputTokens')),
      cacheWriteTokens: Number(get('cacheWriteTokens')),
      costUsd: Number(get('costUsd')),
      file: get('file'),
      latencyMs: Number(get('latencyMs')),
      model: get('model'),
      pipeline: get('pipeline'),
      runId: get('runId'),
      stage: Number(get('stage')),
      status,
      timestamp: get('timestamp'),
      tokensIn: Number(get('tokensIn')),
      tokensOut: Number(get('tokensOut')),
      validationCodes: get('validationCodes'),
      webSearches: Number(get('webSearches')),
    }
  }

  public static async readRows(logPath: string): Promise<ParsedRow[]> {
    const content = await fs.promises.readFile(logPath, 'utf8')
    const cellRows: string[][] = await new Promise((resolve, reject) => {
      const acc: string[][] = []
      fastCsv
        .parseString(content, {headers: false})
        .on('data', (row: string[]) => acc.push(row))
        .on('end', () => resolve(acc))
        .on('error', reject)
    })
    // Accept rows missing the trailing Phase 3 `validationCodes` column so
    // pre-Phase-3 telemetry still parses; `parseRow` reads via `get()` which
    // returns '' for missing cells (the no-validation-issue default).
    return cellRows
      .filter((r) => r.length >= TELEMETRY_COLUMNS.length - 1)
      .map((r) => GenerateMetadataReport.parseRow(r))
  }

  public static renderReport(runId: string, runRows: ParsedRow[], logPath: string): string {
    const fileSummaries = GenerateMetadataReport.summarizeFiles(runRows)
    const totalFiles = fileSummaries.length
    const succeeded = fileSummaries.filter((s) => s.finalStatus === 'success').length
    const failed = totalFiles - succeeded
    const totalTokens = runRows.reduce((acc, r) => acc + r.tokensIn + r.tokensOut, 0)
    const totalCost = runRows.reduce((acc, r) => acc + r.costUsd, 0)

    const summary =
      `Run ${runId} · ${totalFiles} files · ${succeeded} succeeded · ${failed} failed · ` +
      `${totalTokens.toLocaleString()} total tokens · $${totalCost.toFixed(4)} calibrated`

    const pipelineTable = GenerateMetadataReport.formatTable(
      ['pipeline', 'count', 'cost', 'avg_tokens', 'avg_web_searches'],
      [...GenerateMetadataReport.byPipeline(runRows).entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, s]) => [
          name,
          String(s.count),
          `$${s.costUsd.toFixed(4)}`,
          (s.totalTokens / s.count).toFixed(0),
          (s.totalWebSearches / s.count).toFixed(1),
        ]),
    )

    const fileRowsToShow = fileSummaries.slice(0, MAX_FILE_ROWS).map((s) => [
      s.file,
      s.pipeline,
      s.model,
      String(s.attempts),
      s.finalStatus,
      `$${s.costUsd.toFixed(4)}`,
    ])
    const fileTable = GenerateMetadataReport.formatTable(
      ['file', 'pipeline', 'model', 'attempts', 'status', 'cost'],
      fileRowsToShow,
    )
    const truncationNote =
      fileSummaries.length > MAX_FILE_ROWS ? `\n… and ${fileSummaries.length - MAX_FILE_ROWS} more` : ''

    return [
      summary,
      '',
      'Per pipeline:',
      pipelineTable,
      '',
      'Files:',
      fileTable + truncationNote,
      '',
      `See ${logPath} for the full data.`,
    ].join('\n')
  }

  public static summarizeFiles(runRows: ParsedRow[]): FileSummary[] {
    // Track the highest-attempt row per file so summary status reflects the
    // final outcome regardless of row order in the CSV.
    const byFile = new Map<string, FileSummary & {finalAttempt: number}>()
    for (const row of runRows) {
      const entry = byFile.get(row.file)
      if (!entry) {
        byFile.set(row.file, {
          attempts: 1,
          costUsd: row.costUsd,
          file: row.file,
          finalAttempt: row.attempt,
          finalStatus: row.status,
          model: row.model,
          pipeline: row.pipeline,
        })
        continue
      }

      entry.attempts += 1
      entry.costUsd += row.costUsd
      if (row.attempt >= entry.finalAttempt) {
        entry.finalAttempt = row.attempt
        entry.finalStatus = row.status
        entry.model = row.model
        entry.pipeline = row.pipeline
      }
    }

    return [...byFile.values()]
      .map(({finalAttempt: _, ...rest}) => rest)
      .sort((a, b) => a.file.localeCompare(b.file))
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(GenerateMetadataReport)

    if (!fs.existsSync(flags.log)) {
      this.error(`Telemetry log not found: ${flags.log}. Run \`eivu gm:ai\` first to generate metadata.`)
    }

    const rows = await GenerateMetadataReport.readRows(flags.log)
    if (rows.length === 0) {
      this.log(`No telemetry rows found in ${flags.log}.`)
      return
    }

    const targetRunId = args.runId ?? GenerateMetadataReport.latestRunId(rows)
    const runRows = rows.filter((r) => r.runId === targetRunId)
    if (runRows.length === 0) {
      this.error(
        `No rows found for run id "${targetRunId}" in ${flags.log}. ` +
          `Available runs: ${[...new Set(rows.map((r) => r.runId))].slice(-5).join(', ')}.`,
      )
    }

    this.log(GenerateMetadataReport.renderReport(targetRunId, runRows, flags.log))
  }
}
