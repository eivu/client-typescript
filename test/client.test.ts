import {describe, expect, it, jest} from '@jest/globals'
import nock from 'nock'

import {Client} from '../src/client'
import {CloudFile} from '../src/cloud-file'
import {AI_OVERLORDS_RESERVATION, AI_OVERLORDS_S3_RESPONSE} from './fixtures/responses'

const SERVER_HOST = process.env.EIVU_UPLOAD_SERVER_HOST as string
const BUCKET_UUID = process.env.EIVU_BUCKET_UUID
const URL_BUCKET_PREFIX = `/api/upload/v1/buckets/${BUCKET_UUID}`

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

        const cloudFile = await client.upload(pathToFile)

        expect(cloudFile).toBeInstanceOf(CloudFile)
        expect(cloudFile.localPathToFile).toBe(pathToFile)
        expect(cloudFile.remoteAttr).toBeDefined()
        expect(cloudFile.resourceType).toBe('image')
        expect(reserveReq.isDone()).toBe(true)
        expect(mockSend).toHaveBeenCalledTimes(1)
      })
    })

    it('can be instantiated', () => {
      const client = new Client()
      expect(client).toBeInstanceOf(Client)
    })
  })
})
