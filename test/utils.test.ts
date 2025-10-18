import {describe, expect, it} from '@jest/globals'

import {cleansedAssetName, md5AsFolders} from '../src/utils'

describe('Utils', () => {
  describe('cleansedAssetName', () => {
    it('returns "cover-art.jpg" for cover art files', () => {
      const pathToFile = '/some/path/eivu-coverart.jpg'
      expect(cleansedAssetName(pathToFile)).toBe('cover-art.jpg')
    })

    it('returns "cover-art.png" for cover art files', () => {
      const pathToFile = '/some/path/eivu-coverart.png'
      expect(cleansedAssetName(pathToFile)).toBe('cover-art.png')
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
})
