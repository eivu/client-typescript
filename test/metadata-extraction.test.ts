/// <reference types="./jest-extended" />
import {describe, expect, it, jest} from '@jest/globals'
import nock from 'nock'

import {
  EMPTY_METADATA_PROFILE,
  extractAudioInfo,
  extractInfoFromYml,
  extractMetadataList,
  extractRating,
  extractYear,
  filterMetadataProfile,
  generateAcoustidFingerprint,
  generateDataProfile,
  type MetadataPair,
  type MetadataProfile,
  pruneFromMetadataList,
  pruneMetadata,
  removeAllNullObjects,
  uploadComicMetadataArtwork,
} from '../src/metadata-extraction'
import {
  BAD_STORY_DATA_PROFILE,
  BAD_STORY_PARSED_YML,
  DREDD_DATA_PROFILE,
  FROG_PRINCE_COVER_ART_COMPLETE,
  FROG_PRINCE_COVER_ART_DATA_PROFILE,
  FROG_PRINCE_COVER_ART_RESERVATION,
  FROG_PRINCE_COVER_ART_S3_RESPONSE,
  FROG_PRINCE_COVER_ART_TRANSFER,
  FROG_PRINCE_PARAGRAPH_1_AUDIO_INFO_WITH_COVER_ART,
  FROG_PRINCE_PARAGRAPH_1_DATA_PROFILE,
  FROG_PRINCE_PARAGRAPH_1_FINGERPRINT,
  SPACE_ADVENTURES_033_1960_COVER_ART_COMPLETE,
  SPACE_ADVENTURES_033_1960_COVER_ART_DATA_PROFILE,
  SPACE_ADVENTURES_033_1960_COVER_ART_RESERVATION,
  SPACE_ADVENTURES_033_1960_COVER_ART_S3_RESPONSE,
  SPACE_ADVENTURES_033_1960_COVER_ART_TRANSFER,
  THE_PEACEMAKER_01_1967_COVER_ART_COMPLETE,
  THE_PEACEMAKER_01_1967_COVER_ART_DATA_PROFILE,
  THE_PEACEMAKER_01_1967_COVER_ART_RESERVATION,
  THE_PEACEMAKER_01_1967_COVER_ART_S3_RESPONSE,
  THE_PEACEMAKER_01_1967_COVER_ART_TRANSFER,
  THE_PEACEMAKER_01_1967_DATA_PROFILE,
  THE_PEACEMAKER_01_1967_PARSED_YML,
} from './fixtures/responses'
import {removeAttributeFromBodyTest} from './helpers'

const SERVER_HOST = process.env.EIVU_UPLOAD_SERVER_HOST as string
const BUCKET_UUID = process.env.EIVU_BUCKET_UUID
const URL_BUCKET_PREFIX = `/api/upload/v1/buckets/${BUCKET_UUID}`

// Mock the AWS SDK S3Client
const mockSend = jest.fn() as jest.MockedFunction<(command: unknown) => Promise<unknown>>
jest.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: jest.fn(),
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  S3ServiceException: class S3ServiceException extends Error {
    name: string

    constructor(message: string, name = 'S3ServiceException') {
      super(message)
      this.name = name
    }
  },
}))

