import {describe, expect, it, jest} from '@jest/globals'
import nock from 'nock'

import {Client} from '../src/client'
import {CloudFile} from '../src/cloud-file'
import {
  AI_OVERLORDS_COMPLETE,
  AI_OVERLORDS_RESERVATION,
  AI_OVERLORDS_S3_RESPONSE,
  AI_OVERLORDS_TRANSFER,
  FROG_PRINCE_COVER_ART_COMPLETE,
  FROG_PRINCE_COVER_ART_DATA_PROFILE,
  FROG_PRINCE_COVER_ART_RESERVATION,
  FROG_PRINCE_COVER_ART_TRANSFER,
  FROG_PRINCE_PARAGRAPH_1_COMPLETE,
  FROG_PRINCE_PARAGRAPH_1_DATA_PROFILE,
  FROG_PRINCE_PARAGRAPH_1_RESERVATION,
  FROG_PRINCE_PARAGRAPH_1_TRANSFER,
} from './fixtures/responses'
import {pruneDynamicAttributes} from './helpers'

const SERVER_HOST = process.env.EIVU_UPLOAD_SERVER_HOST as string
const BUCKET_UUID = process.env.EIVU_BUCKET_UUID
const URL_BUCKET_PREFIX = `/api/upload/v1/buckets/${BUCKET_UUID}`
const aiFilesize = 66_034
const coverArtFilesize = 125_446
const audioFilesize = 781_052

const FROG_PRINCE_COVER_ART_S3_RESPONSE = {
  $metadata: {
    attempts: 1,
    httpStatusCode: 200,
  },
  ETag: '"f5b5dd551bd75a524be57c0a5f1675a8"',
}

const FROG_PRINCE_PARAGRAPH_1_S3_RESPONSE = {
  $metadata: {
    attempts: 1,
    httpStatusCode: 200,
  },
  ETag: '"bc55a3994827bf6389bac9ee6b62fc64"',
}

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

