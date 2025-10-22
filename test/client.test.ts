import {describe, expect, it, jest} from '@jest/globals'
import nock from 'nock'

import {Client} from '../src/client'
import {CloudFile} from '../src/cloud-file'
import {
  AI_OVERLORDS_COMPLETE,
  AI_OVERLORDS_RESERVATION,
  AI_OVERLORDS_S3_RESPONSE,
  AI_OVERLORDS_TRANSFER,
} from './fixtures/responses'

const SERVER_HOST = process.env.EIVU_UPLOAD_SERVER_HOST as string
const BUCKET_UUID = process.env.EIVU_BUCKET_UUID
const URL_BUCKET_PREFIX = `/api/upload/v1/buckets/${BUCKET_UUID}`
const aiFilesize = 66_034

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
    })

    it('can be instantiated', () => {
      const client = new Client()
      expect(client).toBeInstanceOf(Client)
    })
  })
})
