import type {ProcessResult} from '@src/process-orchestrator'

import {describe, expect, it} from '@jest/globals'
import {buildProcessOptions, formatProcessSummary, type ProcessFlags} from '@src/commands/process'

// A fully-populated flags object matching the command's defaults; individual
// tests spread overrides on top to exercise one behavior at a time.
const baseFlags: ProcessFlags = {
  compress: true,
  concurrency: 3,
  dedup: true,
  'keep-awake': true,
  'keep-originals': false,
  metadata: true,
  'on-compress-error': 'upload-original',
  overwrite: false,
  quality: 75,
  'raise-exception': true,
  recursive: true,
  upload: true,
}

describe('eivu process (command helpers)', () => {
  describe('buildProcessOptions', () => {
    it('maps flags onto ProcessOptions and threads the api key', () => {
      expect(buildProcessOptions(baseFlags, 'sk-test')).toMatchObject({
        apiKey: 'sk-test',
        compress: true,
        concurrency: 3,
        keepOriginals: false,
        metadata: true,
        onCompressError: 'upload-original',
        overwrite: false,
        quality: 75,
        raiseException: true,
        recursive: true,
        upload: true,
      })
    })

    it('renames hyphenated flags to their camelCase option names', () => {
      const opts = buildProcessOptions({
        ...baseFlags,
        'keep-originals': true,
        'raise-exception': false,
        'target-height': 1600,
      })
      expect(opts.keepOriginals).toBe(true)
      expect(opts.raiseException).toBe(false)
      expect(opts.targetHeight).toBe(1600)
    })

    it('leaves targetHeight undefined when the flag is absent', () => {
      expect(buildProcessOptions(baseFlags).targetHeight).toBeUndefined()
    })

    it('applies the secured → nsfw implication (mirrors `eivu upload`)', () => {
      const opts = buildProcessOptions({...baseFlags, secured: true})
      expect(opts.secured).toBe(true)
      expect(opts.nsfw).toBe(true)
    })

    it('does not imply secured from nsfw alone', () => {
      const opts = buildProcessOptions({...baseFlags, nsfw: true})
      expect(opts.nsfw).toBe(true)
      expect(opts.secured).toBe(false)
    })

    it('defaults nsfw and secured to false when neither flag is set', () => {
      const opts = buildProcessOptions(baseFlags)
      expect(opts.nsfw).toBe(false)
      expect(opts.secured).toBe(false)
    })

    it('passes through the negatable stage flags', () => {
      const opts = buildProcessOptions({...baseFlags, compress: false, metadata: false, upload: false})
      expect(opts.compress).toBe(false)
      expect(opts.metadata).toBe(false)
      expect(opts.upload).toBe(false)
    })

    it('passes through the dedup flag', () => {
      expect(buildProcessOptions(baseFlags).dedup).toBe(true)
      expect(buildProcessOptions({...baseFlags, dedup: false}).dedup).toBe(false)
    })
  })

  describe('formatProcessSummary', () => {
    const empty: ProcessResult = {
      compressed: [],
      discovered: 0,
      droppedOnError: [],
      duplicatesArchived: [],
      reused: [],
      targets: [],
    }

    it('summarizes discovered / compressed / target counts', () => {
      const s = formatProcessSummary({...empty, compressed: ['a', 'b'], discovered: 3, targets: ['a', 'b', 'c']})
      expect(s).toBe('Processed 3 file(s): 2 compressed, 3 target(s).')
    })

    it('includes the reused clause only when non-empty', () => {
      const withReused = formatProcessSummary({...empty, discovered: 2, reused: ['x'], targets: ['y']})
      expect(withReused).toContain('1 reused,')
      expect(formatProcessSummary({...empty, discovered: 1, targets: ['y']})).not.toContain('reused')
    })

    it('includes the dropped-on-error clause only when non-empty', () => {
      const dropped = formatProcessSummary({...empty, discovered: 2, droppedOnError: ['bad.cbz'], targets: ['ok.cbz']})
      expect(dropped).toContain('1 dropped on compress error')
      expect(formatProcessSummary({...empty, discovered: 1, targets: ['y']})).not.toContain('dropped')
    })

    it('includes the duplicates-archived clause only when non-empty', () => {
      const dup = formatProcessSummary({...empty, discovered: 2, duplicatesArchived: ['dup.cbz'], targets: ['ok.cbz']})
      expect(dup).toContain('1 duplicate(s) archived')
      expect(formatProcessSummary({...empty, discovered: 1, targets: ['y']})).not.toContain('duplicate')
    })
  })
})
