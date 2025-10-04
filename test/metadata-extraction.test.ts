import {describe, expect, it} from '@jest/globals'

import {
  extractMetadataList,
  extractRating,
  extractYear,
  pruneFromMetadataList,
  pruneMetadata,
} from '../src/metadata-extraction'

describe('Metadata Extraction', () => {
  describe('extractMetadataList', () => {
    it('returns found values for 123((456))789((012))345.txt', () => {
      const string = '123((456))789((012))345.txt'
      expect(extractMetadataList(string)).toEqual([{tag: '456'}, {tag: '012'}])
    })

    it('returns empty array for __my_potato.rb', () => {
      const string = '__my_potato.rb'
      expect(extractMetadataList(string)).toEqual([])
    })

    it('returns found values for _Dredd ((Comic Book Movie)) ((p Karl Urban)) ((p Lena Headey)) ((s DNA Films)) ((script)) ((y 2012)).txt', () => {
      const string =
        '_Dredd ((Comic Book Movie)) ((p Karl Urban)) ((p Lena Headey)) ((s DNA Films)) ((script)) ((y 2012)).txt'
      expect(extractMetadataList(string)).toEqual(
        expect.arrayContaining([
          {tag: 'comic book movie'},
          {performer: 'karl urban'},
          {performer: 'lena headey'},
          {studio: 'dna films'},
          {tag: 'script'},
        ]),
      )
      expect(extractMetadataList(string)).toHaveLength(5)
    })

    it('returns found values for `Cowboy Bebop - Asteroid Blues ((anime)) ((blues)) ((all time best)).wmv', () => {
      const string = '`Cowboy Bebop - Asteroid Blues ((anime)) ((blues)) ((all time best)).wmv'
      expect(extractMetadataList(string)).toEqual([{tag: 'anime'}, {tag: 'blues'}, {tag: 'all time best'}])
    })
  })

  describe('extractRating', () => {
    it('returns null when no rating is present in 123((456))789((012))345.txt', () => {
      const string = '123((456))789((012))345.txt'
      expect(extractRating(string)).toBeNull()
    })

    it('returns 5 when rating is present in __my_potato.rb', () => {
      const string = '__my_potato.rb'
      expect(extractRating(string)).toBe(5)
    })

    it('returns 4.75 when rating is present in _Judge Dredd ((Comic Book Movie)).mp4', () => {
      const string = '_Judge Dredd ((Comic Book Movie)).mp4'
      expect(extractRating(string)).toBe(4.75)
    })

    it('returns 4.25 when rating is present in `Cowboy Bebop - Asteroid Blues ((anime)) ((blues)) ((all time best)).wmv', () => {
      const string = '`Cowboy Bebop - Asteroid Blues ((anime)) ((blues)) ((all time best)).wmv'
      expect(extractRating(string)).toBe(4.25)
    })
  })

  describe('extractYear', () => {
    it('returns null when no year is present in 123((456))789((012))345.txt', () => {
      const string = '123((456))789((012))345.txt'
      expect(extractYear(string)).toBeNull()
    })

    it('returns null when no year is present in __my_potato.rb', () => {
      const string = '__my_potato.rb'
      expect(extractYear(string)).toBeNull()
    })

    it('extracts 2012 from _Dredd ((Comic Book Movie)) ((p Karl Urban)) ((p Lena Headey)) ((s DNA Films)) ((script)) ((y 2012)).txt', () => {
      const string =
        '_Dredd ((Comic Book Movie)) ((p Karl Urban)) ((p Lena Headey)) ((s DNA Films)) ((script)) ((y 2012)).txt'
      expect(extractYear(string)).toBe(2012)
    })

    it('returns null when no year is present in `Cowboy Bebop - Asteroid Blues ((anime)) ((blues)) ((all time best)).wmv', () => {
      const string = '`Cowboy Bebop - Asteroid Blues ((anime)) ((blues)) ((all time best)).wmv'
      expect(extractYear(string)).toBeNull()
    })
  })

  describe('pruneMetadata', () => {
    it('removes metadata tags from the _Dred', () => {
      const string =
        '_Dredd ((Comic Book Movie)) ((p Karl Urban)) ((p Lena Headey)) ((s DNA Films)) ((script)) ((y 2012)).txt'
      const expected = 'Dredd.txt'
      expect(pruneMetadata(string)).toBe(expected)
    })

    it('removes metadata tags from the `Cowboy Bebop', () => {
      const string = '`Cowboy Bebop - Asteroid Blues ((anime)) ((blues)) ((all time best)).wmv'
      const expected = 'Cowboy Bebop - Asteroid Blues.wmv'
      expect(pruneMetadata(string)).toBe(expected)
    })

    it('removes metadata tags from the 123((456))789((012))345.txt', () => {
      const string = '123((456))789((012))345.txt'
      const expected = '123789345.txt'
      expect(pruneMetadata(string)).toBe(expected)
    })

    it('removes metadata tags from the __my_potato.rb', () => {
      const string = '__my_potato.rb'
      const expected = 'my_potato.rb'
      expect(pruneMetadata(string)).toBe(expected)
    })

    it('removes metadata tags from the _Judge Dredd', () => {
      const string = '_Judge Dredd ((Comic Book Movie)).mp4'
      const expected = 'Judge Dredd.mp4'
      expect(pruneMetadata(string)).toBe(expected)
    })
  })

  describe('pruneFromMetadataList', () => {
    let metadataList: Array<Record<string, unknown>>

    beforeEach(() => {
      metadataList = [{title: 'Cowboy Bebop'}, {studio: 'Sunrise'}, {tag: 'anime'}]
    })

    describe('when values for key are present', () => {
      it('returns "studio" pair and removes the pair from metadataList', () => {
        const item = pruneFromMetadataList(metadataList, 'studio')
        expect(metadataList).toEqual([{title: 'Cowboy Bebop'}, {tag: 'anime'}])
        expect(item).toEqual({studio: 'Sunrise'})
      })

      it('returns "title" pair and removes the pair from metadataList', () => {
        const item = pruneFromMetadataList(metadataList, 'title')
        expect(metadataList).toEqual([{studio: 'Sunrise'}, {tag: 'anime'}])
        expect(item).toEqual({title: 'Cowboy Bebop'})
      })

      it('returns "tag" pair and removes the pair from metadataList', () => {
        const item = pruneFromMetadataList(metadataList, 'tag')
        expect(metadataList).toEqual([{title: 'Cowboy Bebop'}, {studio: 'Sunrise'}])
        expect(item).toEqual({tag: 'anime'})
      })
    })

    describe('when values for key are not present', () => {
      it('returns original list when key is "director"', () => {
        const item = pruneFromMetadataList(metadataList, 'director')
        expect(metadataList).toEqual([{title: 'Cowboy Bebop'}, {studio: 'Sunrise'}, {tag: 'anime'}])
        expect(item).toBeNull()
      })
    })
  })
})
