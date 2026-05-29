import {afterEach, beforeEach, describe, expect, it} from '@jest/globals'
import {appendRunRows, TELEMETRY_COLUMNS, type TelemetryRow} from '@src/ai/telemetry'
import * as fs from 'node:fs'
import {promises as fsp} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function makeRow(overrides: Partial<TelemetryRow> = {}): TelemetryRow {
  return {
    attempt: 1,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0.012_345,
    file: '/fixtures/example.cbz',
    latencyMs: 5432,
    model: 'claude-opus-4-6',
    pipeline: 'comics',
    runId: 'run-abc-123',
    stage: 0,
    status: 'success',
    timestamp: '2026-05-28T00:00:00.000Z',
    tokensIn: 1024,
    tokensOut: 512,
    webSearches: 3,
    ...overrides,
  }
}

describe('telemetry', () => {
  let tmpDir: string
  let logPath: string

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'eivu-telemetry-'))
    logPath = path.join(tmpDir, 'metadata-runs.csv')
  })

  afterEach(async () => {
    await fsp.rm(tmpDir, {force: true, recursive: true})
  })

  it('writes all 15 columns in the documented order', async () => {
    await appendRunRows([makeRow()], logPath)

    const csv = await fsp.readFile(logPath, 'utf8')
    const cells = csv.trim().split(',')

    expect(TELEMETRY_COLUMNS).toHaveLength(15)
    expect(cells).toHaveLength(15)
    expect(cells[TELEMETRY_COLUMNS.indexOf('timestamp')]).toBe('2026-05-28T00:00:00.000Z')
    expect(cells[TELEMETRY_COLUMNS.indexOf('runId')]).toBe('run-abc-123')
    expect(cells[TELEMETRY_COLUMNS.indexOf('pipeline')]).toBe('comics')
    expect(cells[TELEMETRY_COLUMNS.indexOf('stage')]).toBe('0')
    expect(cells[TELEMETRY_COLUMNS.indexOf('model')]).toBe('claude-opus-4-6')
    expect(cells[TELEMETRY_COLUMNS.indexOf('costUsd')]).toBe('0.012345')
    expect(cells[TELEMETRY_COLUMNS.indexOf('status')]).toBe('success')
    expect(cells[TELEMETRY_COLUMNS.indexOf('attempt')]).toBe('1')
  })

  it('lazily creates the parent logs/ directory on first write', async () => {
    const nestedDir = path.join(tmpDir, 'nested', 'logs')
    const nestedPath = path.join(nestedDir, 'metadata-runs.csv')
    expect(fs.existsSync(nestedDir)).toBe(false)

    await appendRunRows([makeRow()], nestedPath)

    expect(fs.existsSync(nestedDir)).toBe(true)
    expect(fs.existsSync(nestedPath)).toBe(true)
  })

  it('appends multiple invocations without merging lines', async () => {
    await appendRunRows([makeRow({attempt: 1})], logPath)
    await appendRunRows([makeRow({attempt: 2})], logPath)
    await appendRunRows([makeRow({attempt: 3})], logPath)

    const csv = await fsp.readFile(logPath, 'utf8')
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(3)
    const attemptIdx = TELEMETRY_COLUMNS.indexOf('attempt')
    expect(lines.map((l) => l.split(',')[attemptIdx])).toEqual(['1', '2', '3'])
  })

  it('writes one chunk per call so multi-row batches stay contiguous', async () => {
    const batch = [
      makeRow({file: '/a.cbz', runId: 'run-1'}),
      makeRow({file: '/b.cbz', runId: 'run-1'}),
      makeRow({file: '/c.cbz', runId: 'run-1'}),
    ]
    await appendRunRows(batch, logPath)

    const csv = await fsp.readFile(logPath, 'utf8')
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(3)
    const fileIdx = TELEMETRY_COLUMNS.indexOf('file')
    expect(lines.map((l) => l.split(',')[fileIdx])).toEqual(['/a.cbz', '/b.cbz', '/c.cbz'])
  })

  it('no-ops on an empty input', async () => {
    await appendRunRows([], logPath)
    expect(fs.existsSync(logPath)).toBe(false)
  })

  it('handles concurrent appends without corruption (single appendFile per batch)', async () => {
    await Promise.all([
      appendRunRows([makeRow({runId: 'run-a'})], logPath),
      appendRunRows([makeRow({runId: 'run-b'})], logPath),
      appendRunRows([makeRow({runId: 'run-c'})], logPath),
    ])

    const csv = await fsp.readFile(logPath, 'utf8')
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(3)
    const runIdIdx = TELEMETRY_COLUMNS.indexOf('runId')
    const runIds = new Set(lines.map((l) => l.split(',')[runIdIdx]))
    expect(runIds).toEqual(new Set(['run-a', 'run-b', 'run-c']))
  })
})
