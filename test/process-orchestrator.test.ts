import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
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
    // Deterministic content keyed on the source name: two different comics produce different compressed
    // bytes (so they don't accidentally md5-collide), while the SAME comic always yields the same bytes
    // (so a cross-dir twin can be pre-placed with identical content to exercise Level B dedup).
    writeFileSync(compressedOutputPath(file), `compressed:${path.basename(file)}`) // success
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

  // Default content = name, so distinct names get distinct md5s (md5 dedup is on by default).
  const touch = (name: string, content = name): string => {
    const p = path.join(tmpDir, name)
    writeFileSync(p, content)
    return p
  }

  // Create a file at a relative subpath under tmpDir (making intermediate dirs).
  const touchAt = (rel: string, content: string): string => {
    const p = path.join(tmpDir, rel)
    mkdirSync(path.dirname(p), {recursive: true})
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

  describe('cross-directory md5 dedup', () => {
    it('identical originals in two dirs → compress once, archive the duplicate copy', async () => {
      touchAt('a/Foo.cbr', 'SAME-BYTES')
      touchAt('c/Foo.cbr', 'SAME-BYTES')

      const orch = makeOrchestrator()
      const spy = jest.spyOn(orch as unknown as {runCompressor: () => Promise<void>}, 'runCompressor')
      const result = await orch.run(tmpDir)

      expect(spy).toHaveBeenCalledTimes(1) // only the canonical (sorted-first /a) is compressed
      expect(result.targets).toEqual([path.join(tmpDir, 'a', `Foo${COMPRESSED_INFIX}.cbr`)])
      expect(result.duplicatesArchived).toEqual([path.join(tmpDir, 'c', 'Foo.cbr')])
      // duplicate archived in its own dir
      await expect(fsp.access(path.join(tmpDir, 'c', 'eivu_originals', 'Foo.cbr'))).resolves.toBeUndefined()
      // canonical's original archived too (normal compress flow)
      await expect(fsp.access(path.join(tmpDir, 'a', 'eivu_originals', 'Foo.cbr'))).resolves.toBeUndefined()
    })

    it('identical compressed files in two dirs → one target, duplicate archived, no compression', async () => {
      touchAt(`a/Foo${COMPRESSED_INFIX}.cbr`, 'SAME-COMPRESSED')
      touchAt(`c/Foo${COMPRESSED_INFIX}.cbr`, 'SAME-COMPRESSED')

      const orch = makeOrchestrator()
      const spy = jest.spyOn(orch as unknown as {runCompressor: () => Promise<void>}, 'runCompressor')
      const result = await orch.run(tmpDir)

      expect(spy).not.toHaveBeenCalled()
      expect(result.targets).toEqual([path.join(tmpDir, 'a', `Foo${COMPRESSED_INFIX}.cbr`)])
      expect(result.duplicatesArchived).toEqual([path.join(tmpDir, 'c', `Foo${COMPRESSED_INFIX}.cbr`)])
      await expect(
        fsp.access(path.join(tmpDir, 'c', 'eivu_originals', `Foo${COMPRESSED_INFIX}.cbr`)),
      ).resolves.toBeUndefined()
    })

    it('original + its compressed twin in different dirs → Level B unifies them to one target', async () => {
      touchAt('a/Foo.cbr', 'ORIGINAL-BYTES')
      // pre-place the twin with the exact bytes the fake compressor will produce for a/Foo.cbr
      touchAt(`b/Foo${COMPRESSED_INFIX}.cbr`, 'compressed:Foo.cbr')

      const genSpy = jest.spyOn(MetadataGenerator, 'generate').mockResolvedValue([])
      const upSpy = jest.spyOn(Client, 'uploadFiles').mockResolvedValue([])
      const result = await new FakeOrchestrator({apiKey: 'k', metadata: true, upload: true}).run(tmpDir)

      const canonical = path.join(tmpDir, 'a', `Foo${COMPRESSED_INFIX}.cbr`)
      expect(result.targets).toEqual([canonical]) // both compressed-contents share an md5 → one target
      expect(result.duplicatesArchived).toEqual([path.join(tmpDir, 'b', `Foo${COMPRESSED_INFIX}.cbr`)])
      expect(genSpy.mock.calls[0][0]).toEqual([canonical])
      expect((upSpy.mock.calls[0][0] as {filePaths: string[]}).filePaths).toEqual([canonical])
      // the dropped twin archived in its dir
      await expect(
        fsp.access(path.join(tmpDir, 'b', 'eivu_originals', `Foo${COMPRESSED_INFIX}.cbr`)),
      ).resolves.toBeUndefined()
    })

    it('--no-dedup keeps cross-dir duplicates as separate targets', async () => {
      touchAt('a/Foo.cbr', 'SAME-BYTES')
      touchAt('c/Foo.cbr', 'SAME-BYTES')

      const result = await makeOrchestrator({dedup: false}).run(tmpDir)

      expect(result.targets.sort()).toEqual(
        [
          path.join(tmpDir, 'a', `Foo${COMPRESSED_INFIX}.cbr`),
          path.join(tmpDir, 'c', `Foo${COMPRESSED_INFIX}.cbr`),
        ].sort(),
      )
      expect(result.duplicatesArchived).toEqual([])
    })
  })
})
