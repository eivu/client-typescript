import {afterEach, beforeEach, describe, expect, it} from '@jest/globals'
import {appendRunRows, type TelemetryRow} from '@src/ai/telemetry'
import {readTelemetryRows, renderRunReport} from '@src/commands/generate-metadata/report'
import {promises as fsp} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function makeRow(overrides: Partial<TelemetryRow> = {}): TelemetryRow {
  return {
    attempt: 1,
    cachedInputTokens: 200,
    cacheWriteTokens: 100,
    costUsd: 0.0125,
    file: '/fixtures/example.cbz',
    latencyMs: 1234,
    model: 'claude-opus-4-6',
    pipeline: 'comics',
    runId: 'run-test',
    stage: 0,
    status: 'success',
    timestamp: '2026-05-28T00:00:00.000Z',
    tokensIn: 1024,
    tokensOut: 512,
    validationCodes: '',
    webSearches: 4,
    ...overrides,
  }
}

describe('gm:report (renderRunReport + readTelemetryRows)', () => {
  describe('renderRunReport', () => {
    it('produces the summary line with file + token + cost totals', () => {
      const rows = [
        makeRow({costUsd: 0.02, file: '/a.cbz', pipeline: 'comics', tokensIn: 1000, tokensOut: 500}),
        makeRow({costUsd: 0.01, file: '/b.mp3', pipeline: 'audio', tokensIn: 800, tokensOut: 400}),
        makeRow({costUsd: 0.008, file: '/c.mp4', pipeline: 'video', tokensIn: 600, tokensOut: 300}),
      ]
      const output = renderRunReport('run-test', rows, 'logs/metadata-runs.csv')
      expect(output).toContain('Run run-test')
      expect(output).toContain('3 files')
      expect(output).toContain('3 succeeded')
      expect(output).toContain('0 failed')
      expect(output).toContain('3,600 total tokens')
      expect(output).toContain('$0.0380 calibrated')
    })

    it('groups by pipeline with average tokens + web searches', () => {
      const rows = [
        makeRow({file: '/a.cbz', pipeline: 'comics', tokensIn: 1000, tokensOut: 500, webSearches: 5}),
        makeRow({file: '/b.cbz', pipeline: 'comics', tokensIn: 2000, tokensOut: 1000, webSearches: 7}),
        makeRow({file: '/c.mp3', pipeline: 'audio', tokensIn: 500, tokensOut: 250, webSearches: 3}),
      ]
      const output = renderRunReport('run-test', rows, 'logs/metadata-runs.csv')
      expect(output).toContain('Per pipeline:')
      // comics: count=2, avg_tokens=(1500+3000)/2=2250, avg_web=(5+7)/2=6.0
      expect(output).toMatch(/comics\s+2\s+\$0\.\d{4}\s+2250\s+6\.0/)
      // audio: count=1, avg_tokens=750, avg_web=3.0
      expect(output).toMatch(/audio\s+1\s+\$0\.\d{4}\s+750\s+3\.0/)
    })

    it('rolls up retry attempts to one summary row per file', () => {
      const rows = [
        makeRow({attempt: 1, costUsd: 0.01, file: '/flaky.cbz', status: 'validation_error'}),
        makeRow({attempt: 2, costUsd: 0.01, file: '/flaky.cbz', status: 'validation_error'}),
        makeRow({attempt: 3, costUsd: 0.01, file: '/flaky.cbz', status: 'success'}),
      ]
      const output = renderRunReport('run-test', rows, 'logs/metadata-runs.csv')
      expect(output).toContain('1 files')
      expect(output).toContain('1 succeeded')
      // attempts column = 3, status = success (the final attempt won), cost = sum
      expect(output).toMatch(/flaky\.cbz\s+comics\s+claude-opus-4-6\s+3\s+success\s+\$0\.0300/)
    })

    it('counts files with a failed final attempt as failed', () => {
      const rows = [
        makeRow({attempt: 1, file: '/bad.cbz', status: 'validation_error'}),
        makeRow({attempt: 2, file: '/bad.cbz', status: 'validation_error'}),
        makeRow({attempt: 3, file: '/bad.cbz', status: 'error'}),
      ]
      const output = renderRunReport('run-test', rows, 'logs/metadata-runs.csv')
      expect(output).toContain('1 files')
      expect(output).toContain('0 succeeded')
      expect(output).toContain('1 failed')
    })

    it('truncates the per-file table at 20 rows with an "… and N more" suffix', () => {
      const rows = Array.from({length: 25}, (_, i) =>
        makeRow({file: `/file-${String(i).padStart(2, '0')}.cbz`}),
      )
      const output = renderRunReport('run-test', rows, 'logs/metadata-runs.csv')
      expect(output).toContain('25 files')
      expect(output).toContain('… and 5 more')
      // First 20 files should be present; file-20 onwards should not be in the body.
      expect(output).toContain('/file-19.cbz')
      expect(output).not.toContain('/file-20.cbz')
    })

    it('mentions the log path in the footer', () => {
      const output = renderRunReport('run-test', [makeRow()], 'logs/custom-runs.csv')
      expect(output).toContain('See logs/custom-runs.csv for the full data.')
    })
  })

  describe('readTelemetryRows round-trip', () => {
    let tmpDir: string
    let logPath: string

    beforeEach(async () => {
      tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'eivu-report-'))
      logPath = path.join(tmpDir, 'metadata-runs.csv')
    })

    afterEach(async () => {
      await fsp.rm(tmpDir, {force: true, recursive: true})
    })

    it('round-trips rows written by appendRunRows', async () => {
      const original = [
        makeRow({file: '/a.cbz', runId: 'r1'}),
        makeRow({file: '/b.mp3', pipeline: 'audio', runId: 'r1'}),
      ]
      await appendRunRows(original, logPath)

      const parsed = await readTelemetryRows(logPath)
      expect(parsed).toHaveLength(2)
      expect(parsed[0].file).toBe('/a.cbz')
      expect(parsed[0].runId).toBe('r1')
      expect(parsed[0].pipeline).toBe('comics')
      expect(parsed[0].costUsd).toBeCloseTo(0.0125, 6)
      expect(parsed[1].pipeline).toBe('audio')
    })

    it('handles multiple appended batches', async () => {
      await appendRunRows([makeRow({runId: 'r1'})], logPath)
      await appendRunRows([makeRow({runId: 'r2'})], logPath)
      await appendRunRows([makeRow({runId: 'r3'})], logPath)

      const parsed = await readTelemetryRows(logPath)
      expect(parsed.map((r) => r.runId)).toEqual(['r1', 'r2', 'r3'])
    })
  })
})
