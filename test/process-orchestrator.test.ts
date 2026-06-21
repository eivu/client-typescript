import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'
import {readFileSync, writeFileSync} from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {MetadataGenerator} from '../src/ai/metadata-generator'
import {Client} from '../src/client'
import {COMPRESSED_INFIX, SKIPPABLE_FOLDERS} from '../src/constants'
import {
  compressedOutputPath,
  isAlreadyCompressed,
  type ProcessOptions,
  ProcessOrchestrator,
} from '../src/process-orchestrator'

/**
 * Testable orchestrator: replaces the real (slow) compressor with a configurable fake.
 * Behaviors keyed by basename so a single instance can exercise success/failure mixes.
 */
type CompressBehavior = 'fail-silent' | 'success' | 'throw'

class FakeOrchestrator extends ProcessOrchestrator {
  behaviors: Map<string, CompressBehavior> = new Map()
  defaultBehavior: CompressBehavior = 'success'

  protected async runCompressor(file: string): Promise<void> {
    const behavior = this.behaviors.get(path.basename(file)) ?? this.defaultBehavior
    if (behavior === 'throw') throw new Error('ImageSkippedError (simulated)')
    if (behavior === 'fail-silent') return // produces no output file
    writeFileSync(compressedOutputPath(file), 'compressed-bytes') // success
  }
}

// Default metadata/upload off so unit tests don't need the spies unless they opt in.
function makeOrchestrator(options: ProcessOptions = {}): FakeOrchestrator {
  return new FakeOrchestrator({metadata: false, upload: false, ...options})
}

