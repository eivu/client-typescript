import {describe, expect, it} from '@jest/globals'

import {cleansedAssetName, generateMd5, isEivuYmlFile, md5AsFolders} from '../src/utils'

describe('Utils', () => {
  describe('cleansedAssetName', () => {
    it('returns "coverart-extractedByEivu-forAudio.webp" for cover art files', () => {
      const pathToFile = '/some/path/coverart-extractedByEivu-forAudio-random-string.webp'
      expect(cleansedAssetName(pathToFile)).toBe('coverart-extractedByEivu-forAudio.webp')
    })

    it('returns "coverart-extractedByEivu-forComic.webp" for cover art files', () => {
      const pathToFile = '/some/path/coverart-extractedByEivu-forComic-random-string.webp'
      expect(cleansedAssetName(pathToFile)).toBe('coverart-extractedByEivu-forComic.webp')
    })

    it('handles filenames with multiple dots correctly (e.g., cover.01.webp)', () => {
      const pathToFile = '/tmp/coverart-extractedByEivu-forComic-archiveName-cover.01.webp'
      expect(cleansedAssetName(pathToFile)).toBe('coverart-extractedByEivu-forComic.webp')
    })

    it('returns "coverart-extractedByEivu-forAudio.jpg" for cover art files', () => {
      const pathToFile = '/some/path/coverart-extractedByEivu-forAudio-random-string.jpg'
      expect(cleansedAssetName(pathToFile)).toBe('coverart-extractedByEivu-forAudio.jpg')
    })

    it('returns "coverart-extractedByEivu-forAudio.png" for cover art files', () => {
      const pathToFile = '/some/path/coverart-extractedByEivu-forAudio.png'
      expect(cleansedAssetName(pathToFile)).toBe('coverart-extractedByEivu-forAudio.png')
    })

    it('sanitizes regular filenames', () => {
      const pathToFile = '/some/path/normal file @name!.mp3'
      expect(cleansedAssetName(pathToFile)).toBe('normal_file__name_.mp3')
    })

    it("sanitizes '_Dredd ((Comic Book Movie)) ((p Karl Urban)) ((p Lena Headey)) ((s DNA Films)) ((script)) ((y 2012)).txt", () => {
      const pathToFile =
        '/test/fixtures/samples/text/_Dredd ((Comic Book Movie)) ((p Karl Urban)) ((p Lena Headey)) ((s DNA Films)) ((script)) ((y 2012)).txt'
      expect(cleansedAssetName(pathToFile)).toBe('_Dredd.txt')
    })

    it("sanitizes '`Cowboy Bebop - Asteroid Blues ((anime)) ((blues)) ((all time best)).txt", () => {
      const pathToFile =
        '/test/fixtures/samples/video/`Cowboy Bebop - Asteroid Blues ((anime)) ((script)) ((all time best)).txt'
      expect(cleansedAssetName(pathToFile)).toBe('_Cowboy_Bebop_-_Asteroid_Blues.txt')
    })
  })

  describe('isEivuYmlFile', () => {
    it('returns true for a valid .eivu.yml file (lower case)', () => {
      const pathToFile = '/some/path/6068BE59B486F912BB432DDA00D8949B.eivu.yml'
      expect(isEivuYmlFile(pathToFile)).toBe(true)
    })

    it('returns true for a valid .eivu.yml file (upper case)', () => {
      const pathToFile = '/SOME/PATH/6068BE59B486F912BB432DDA00D8949B.EIVU.YML'
      expect(isEivuYmlFile(pathToFile)).toBe(true)
    })

    it('returns false for a non-.eivu.yml file', () => {
      const pathToFile = '/some/path/6068BE59B486F912BB432DDA00D8949B.txt'
      expect(isEivuYmlFile(pathToFile)).toBe(false)
    })
  })

  describe('md5AsFolders', () => {
    describe('image: ai overlords', () => {
      it('converts an MD5 hash into a folder structure', () => {
        expect(md5AsFolders('7ED971313D1AEA1B6E2BF8AF24BED64A')).toBe('7E/D9/71/31/3D/1A/EA/1B/6E/2B/F8/AF/24/BE/D6/4A')
      })
    })

    describe('video: big buck bunny', () => {
      it('converts an MD5 hash into a folder structure', () => {
        expect(md5AsFolders('198918F40ECC7CAB0FC4231ADAF67C96')).toBe('19/89/18/F4/0E/CC/7C/AB/0F/C4/23/1A/DA/F6/7C/96')
      })
    })
  })

  describe('generateMd5', () => {
    it('should generate MD5 hash for an existing file', async () => {
      const pathToFile = 'test/fixtures/samples/image/ai overlords.jpg'
      const md5 = await generateMd5(pathToFile)
      expect(md5).toBe('7ED971313D1AEA1B6E2BF8AF24BED64A')
    })

    it('should throw error for null pathToFile', async () => {
      await expect(generateMd5(null as unknown as string)).rejects.toThrow('File path must be a non-empty string')
    })

    it('should throw error for non-existent file', async () => {
      await expect(generateMd5('/path/to/nonexistent.txt')).rejects.toThrow('File not found')
    })

    it('should throw error for path traversal attack', async () => {
      await expect(generateMd5('../../../etc/passwd')).rejects.toThrow('path traversal detected')
    })

    it('should throw error for directory instead of file', async () => {
      await expect(generateMd5('test/fixtures/samples')).rejects.toThrow('Expected a file but got a directory')
    })

    it('should handle path with leading/trailing whitespace by using trimmed path', async () => {
      const pathToFile = 'test/fixtures/samples/image/ai overlords.jpg'
      const pathWithWhitespace = `  ${pathToFile}  `
      const md5 = await generateMd5(pathWithWhitespace)
      expect(md5).toBe('7ED971313D1AEA1B6E2BF8AF24BED64A')
      // Verify that the trimmed path works, not the whitespace version
      const md5FromTrimmed = await generateMd5(pathToFile)
      expect(md5).toBe(md5FromTrimmed)
    })
  })
})
