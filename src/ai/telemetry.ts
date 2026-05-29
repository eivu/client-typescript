import * as fastCsv from 'fast-csv'
import {promises as fsp} from 'node:fs'
import path from 'node:path'

/**
 * One row in `logs/metadata-runs.csv` — appended per completed agent call.
 * Columns are kept in a fixed order (`TELEMETRY_COLUMNS` below); rows are
 * append-only and headerless to match the existing `logs/failure.csv`
 * convention. New columns must be added at the end so existing data stays
 * parsable by downstream tooling.
 */
export type TelemetryRow = {
  attempt: number
  cachedInputTokens: number
  cacheWriteTokens: number
  costUsd: number
  file: string
  latencyMs: number
  model: string
  pipeline: string
  runId: string
  stage: number
  status: 'error' | 'success' | 'validation_error'
  timestamp: string
  tokensIn: number
  tokensOut: number
  webSearches: number
}

/**
 * Column order for `logs/metadata-runs.csv`. Append-only — never reorder or
 * delete entries, only add new ones at the end. Downstream consumers
 * (`gm:report`, hand-rolled analyses) index by position because the file is
 * intentionally headerless.
 */
export const TELEMETRY_COLUMNS: ReadonlyArray<keyof TelemetryRow> = [
  'timestamp',
  'runId',
  'file',
  'pipeline',
  'stage',
  'model',
  'tokensIn',
  'tokensOut',
  'cachedInputTokens',
  'cacheWriteTokens',
  'webSearches',
  'latencyMs',
  'status',
  'attempt',
  'costUsd',
]

export const DEFAULT_TELEMETRY_LOG_PATH = path.join('logs', 'metadata-runs.csv')

function rowToCells(row: TelemetryRow): string[] {
  return TELEMETRY_COLUMNS.map((col) => {
    const value = row[col]
    if (typeof value === 'number') {
      return col === 'costUsd' ? value.toFixed(6) : String(value)
    }

    return String(value)
  })
}

/**
 * Appends one or more telemetry rows to the CSV log. Creates the `logs/`
 * directory lazily on first write. Uses `fs.promises.appendFile` (a single
 * kernel-level write per call) so concurrent invocations don't interleave —
 * each batch's rows land contiguously.
 *
 * Callers should batch rows per invocation rather than calling this once per
 * row; that keeps disk traffic proportional to the number of API batches and
 * gives concurrent runs of `eivu gm:ai` a fair chance of contiguous output.
 *
 * @param rows - Telemetry rows to append (may be empty — no-op then)
 * @param logPath - Override the default log path (used by tests; default = `logs/metadata-runs.csv`)
 */
export async function appendRunRows(
  rows: TelemetryRow[],
  logPath: string = DEFAULT_TELEMETRY_LOG_PATH,
): Promise<void> {
  if (rows.length === 0) return

  const dir = path.dirname(logPath)
  await fsp.mkdir(dir, {recursive: true})

  const cells = rows.map((row) => rowToCells(row))
  const csv = await fastCsv.writeToString(cells, {headers: false})

  // Every append ends with '\n' so the next call starts a fresh line. fast-csv
  // doesn't emit a trailing newline on its own — we add one to maintain that
  // invariant.
  await fsp.appendFile(logPath, csv + '\n')
}