describe('Client', () => {
  describe('upload', () => {
    beforeEach(() => {
      nock.cleanAll()
      jest.clearAllMocks()
      mockSend.mockClear()
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    describe('success', () => {
      it('uploads an image file, when it does not exist on the server', async () => {
        mockSend.mockResolvedValue(AI_OVERLORDS_S3_RESPONSE)
        const client = new Client()
        const pathToFile = 'test/fixtures/samples/image/ai overlords.jpg'

        const reserveReq = nock(SERVER_HOST)
          .post(`${URL_BUCKET_PREFIX}/cloud_files/7ED971313D1AEA1B6E2BF8AF24BED64A/reserve`, {
            nsfw: false,
            secured: false,
          })
          .query({keyFormat: 'camel_lower'})
          .reply(200, AI_OVERLORDS_RESERVATION)

        const transferReq = nock(SERVER_HOST)
          .post(`${URL_BUCKET_PREFIX}/cloud_files/7ED971313D1AEA1B6E2BF8AF24BED64A/transfer`, {
            asset: 'ai_overlords.jpg',
            content_type: 'image/jpeg', // eslint-disable-line camelcase
            filesize: aiFilesize,
          })
          .query({keyFormat: 'camel_lower'})
          .reply(200, AI_OVERLORDS_TRANSFER)

        const checkOnlineReq = nock(`https://${process.env.EIVU_BUCKET_NAME}.s3.wasabisys.com`)
          .head('/image/7E/D9/71/31/3D/1A/EA/1B/6E/2B/F8/AF/24/BE/D6/4A/ai_overlords.jpg')
          .reply(200, 'body', {
            'Content-Length': String(aiFilesize),
          })

        /* eslint-disable camelcase */
        const completeReq = nock(SERVER_HOST)
          .post(`${URL_BUCKET_PREFIX}/cloud_files/7ED971313D1AEA1B6E2BF8AF24BED64A/complete`, {
            artists: [],
            artwork_md5: null,
            duration: null,
            metadata_list: [{original_local_path_to_file: pathToFile}],
            name: null,
            path_to_file: pathToFile,
            rating: null,
            release: {
              artwork_md5: null,
              bundle_pos: null,
              name: null,
              position: null,
              primary_artist_name: null,
              year: null,
            },
            year: null,
          })
          .query({keyFormat: 'camel_lower'})
          .reply(200, AI_OVERLORDS_COMPLETE)
        /* eslint-enable camelcase */

        const cloudFile = await client.upload({pathToFile})

        expect(cloudFile).toBeInstanceOf(CloudFile)
        expect(cloudFile.localPathToFile).toBe(pathToFile)
        expect(cloudFile.remoteAttr).toBeDefined()
        expect(cloudFile.resourceType).toBe('image')
        expect(reserveReq.isDone()).toBe(true)
        expect(transferReq.isDone()).toBe(true)
        expect(checkOnlineReq.isDone()).toBe(true)
        expect(completeReq.isDone()).toBe(true)
        expect(mockSend).toHaveBeenCalledTimes(1)
      })

      it('uploads an audio file with cover art, when it does not exist on the server', async () => {
        // Mock S3 uploads - audio file is uploaded first, then cover art during metadata extraction
        mockSend.mockResolvedValueOnce(FROG_PRINCE_PARAGRAPH_1_S3_RESPONSE)
        mockSend.mockResolvedValueOnce(FROG_PRINCE_COVER_ART_S3_RESPONSE)

        const client = new Client()
        const pathToFile = 'test/fixtures/samples/audio/brothers_grimm/the_frog_prince/paragraph1.mp3'

        // Cover art requests
        const coverArtReserveReq = nock(SERVER_HOST)
          .post(`${URL_BUCKET_PREFIX}/cloud_files/F5B5DD551BD75A524BE57C0A5F1675A8/reserve`, {
            nsfw: false,
            secured: false,
          })
          .query({keyFormat: 'camel_lower'})
          .reply(200, FROG_PRINCE_COVER_ART_RESERVATION)

        const coverArtCheckOnlineReq = nock(`https://${process.env.EIVU_BUCKET_NAME}.s3.wasabisys.com`)
          .head('/image/F5/B5/DD/55/1B/D7/5A/52/4B/E5/7C/0A/5F/16/75/A8/coverart-extractedByEivu.jpeg')
          .reply(200, 'body', {
            'Content-Length': String(coverArtFilesize),
          })

        const coverArtTransferReq = nock(SERVER_HOST)
          .post(`${URL_BUCKET_PREFIX}/cloud_files/F5B5DD551BD75A524BE57C0A5F1675A8/transfer`, {
            asset: 'coverart-extractedByEivu.jpeg',
            content_type: 'image/jpeg', // eslint-disable-line camelcase
            filesize: coverArtFilesize,
          })
          .query({keyFormat: 'camel_lower'})
          .reply(200, FROG_PRINCE_COVER_ART_TRANSFER)

        const coverArtCompleteReq = nock(SERVER_HOST)
          .post(
            `${URL_BUCKET_PREFIX}/cloud_files/F5B5DD551BD75A524BE57C0A5F1675A8/complete`,
            pruneDynamicAttributes(FROG_PRINCE_COVER_ART_DATA_PROFILE),
          )
          .query({keyFormat: 'camel_lower'})
          .reply(200, FROG_PRINCE_COVER_ART_COMPLETE)

        // Audio file requests
        const reserveReq = nock(SERVER_HOST)
          .post(`${URL_BUCKET_PREFIX}/cloud_files/BC55A3994827BF6389BAC9EE6B62FC64/reserve`, {
            nsfw: false,
            secured: false,
          })
          .query({keyFormat: 'camel_lower'})
          .reply(200, FROG_PRINCE_PARAGRAPH_1_RESERVATION)

        const transferReq = nock(SERVER_HOST)
          .post(`${URL_BUCKET_PREFIX}/cloud_files/BC55A3994827BF6389BAC9EE6B62FC64/transfer`, {
            asset: 'paragraph1.mp3',
            content_type: 'audio/mpeg', // eslint-disable-line camelcase
            filesize: audioFilesize,
          })
          .query({keyFormat: 'camel_lower'})
          .reply(200, FROG_PRINCE_PARAGRAPH_1_TRANSFER)

        const checkOnlineReq = nock(`https://${process.env.EIVU_BUCKET_NAME}.s3.wasabisys.com`)
          .head('/audio/BC/55/A3/99/48/27/BF/63/89/BA/C9/EE/6B/62/FC/64/paragraph1.mp3')
          .reply(200, 'body', {
            'Content-Length': String(audioFilesize),
          })

        // const matchAudioComplete = (body: Record<string, unknown>): boolean =>
        //   Array.isArray(body.artists) &&
        //   body.artists.length === 1 &&
        //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
        //   (body.artists as any)[0].name === 'The Brothers Grimm' &&
        //   body.artwork_md5 === 'F5B5DD551BD75A524BE57C0A5F1675A8' &&
        //   body.duration === 45.24 &&
        //   Array.isArray(body.metadata_list) &&
        //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
        //   (body.metadata_list as any).length > 0 &&
        //   body.name === 'Paragraph #1' &&
        //   body.path_to_file === pathToFile &&
        //   body.rating === null &&
        //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
        //   (body.release as any).artwork_md5 === 'F5B5DD551BD75A524BE57C0A5F1675A8' &&
        //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
        //   (body.release as any).bundle_pos === null &&
        //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
        //   (body.release as any).name === 'The Frog Prince' &&
        //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
        //   (body.release as any).position === 1 &&
        //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
        //   (body.release as any).primary_artist_name === 'brothers grimm' &&
        //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
        //   (body.release as any).year === 1811 &&
        //   body.year === 1811

        const completeReq = nock(SERVER_HOST)
          .post(
            `${URL_BUCKET_PREFIX}/cloud_files/BC55A3994827BF6389BAC9EE6B62FC64/complete`,
            FROG_PRINCE_PARAGRAPH_1_DATA_PROFILE,
          )
          .query({keyFormat: 'camel_lower'})
          .reply(200, FROG_PRINCE_PARAGRAPH_1_COMPLETE)

        const cloudFile = await client.upload({pathToFile})

        expect(cloudFile).toBeInstanceOf(CloudFile)
        expect(cloudFile.localPathToFile).toBe(pathToFile)
        expect(cloudFile.remoteAttr).toBeDefined()
        expect(cloudFile.resourceType).toBe('audio')
        expect(coverArtReserveReq.isDone()).toBe(true)
        expect(coverArtCheckOnlineReq.isDone()).toBe(true)
        expect(coverArtTransferReq.isDone()).toBe(true)
        expect(coverArtCompleteReq.isDone()).toBe(true)
        expect(reserveReq.isDone()).toBe(true)
        expect(transferReq.isDone()).toBe(true)
        expect(checkOnlineReq.isDone()).toBe(true)
        expect(completeReq.isDone()).toBe(true)
        expect(mockSend).toHaveBeenCalledTimes(2)
      })
    })

    it('can be instantiated', () => {
      const client = new Client()
      expect(client).toBeInstanceOf(Client)
    })
  })
})
