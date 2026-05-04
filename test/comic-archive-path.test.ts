import {describe, expect, it} from '@jest/globals'

import {IncorrectFileTypeError, isComicArchivePath} from '../src/comic-archive-path'

describe('comic archive path validation', () => {
  describe('isComicArchivePath', () => {
    it('returns true for .cbz paths (lower case)', () => {
      expect(isComicArchivePath('/comics/issue.cbz')).toBe(true)
    })

    it('returns true for .cbr paths (lower case)', () => {
      expect(isComicArchivePath('/comics/issue.cbr')).toBe(true)
    })

    it('returns true for .CBR / .CBZ (case-insensitive)', () => {
      expect(isComicArchivePath('/comics/issue.CBR')).toBe(true)
      expect(isComicArchivePath('/comics/issue.CbZ')).toBe(true)
    })

    it('returns true for .eivu_compressed.cbz / .cbr suffix patterns', () => {
      expect(isComicArchivePath('test/fixtures/samples/comics/The_Peacemaker_01_1967.eivu_compressed.cbz')).toBe(true)
      expect(isComicArchivePath('test/fixtures/samples/comics/Space_Adventures_033.eivu_compressed.cbr')).toBe(true)
    })

    it('returns false for other extensions', () => {
      expect(isComicArchivePath('/comics/issue.zip')).toBe(false)
      expect(isComicArchivePath('/comics/issue.pdf')).toBe(false)
      expect(isComicArchivePath('/comics/readme.txt')).toBe(false)
    })

    it('returns false when .cbr/.cbz appears only in the middle of the path', () => {
      expect(isComicArchivePath('/comics.cbz.backup/file')).toBe(false)
    })
  })

  describe('IncorrectFileTypeError', () => {
    it('sets name and filePath and describes expected suffixes in the message', () => {
      const pathArg = '/tmp/not-a-comic.zip'
      const err = new IncorrectFileTypeError(pathArg)

      expect(err).toBeInstanceOf(Error)
      expect(err.name).toBe('IncorrectFileTypeError')
      expect(err.filePath).toBe(pathArg)
      expect(err.message).toContain(pathArg)
      expect(err.message).toContain('.cbr')
      expect(err.message).toContain('.cbz')
    })
  })
})