describe('Metadata Extraction', () => {
  describe('extractAudioInfo', () => {
    it('extracts audio info from paragraph1.mp3', async () => {
      const pathToFile = 'test/fixtures/samples/audio/brothers_grimm/the_frog_prince/paragraph1.mp3'

      const coverArtFilesize = 125_446

      // Mock S3 upload
      mockSend.mockResolvedValue(FROG_PRINCE_COVER_ART_S3_RESPONSE)

      const coverArtReserveReq = nock(SERVER_HOST)
        .post(`${URL_BUCKET_PREFIX}/cloud_files/F5B5DD551BD75A524BE57C0A5F1675A8/reserve`, {
          nsfw: false,
          secured: false,
        })
        .query({keyFormat: 'camel_lower'})
        .reply(200, FROG_PRINCE_COVER_ART_RESERVATION)

      // Mock the HEAD request to check if file is online
      const coverArtOnlineReq = nock(`https://${process.env.EIVU_BUCKET_NAME}.s3.wasabisys.com`)
        .head('/image/F5/B5/DD/55/1B/D7/5A/52/4B/E5/7C/0A/5F/16/75/A8/coverart-extractedByEivu-forAudio.jpeg')
        .reply(200, 'body', {
          'Content-Length': String(coverArtFilesize),
        })

      const coverArtTransferReq = nock(SERVER_HOST)
        .post(`${URL_BUCKET_PREFIX}/cloud_files/F5B5DD551BD75A524BE57C0A5F1675A8/transfer`, {
          asset: 'coverart-extractedByEivu-forAudio.jpeg',
          content_type: 'image/jpeg', // eslint-disable-line camelcase
          filesize: coverArtFilesize,
        })
        .query({keyFormat: 'camel_lower'})
        .reply(200, FROG_PRINCE_COVER_ART_TRANSFER)

      const coverArtCompleteReq = nock(SERVER_HOST)
        .post(
          `${URL_BUCKET_PREFIX}/cloud_files/F5B5DD551BD75A524BE57C0A5F1675A8/complete`,
          removeAttributeFromBodyTest(FROG_PRINCE_COVER_ART_DATA_PROFILE, ['path_to_file']),
        )
        .query({keyFormat: 'camel_lower'})
        .reply(200, FROG_PRINCE_COVER_ART_COMPLETE)

      const result = await extractAudioInfo(pathToFile)
      expect(result).toIncludeSameMembers(FROG_PRINCE_PARAGRAPH_1_AUDIO_INFO_WITH_COVER_ART)
      expect(coverArtReserveReq.isDone()).toBeTrue()
      expect(coverArtOnlineReq.isDone()).toBeTrue()
      expect(coverArtTransferReq.isDone()).toBeTrue()
      expect(coverArtCompleteReq.isDone()).toBeTrue()
    })

    it('extracts audio info from piano_brokencrash', async () => {
      const pathToFile = 'test/fixtures/samples/audio/Piano_brokencrash-Brandondorf-1164520478.mp3'
      const result = await extractAudioInfo(pathToFile)
      expect(result).toIncludeSameMembers([
        {
          'acoustid:duration': 4.18,
        },
        {
          'acoustid:fingerprint': 'AQAADEnGJKEUSkHEn2hUpqi0ZMiFr0qh5TrCzfnQxNmDPoyRCyUDYAwQAghgAA',
        },
        {
          'eivu:duration': 4.18,
        },
      ])
    })
  })

  describe('extractInfoFromYml', () => {
    it('extracts metadata for _bad_story ((y 1902)).txt', async () => {
      const pathToFile = 'test/fixtures/samples/text/_bad_story ((y 1902)).txt'
      const result: MetadataProfile = await extractInfoFromYml(pathToFile)
      expect(result).toEqual(BAD_STORY_PARSED_YML)
    })

    it('extracts metadata for The_Peacemaker_01_1967.eivu_compressed.cbz', async () => {
      const pathToFile = 'test/fixtures/samples/comics/The_Peacemaker_01_1967.eivu_compressed.cbz'
      const result: MetadataProfile = await extractInfoFromYml(pathToFile)
      expect(result).toEqual(THE_PEACEMAKER_01_1967_PARSED_YML)
    })

    it('returns an empty profile for mov_bbb.mp4', async () => {
      const pathToFile = 'test/fixtures/samples/video/mov_bbb.mp4'
      const result: MetadataProfile = await extractInfoFromYml(pathToFile)
      expect(result).toEqual({...EMPTY_METADATA_PROFILE, path_to_file: pathToFile}) // eslint-disable-line camelcase
    })
  })

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

  describe('generateAcoustidFingerprint', () => {
    it('generates an AcoustidFingerprint for paragraph1.mp3', async () => {
      const pathToFile = 'test/fixtures/samples/audio/brothers_grimm/the_frog_prince/paragraph1.mp3'
      const result = await generateAcoustidFingerprint(pathToFile)
      expect(result).toEqual({
        duration: 45.24,
        fingerprint: FROG_PRINCE_PARAGRAPH_1_FINGERPRINT,
      })
    })

    it('generates an AcoustidFingerprint for piano_brokencrash', async () => {
      const pathToFile = 'test/fixtures/samples/audio/Piano_brokencrash-Brandondorf-1164520478.mp3'
      const result = await generateAcoustidFingerprint(pathToFile)
      expect(result).toEqual({
        duration: 4.18,
        fingerprint: 'AQAADEnGJKEUSkHEn2hUpqi0ZMiFr0qh5TrCzfnQxNmDPoyRCyUDYAwQAghgAA',
      })
    })
  })

  describe('generateDataProfile', () => {
    it('generates a data profile for _bad_story ((y 1902)).txt', async () => {
      const pathToFile = 'test/fixtures/samples/text/_bad_story ((y 1902)).txt'
      const result: MetadataProfile = await generateDataProfile({pathToFile})
      expect(result).toEqual(BAD_STORY_DATA_PROFILE)
    })

    it('generates a data profile for The_Peacemaker_01_1967.eivu_compressed.cbz', async () => {
      nock.cleanAll()
      const coverArtFilesize = 775_296

      // Mock S3 upload
      mockSend.mockResolvedValue(THE_PEACEMAKER_01_1967_COVER_ART_S3_RESPONSE)
      const pathToFile = 'test/fixtures/samples/comics/The_Peacemaker_01_1967.eivu_compressed.cbz'

      const coverArtReserveReq = nock(SERVER_HOST)
        .post(`${URL_BUCKET_PREFIX}/cloud_files/FC95C8DB0CECB47D449DFFD694AD963C/reserve`, {
          nsfw: false,
          secured: false,
        })
        .query({keyFormat: 'camel_lower'})
        .reply(200, THE_PEACEMAKER_01_1967_COVER_ART_RESERVATION)

      // Mock the HEAD request to check if file is online
      const coverArtOnlineReq = nock(`https://${process.env.EIVU_BUCKET_NAME}.s3.wasabisys.com`)
        .head('/image/FC/95/C8/DB/0C/EC/B4/7D/44/9D/FF/D6/94/AD/96/3C/coverart-extractedByEivu-forComic.webp')
        .reply(200, 'body', {
          'Content-Length': String(coverArtFilesize),
        })

      const coverArtTransferReq = nock(SERVER_HOST)
        .post(`${URL_BUCKET_PREFIX}/cloud_files/FC95C8DB0CECB47D449DFFD694AD963C/transfer`, {
          asset: 'coverart-extractedByEivu-forComic.webp',
          content_type: 'image/webp', // eslint-disable-line camelcase
          filesize: coverArtFilesize,
        })
        .query({keyFormat: 'camel_lower'})
        .reply(200, THE_PEACEMAKER_01_1967_COVER_ART_TRANSFER)

      const coverArtCompleteReq = nock(SERVER_HOST)
        .post(
          `${URL_BUCKET_PREFIX}/cloud_files/FC95C8DB0CECB47D449DFFD694AD963C/complete`,
          removeAttributeFromBodyTest(THE_PEACEMAKER_01_1967_COVER_ART_DATA_PROFILE, ['path_to_file']),
        )
        .query({keyFormat: 'camel_lower'})
        .reply(200, THE_PEACEMAKER_01_1967_COVER_ART_COMPLETE)

      const result: MetadataProfile = await generateDataProfile({pathToFile})
      expect(result).toEqual(THE_PEACEMAKER_01_1967_DATA_PROFILE)
      expect(coverArtReserveReq.isDone()).toBeTrue()
      expect(coverArtOnlineReq.isDone()).toBeTrue()
      expect(coverArtTransferReq.isDone()).toBeTrue()
      expect(coverArtCompleteReq.isDone()).toBeTrue()
    })

    it('generates a data profile for _Dredd ((Comic Book Movie)) ((p Karl Urban)) ((p Lena Headey)) ((s DNA Films)) ((script)) ((y 2012)).txt', async () => {
      const pathToFile =
        'test/fixtures/samples/text/_Dredd ((Comic Book Movie)) ((p Karl Urban)) ((p Lena Headey)) ((s DNA Films)) ((script)) ((y 2012)).txt'
      expect(await generateDataProfile({pathToFile})).toEqual(DREDD_DATA_PROFILE)
    })

    it('generates a data profile for paragraph1.mp3', async () => {
      const pathToFile = 'test/fixtures/samples/audio/brothers_grimm/the_frog_prince/paragraph1.mp3'
      const coverArtFilesize = 125_446

      // Mock S3 upload
      mockSend.mockResolvedValue(FROG_PRINCE_COVER_ART_S3_RESPONSE)

      const coverArtReserveReq = nock(SERVER_HOST)
        .post(`${URL_BUCKET_PREFIX}/cloud_files/F5B5DD551BD75A524BE57C0A5F1675A8/reserve`, {
          nsfw: false,
          secured: false,
        })
        .query({keyFormat: 'camel_lower'})
        .reply(200, FROG_PRINCE_COVER_ART_RESERVATION)

      // Mock the HEAD request to check if file is online
      const coverArtOnlineReq = nock(`https://${process.env.EIVU_BUCKET_NAME}.s3.wasabisys.com`)
        .head('/image/F5/B5/DD/55/1B/D7/5A/52/4B/E5/7C/0A/5F/16/75/A8/coverart-extractedByEivu-forAudio.jpeg')
        .reply(200, 'body', {
          'Content-Length': String(coverArtFilesize),
        })

      const coverArtTransferReq = nock(SERVER_HOST)
        .post(`${URL_BUCKET_PREFIX}/cloud_files/F5B5DD551BD75A524BE57C0A5F1675A8/transfer`, {
          asset: 'coverart-extractedByEivu-forAudio.jpeg',
          content_type: 'image/jpeg', // eslint-disable-line camelcase
          filesize: coverArtFilesize,
        })
        .query({keyFormat: 'camel_lower'})
        .reply(200, FROG_PRINCE_COVER_ART_TRANSFER)

      const coverArtCompleteReq = nock(SERVER_HOST)
        .post(
          `${URL_BUCKET_PREFIX}/cloud_files/F5B5DD551BD75A524BE57C0A5F1675A8/complete`,
          removeAttributeFromBodyTest(FROG_PRINCE_COVER_ART_DATA_PROFILE, ['path_to_file']),
        )
        .query({keyFormat: 'camel_lower'})
        .reply(200, FROG_PRINCE_COVER_ART_COMPLETE)

      const generatedProfile = await generateDataProfile({pathToFile})
      const sourceProfile = FROG_PRINCE_PARAGRAPH_1_DATA_PROFILE
      // refactor with lodash
      const alteredMetadataList = generatedProfile.metadata_list.filter(
        (item) => !Object.keys(item)[0].startsWith('eivu:'),
      )

      sourceProfile.metadata_list = alteredMetadataList as any // eslint-disable-line camelcase, @typescript-eslint/no-explicit-any
      expect(generatedProfile).toEqual(sourceProfile)
      expect(coverArtReserveReq.isDone()).toBeTrue()
      expect(coverArtOnlineReq.isDone()).toBeTrue()
      expect(coverArtTransferReq.isDone()).toBeTrue()
      expect(coverArtCompleteReq.isDone()).toBeTrue()
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
    let metadataList: MetadataPair[]

    beforeEach(() => {
      metadataList = [{title: 'Cowboy Bebop'}, {studio: 'Sunrise'}, {tag: 'anime'}]
    })

    describe('when values for key are present', () => {
      it('returns "studio" pair and removes the pair from metadataList', () => {
        const value = pruneFromMetadataList(metadataList, 'studio')
        expect(metadataList).toEqual([{title: 'Cowboy Bebop'}, {tag: 'anime'}])
        expect(value).toEqual('Sunrise')
      })

      it('returns "title" pair and removes the pair from metadataList', () => {
        const value = pruneFromMetadataList(metadataList, 'title')
        expect(metadataList).toEqual([{studio: 'Sunrise'}, {tag: 'anime'}])
        expect(value).toEqual('Cowboy Bebop')
      })

      it('returns "tag" pair and removes the pair from metadataList', () => {
        const value = pruneFromMetadataList(metadataList, 'tag')
        expect(metadataList).toEqual([{title: 'Cowboy Bebop'}, {studio: 'Sunrise'}])
        expect(value).toEqual('anime')
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

  describe('uploadComicMetadataArtwork', () => {
    it('uploads the first zip entry for The_Peacemaker_01_1967.eivu_compressed.cbz', async () => {
      nock.cleanAll()
      const coverArtFilesize = 775_296

      // Mock S3 upload
      mockSend.mockResolvedValue(THE_PEACEMAKER_01_1967_COVER_ART_S3_RESPONSE)
      const pathToFile = 'test/fixtures/samples/comics/The_Peacemaker_01_1967.eivu_compressed.cbz'

      const coverArtReserveReq = nock(SERVER_HOST)
        .post(`${URL_BUCKET_PREFIX}/cloud_files/FC95C8DB0CECB47D449DFFD694AD963C/reserve`, {
          nsfw: false,
          secured: false,
        })
        .query({keyFormat: 'camel_lower'})
        .reply(200, THE_PEACEMAKER_01_1967_COVER_ART_RESERVATION)

      // Mock the HEAD request to check if file is online
      const coverArtOnlineReq = nock(`https://${process.env.EIVU_BUCKET_NAME}.s3.wasabisys.com`)
        .head('/image/FC/95/C8/DB/0C/EC/B4/7D/44/9D/FF/D6/94/AD/96/3C/coverart-extractedByEivu-forComic.webp')
        .reply(200, 'body', {
          'Content-Length': String(coverArtFilesize),
        })

      const coverArtTransferReq = nock(SERVER_HOST)
        .post(`${URL_BUCKET_PREFIX}/cloud_files/FC95C8DB0CECB47D449DFFD694AD963C/transfer`, {
          asset: 'coverart-extractedByEivu-forComic.webp',
          content_type: 'image/webp', // eslint-disable-line camelcase
          filesize: coverArtFilesize,
        })
        .query({keyFormat: 'camel_lower'})
        .reply(200, THE_PEACEMAKER_01_1967_COVER_ART_TRANSFER)

      const coverArtCompleteReq = nock(SERVER_HOST)
        .post(
          `${URL_BUCKET_PREFIX}/cloud_files/FC95C8DB0CECB47D449DFFD694AD963C/complete`,
          removeAttributeFromBodyTest(THE_PEACEMAKER_01_1967_COVER_ART_DATA_PROFILE, ['path_to_file']),
        )
        .query({keyFormat: 'camel_lower'})
        .reply(200, THE_PEACEMAKER_01_1967_COVER_ART_COMPLETE)
      const result = await uploadComicMetadataArtwork(pathToFile)
      expect(result).toEqual({'eivu:artwork_md5': 'FC95C8DB0CECB47D449DFFD694AD963C'})
      expect(coverArtReserveReq.isDone()).toBeTrue()
      expect(coverArtOnlineReq.isDone()).toBeTrue()
      expect(coverArtTransferReq.isDone()).toBeTrue()
      expect(coverArtCompleteReq.isDone()).toBeTrue()
    })

    it('uploads the first entry for Space_Adventures_033.eivu_compressed.cbr (tests RAR extraction with ZIP fallback)', async () => {
      nock.cleanAll()
      const coverArtFilesize = 396_820

      // Mock S3 upload
      mockSend.mockResolvedValue(SPACE_ADVENTURES_033_1960_COVER_ART_S3_RESPONSE)
      const pathToFile = 'test/fixtures/samples/comics/Space_Adventures_033.eivu_compressed.cbr'

      const coverArtReserveReq = nock(SERVER_HOST)
        .post(`${URL_BUCKET_PREFIX}/cloud_files/6C42CC77B1747B882C9D2A234E41D3FD/reserve`, {
          nsfw: false,
          secured: false,
        })
        .query({keyFormat: 'camel_lower'})
        .reply(200, SPACE_ADVENTURES_033_1960_COVER_ART_RESERVATION)

      // Mock the HEAD request to check if file is online
      const coverArtOnlineReq = nock(`https://${process.env.EIVU_BUCKET_NAME}.s3.wasabisys.com`)
        .head('/image/6C/42/CC/77/B1/74/7B/88/2C/9D/2A/23/4E/41/D3/FD/coverart-extractedByEivu-forComic.webp')
        .reply(200, 'body', {
          'Content-Length': String(coverArtFilesize),
        })

      const coverArtTransferReq = nock(SERVER_HOST)
        .post(`${URL_BUCKET_PREFIX}/cloud_files/6C42CC77B1747B882C9D2A234E41D3FD/transfer`, {
          asset: 'coverart-extractedByEivu-forComic.webp',
          content_type: 'image/webp', // eslint-disable-line camelcase
          filesize: coverArtFilesize,
        })
        .query({keyFormat: 'camel_lower'})
        .reply(200, SPACE_ADVENTURES_033_1960_COVER_ART_TRANSFER)

      const coverArtCompleteReq = nock(SERVER_HOST)
        .post(
          `${URL_BUCKET_PREFIX}/cloud_files/6C42CC77B1747B882C9D2A234E41D3FD/complete`,
          removeAttributeFromBodyTest(SPACE_ADVENTURES_033_1960_COVER_ART_DATA_PROFILE, ['path_to_file']),
        )
        .query({keyFormat: 'camel_lower'})
        .reply(200, SPACE_ADVENTURES_033_1960_COVER_ART_COMPLETE)

      const result = await uploadComicMetadataArtwork(pathToFile)
      expect(result).toEqual({'eivu:artwork_md5': '6C42CC77B1747B882C9D2A234E41D3FD'})
      expect(coverArtReserveReq.isDone()).toBeTrue()
      expect(coverArtOnlineReq.isDone()).toBeTrue()
      expect(coverArtTransferReq.isDone()).toBeTrue()
      expect(coverArtCompleteReq.isDone()).toBeTrue()
    })
  })

  describe('removeAllNullObjects', () => {
    it('returns null for null input', () => {
      expect(removeAllNullObjects(null)).toBeNull()
    })

    it('returns null for undefined input', () => {
      const value = undefined
      expect(removeAllNullObjects(value)).toBeNull()
    })

    it('returns the value for primitive non-null values', () => {
      expect(removeAllNullObjects(42)).toBe(42)
      expect(removeAllNullObjects('hello')).toBe('hello')
      expect(removeAllNullObjects(true)).toBe(true)
      expect(removeAllNullObjects(false)).toBe(false)
    })

    it('returns null for empty array', () => {
      expect(removeAllNullObjects([])).toBeNull()
    })

    it('returns null for array with only null values', () => {
      expect(removeAllNullObjects([null, null, null])).toBeNull()
    })

    it('filters out null values from array', () => {
      expect(removeAllNullObjects([1, null, 2, null, 3])).toEqual([1, 2, 3])
    })

    it('returns null for empty object', () => {
      expect(removeAllNullObjects({})).toBeNull()
    })

    it('returns null for object with all null values', () => {
      expect(removeAllNullObjects({a: null, b: null, c: null})).toBeNull()
    })

    it('removes null values from object', () => {
      expect(removeAllNullObjects({a: 1, b: null, c: 2, d: null})).toEqual({a: 1, c: 2})
    })

    it('handles nested objects with null values', () => {
      const input = {
        a: 1,
        b: {x: null, y: null},
        c: {x: 1, y: null},
        d: null,
      }
      expect(removeAllNullObjects(input)).toEqual({a: 1, c: {x: 1}})
    })

    it('handles nested arrays with null values', () => {
      const input = [1, [null, 2, null], null, [3, null]]
      expect(removeAllNullObjects(input)).toEqual([1, [2], [3]])
    })

    it('handles complex nested structures', () => {
      const input = {
        a: 1,
        b: {
          x: null,
          y: [null, 2, null],
          z: {p: null, q: 3},
        },
        c: null,
        d: [{a: null}, {b: 1}],
      }
      expect(removeAllNullObjects(input)).toEqual({
        a: 1,
        b: {
          y: [2],
          z: {q: 3},
        },
        d: [{b: 1}],
      })
    })

    it('handles arrays of objects with null values', () => {
      const input = [
        {a: 1, b: null},
        {a: null, b: null},
        {a: 2, b: 3},
      ]
      expect(removeAllNullObjects(input)).toEqual([{a: 1}, {a: 2, b: 3}])
    })

    it('handles objects with arrays containing null values', () => {
      const input = {
        empty: [null, null],
        items: [1, null, 2, null, 3],
        mixed: [{a: 1, b: null}, {a: null, b: null}],
      }
      expect(removeAllNullObjects(input)).toEqual({
        items: [1, 2, 3],
        mixed: [{a: 1}],
      })
    })
  })

  describe('filterMetadataProfile', () => {
    it('removes null values from metadata profile', () => {
      const profile: MetadataProfile = {
        ...EMPTY_METADATA_PROFILE,
        artwork_md5: null, // eslint-disable-line camelcase
        description: null,
        duration: 120,
        name: 'Test File',
        rating: 4.5,
        year: null,
      }
      const result = filterMetadataProfile(profile)
      expect(result).not.toHaveProperty('artwork_md5')
      expect(result).not.toHaveProperty('description')
      expect(result).not.toHaveProperty('year')
      expect(result.name).toBe('Test File')
      expect(result.duration).toBe(120)
      expect(result.rating).toBe(4.5)
    })

    it('removes empty arrays from metadata profile', () => {
      const profile: MetadataProfile = {
        ...EMPTY_METADATA_PROFILE,
        artists: [],
        metadata_list: [], // eslint-disable-line camelcase
        name: 'Test File',
      }
      const result = filterMetadataProfile(profile)
      expect(result).not.toHaveProperty('artists')
      expect(result).not.toHaveProperty('metadata_list')
      expect(result.name).toBe('Test File')
    })

    it('keeps non-empty arrays in metadata profile', () => {
      const profile: MetadataProfile = {
        ...EMPTY_METADATA_PROFILE,
        artists: [{name: 'Artist 1'}],
        metadata_list: [{tag: 'test'}], // eslint-disable-line camelcase
        name: 'Test File',
      }
      const result = filterMetadataProfile(profile)
      expect(result.artists).toEqual([{name: 'Artist 1'}])
      expect(result.metadata_list).toEqual([{tag: 'test'}])
      expect(result.name).toBe('Test File')
    })

    it('removes null values from nested release object', () => {
      const profile: MetadataProfile = {
        ...EMPTY_METADATA_PROFILE,
        name: 'Test File',
        release: {
          artwork_md5: null, // eslint-disable-line camelcase
          bundle_pos: null, // eslint-disable-line camelcase
          name: 'Release Name',
          position: null,
          primary_artist_name: null, // eslint-disable-line camelcase
          year: 2020,
        },
      }
      const result = filterMetadataProfile(profile)
      expect(result.release).not.toHaveProperty('artwork_md5')
      expect(result.release).not.toHaveProperty('bundle_pos')
      expect(result.release).not.toHaveProperty('position')
      expect(result.release).not.toHaveProperty('primary_artist_name')
      expect(result.release.name).toBe('Release Name')
      expect(result.release.year).toBe(2020)
    })

    it('removes empty release object if all values are null', () => {
      const profile: MetadataProfile = {
        ...EMPTY_METADATA_PROFILE,
        name: 'Test File',
        release: {
          artwork_md5: null, // eslint-disable-line camelcase
          bundle_pos: null, // eslint-disable-line camelcase
          name: null,
          position: null,
          primary_artist_name: null, // eslint-disable-line camelcase
          year: null,
        },
      }
      const result = filterMetadataProfile(profile)
      expect(result).not.toHaveProperty('release')
      expect(result.name).toBe('Test File')
    })

    it('handles profile with all null values', () => {
      const profile: MetadataProfile = {
        artists: [],
        artwork_md5: null, // eslint-disable-line camelcase
        description: null,
        duration: null,
        info_url: null, // eslint-disable-line camelcase
        metadata_list: [], // eslint-disable-line camelcase
        name: null,
        path_to_file: null, // eslint-disable-line camelcase
        rating: null,
        release: {
          artwork_md5: null, // eslint-disable-line camelcase
          bundle_pos: null, // eslint-disable-line camelcase
          name: null,
          position: null,
          primary_artist_name: null, // eslint-disable-line camelcase
          year: null,
        },
        year: null,
      }
      const result = filterMetadataProfile(profile)
      // Should return an object with minimal structure (path_to_file might remain as it's required)
      expect(result).toBeDefined()
    })

    it('preserves valid values in complex profile', () => {
      const profile: MetadataProfile = {
        artists: [{name: 'Artist 1'}, {name: 'Artist 2'}],
        artwork_md5: 'ABC123', // eslint-disable-line camelcase
        description: 'Test description',
        duration: 180,
        info_url: 12_345, // eslint-disable-line camelcase
        metadata_list: [{tag: 'test'}, {performer: 'actor'}], // eslint-disable-line camelcase
        name: 'Test File',
        path_to_file: '/path/to/file', // eslint-disable-line camelcase
        rating: 4.75,
        release: {
          artwork_md5: 'DEF456', // eslint-disable-line camelcase
          bundle_pos: 1, // eslint-disable-line camelcase
          name: 'Release Name',
          position: 2,
          primary_artist_name: 'Primary Artist', // eslint-disable-line camelcase
          year: 2020,
        },
        year: 2020,
      }
      const result = filterMetadataProfile(profile)
      expect(result.artists).toEqual([{name: 'Artist 1'}, {name: 'Artist 2'}])
      expect(result.artwork_md5).toBe('ABC123')
      expect(result.description).toBe('Test description')
      expect(result.duration).toBe(180)
      expect(result.info_url).toBe(12_345)
      expect(result.metadata_list).toEqual([{tag: 'test'}, {performer: 'actor'}])
      expect(result.name).toBe('Test File')
      expect(result.path_to_file).toBe('/path/to/file')
      expect(result.rating).toBe(4.75)
      expect(result.release).toEqual({
        artwork_md5: 'DEF456', // eslint-disable-line camelcase
        bundle_pos: 1, // eslint-disable-line camelcase
        name: 'Release Name',
        position: 2,
        primary_artist_name: 'Primary Artist', // eslint-disable-line camelcase
        year: 2020,
      })
      expect(result.year).toBe(2020)
    })

    it('handles empty strings correctly (keeps them)', () => {
      const profile: MetadataProfile = {
        ...EMPTY_METADATA_PROFILE,
        artwork_md5: null, // eslint-disable-line camelcase
        description: '',
        name: '',
      }
      const result = filterMetadataProfile(profile)
      expect(result.name).toBe('')
      expect(result.description).toBe('')
      expect(result).not.toHaveProperty('artwork_md5')
    })

    it('removes undefined values from metadata profile', () => {
      const profile: MetadataProfile = {
        ...EMPTY_METADATA_PROFILE,
        artwork_md5: undefined as any, // eslint-disable-line camelcase, @typescript-eslint/no-explicit-any
        duration: undefined as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        name: 'Test File',
      }
      const result = filterMetadataProfile(profile)
      expect(result).not.toHaveProperty('artwork_md5')
      expect(result).not.toHaveProperty('duration')
      expect(result.name).toBe('Test File')
    })
  })
})