describe('process-orchestrator', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'proc-orch-'))
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await fsp.rm(tmpDir, {force: true, recursive: true})
  })

  const touch = (name: string, content = 'x'): string => {
    const p = path.join(tmpDir, name)
    writeFileSync(p, content)
    return p
  }

  describe('helpers', () => {
    it('compressedOutputPath inserts the compressed infix before the extension, same dir', () => {
      expect(compressedOutputPath('/a/b/Foo.cbz')).toBe(`/a/b/Foo${COMPRESSED_INFIX}.cbz`)
      expect(compressedOutputPath('/a/b/Bar.cbr')).toBe(`/a/b/Bar${COMPRESSED_INFIX}.cbr`)
    })

    it('isAlreadyCompressed is true only for *.eivu_compressed.cbz/.cbr (case-insensitive)', () => {
      expect(isAlreadyCompressed('/x/Foo.eivu_compressed.cbz')).toBe(true)
      expect(isAlreadyCompressed('/x/Foo.eivu_compressed.CBR')).toBe(true)
      expect(isAlreadyCompressed('/x/Foo.cbz')).toBe(false)
      expect(isAlreadyCompressed('/x/Foo.pdf')).toBe(false)
    })

    it('eivu_originals is in the shared SKIPPABLE_FOLDERS', () => {
      expect(SKIPPABLE_FOLDERS).toContain('eivu_originals')
    })
  })

  describe('compress stage', () => {
    it('compresses a .cbz: target is the compressed path and the original is archived', async () => {
      touch('Foo.cbz')

      const result = await makeOrchestrator().run(tmpDir)

      expect(result.targets).toEqual([path.join(tmpDir, `Foo${COMPRESSED_INFIX}.cbz`)])
      expect(result.compressed).toEqual([path.join(tmpDir, 'Foo.cbz')])
      await expect(fsp.access(path.join(tmpDir, 'eivu_originals', 'Foo.cbz'))).resolves.toBeUndefined()
      await expect(fsp.access(path.join(tmpDir, 'Foo.cbz'))).rejects.toThrow()
    })

    it('compresses a .cbr too', async () => {
      touch('Bar.cbr')
      const result = await makeOrchestrator().run(tmpDir)
      expect(result.targets).toEqual([path.join(tmpDir, `Bar${COMPRESSED_INFIX}.cbr`)])
    })

    it('--keep-originals leaves the original in place', async () => {
      touch('Foo.cbz')
      const result = await makeOrchestrator({keepOriginals: true}).run(tmpDir)
      expect(result.targets).toEqual([path.join(tmpDir, `Foo${COMPRESSED_INFIX}.cbz`)])
      await expect(fsp.access(path.join(tmpDir, 'Foo.cbz'))).resolves.toBeUndefined()
    })

    it('skips compression for already-compressed files (uses original as target)', async () => {
      const p = touch(`Foo${COMPRESSED_INFIX}.cbz`)
      const orch = makeOrchestrator()
      const spy = jest.spyOn(orch as unknown as {runCompressor: () => Promise<void>}, 'runCompressor')
      const result = await orch.run(tmpDir)
      expect(spy).not.toHaveBeenCalled()
      expect(result.targets).toEqual([p])
    })

    it('passes non-comic files straight through (e.g. .pdf, .mp3)', async () => {
      const pdf = touch('Book.pdf')
      const mp3 = touch('Song.mp3')
      const result = await makeOrchestrator().run(tmpDir)
      expect(result.targets.sort()).toEqual([mp3, pdf].sort())
      expect(result.compressed).toEqual([])
    })

    it('--no-compress: every file uses its original as the target', async () => {
      const cbz = touch('Foo.cbz')
      const result = await makeOrchestrator({compress: false}).run(tmpDir)
      expect(result.targets).toEqual([cbz])
      expect(result.compressed).toEqual([])
    })

    for (const behavior of ['throw', 'fail-silent'] as const) {
      it(`on failure, upload-original keeps the original as target (${behavior})`, async () => {
        const cbz = touch('Foo.cbz')
        const orch = makeOrchestrator({onCompressError: 'upload-original'})
        orch.behaviors.set('Foo.cbz', behavior)
        const result = await orch.run(tmpDir)
        expect(result.targets).toEqual([cbz])
        expect(result.droppedOnError).toEqual([])
      })

      it(`on failure, skip drops the file (${behavior})`, async () => {
        const cbz = touch('Foo.cbz')
        const orch = makeOrchestrator({onCompressError: 'skip'})
        orch.behaviors.set('Foo.cbz', behavior)
        const result = await orch.run(tmpDir)
        expect(result.targets).toEqual([])
        expect(result.droppedOnError).toEqual([cbz])
      })
    }
  })

  describe('discovery + stages', () => {
    it('skips .eivu.yml, junk extensions, and the eivu_originals folder', async () => {
      const keep = touch('Keep.cbz')
      touch('Keep.cbz.eivu.yml') // sibling metadata — skipped
      touch('notes.nfo') // junk extension — skipped
      await fsp.mkdir(path.join(tmpDir, 'eivu_originals'))
      writeFileSync(path.join(tmpDir, 'eivu_originals', 'Old.cbz'), 'x') // archived original — skipped

      const result = await makeOrchestrator().run(tmpDir)
      expect(result.discovered).toBe(1)
      expect(result.targets).toEqual([compressedOutputPath(keep)])
    })

    it('runs metadata + upload on exactly the curated targets', async () => {
      touch('Foo.cbz')
      touch('Song.mp3')
      const genSpy = jest.spyOn(MetadataGenerator, 'generate').mockResolvedValue([])
      const upSpy = jest.spyOn(Client, 'uploadFiles').mockResolvedValue([])

      const orch = new FakeOrchestrator({apiKey: 'k', metadata: true, upload: true})
      const result = await orch.run(tmpDir)

      expect(genSpy).toHaveBeenCalledTimes(1)
      expect(genSpy.mock.calls[0][0].sort()).toEqual([...result.targets].sort())
      expect(upSpy).toHaveBeenCalledTimes(1)
      expect((upSpy.mock.calls[0][0] as {filePaths: string[]}).filePaths.sort()).toEqual([...result.targets].sort())
    })

    it('skips metadata and upload when those stages are disabled', async () => {
      touch('Foo.cbz')
      const genSpy = jest.spyOn(MetadataGenerator, 'generate')
      const upSpy = jest.spyOn(Client, 'uploadFiles')
      await makeOrchestrator().run(tmpDir)
      expect(genSpy).not.toHaveBeenCalled()
      expect(upSpy).not.toHaveBeenCalled()
    })

    it('accepts a single file as input', async () => {
      const cbz = touch('Solo.cbz')
      const result = await makeOrchestrator().run(cbz)
      expect(result.discovered).toBe(1)
      expect(result.targets).toEqual([compressedOutputPath(cbz)])
    })

    it('throws on a non-existent input path', async () => {
      await expect(makeOrchestrator().run(path.join(tmpDir, 'nope'))).rejects.toThrow('does not exist')
    })
  })

  describe('pre-existing compressed sibling', () => {
    it('reuses the existing compressed file: no recompress, single deduped target, original archived', async () => {
      touch('Foo.cbr')
      writeFileSync(path.join(tmpDir, `Foo${COMPRESSED_INFIX}.cbr`), 'ALREADY-COMPRESSED') // user's existing twin

      const orch = makeOrchestrator()
      const spy = jest.spyOn(orch as unknown as {runCompressor: () => Promise<void>}, 'runCompressor')
      const result = await orch.run(tmpDir)

      // never recompressed
      expect(spy).not.toHaveBeenCalled()
      // both inputs resolve to the same target → deduped to one
      expect(result.targets).toEqual([path.join(tmpDir, `Foo${COMPRESSED_INFIX}.cbr`)])
      expect(result.reused).toEqual([path.join(tmpDir, 'Foo.cbr')])
      expect(result.compressed).toEqual([])
      // existing compressed file left byte-for-byte untouched (not clobbered)
      expect(readFileSync(path.join(tmpDir, `Foo${COMPRESSED_INFIX}.cbr`), 'utf8')).toBe('ALREADY-COMPRESSED')
      // redundant original archived
      await expect(fsp.access(path.join(tmpDir, 'eivu_originals', 'Foo.cbr'))).resolves.toBeUndefined()
      await expect(fsp.access(path.join(tmpDir, 'Foo.cbr'))).rejects.toThrow()
    })

    it('--keep-originals reuses but leaves the original in place', async () => {
      touch('Foo.cbr')
      writeFileSync(path.join(tmpDir, `Foo${COMPRESSED_INFIX}.cbr`), 'ALREADY-COMPRESSED')

      const result = await makeOrchestrator({keepOriginals: true}).run(tmpDir)

      expect(result.targets).toEqual([path.join(tmpDir, `Foo${COMPRESSED_INFIX}.cbr`)])
      expect(result.reused).toEqual([path.join(tmpDir, 'Foo.cbr')])
      await expect(fsp.access(path.join(tmpDir, 'Foo.cbr'))).resolves.toBeUndefined()
    })

    it('only generates metadata + uploads the single deduped target', async () => {
      touch('Foo.cbr')
      writeFileSync(path.join(tmpDir, `Foo${COMPRESSED_INFIX}.cbr`), 'ALREADY-COMPRESSED')
      const genSpy = jest.spyOn(MetadataGenerator, 'generate').mockResolvedValue([])
      const upSpy = jest.spyOn(Client, 'uploadFiles').mockResolvedValue([])

      const compressedPath = path.join(tmpDir, `Foo${COMPRESSED_INFIX}.cbr`)
      await new FakeOrchestrator({apiKey: 'k', metadata: true, upload: true}).run(tmpDir)

      expect(genSpy.mock.calls[0][0]).toEqual([compressedPath])
      expect((upSpy.mock.calls[0][0] as {filePaths: string[]}).filePaths).toEqual([compressedPath])
    })
  })
})
