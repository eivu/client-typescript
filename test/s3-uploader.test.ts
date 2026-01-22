import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'
import {ReadStream} from 'node:fs'

import type {Logger} from '../src/logger'

import {CloudFile} from '../src/cloud-file'
import {S3Uploader, type S3UploaderConfig} from '../src/s3-uploader'
import {cleansedAssetName} from '../src/utils'
import {AI_OVERLORDS_RESERVATION, AI_OVERLORDS_S3_RESPONSE, MOV_BBB_RESERVATION} from './fixtures/responses'

// Mock the AWS SDK S3Client
const mockSend = jest.fn() as jest.MockedFunction<(command: unknown) => Promise<unknown>>
const putObjectCommandMock = jest.fn()

jest.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => {
    putObjectCommandMock(input)
    return input
  }),
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

describe('S3Uploader', () => {
  const s3Config: S3UploaderConfig = {
    accessKeyId: process.env.EIVU_ACCESS_KEY_ID as string,
    bucketName: process.env.EIVU_BUCKET_NAME as string,
    endpoint: process.env.EIVU_ENDPOINT as string,
    region: process.env.EIVU_REGION as string,
    secretAccessKey: process.env.EIVU_SECRET_ACCESS_KEY as string,
  }

  // Create a mock logger for tests
  const mockLogger: Logger = {
    debug: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    info: jest.fn(),
    trace: jest.fn(),
    warn: jest.fn(),
  } as unknown as Logger

  beforeEach(() => {
    jest.clearAllMocks()
    mockSend.mockClear()
    putObjectCommandMock.mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('generateRemotePath', () => {
    describe('image: ai overlords', () => {
      it('generates the correct remote path based on resourceType, md5, and asset', () => {
        const remoteAttr = {
          ...AI_OVERLORDS_RESERVATION,
          asset: cleansedAssetName('test/fixtures/samples/image/ai overlords.jpg'),
        }
        const resourceType = 'image'
        const cloudFile = new CloudFile({remoteAttr, resourceType})
        const s3Uploader = new S3Uploader({assetLogger: mockLogger, cloudFile, s3Config})
        expect(s3Uploader.generateRemotePath()).toBe(
          'image/7E/D9/71/31/3D/1A/EA/1B/6E/2B/F8/AF/24/BE/D6/4A/ai_overlords.jpg',
        )
      })
    })

    describe('video: big buck bunny', () => {
      it('generates the correct remote path based on resourceType, md5, and asset', () => {
        const remoteAttr = {...MOV_BBB_RESERVATION, asset: cleansedAssetName('test/fixtures/samples/video/mov_bbb.mp4')}
        const resourceType = 'video'

        const cloudFile = new CloudFile({remoteAttr, resourceType})
        const s3Uploader = new S3Uploader({assetLogger: mockLogger, cloudFile, s3Config})
        expect(s3Uploader.generateRemotePath()).toBe(
          'video/19/89/18/F4/0E/CC/7C/AB/0F/C4/23/1A/DA/F6/7C/96/mov_bbb.mp4',
        )
      })
    })
  })

  describe('putLocalFile', () => {
    describe('image: ai overlords', () => {
      it('uploads the local file to S3 and returns true', async () => {
        // Setup the mock to return the expected response
        mockSend.mockResolvedValue(AI_OVERLORDS_S3_RESPONSE)

        const cloudFile = new CloudFile({
          localPathToFile: 'test/fixtures/samples/image/ai overlords.jpg',
          remoteAttr: {
            ...AI_OVERLORDS_RESERVATION,
            asset: cleansedAssetName('test/fixtures/samples/image/ai overlords.jpg'),
          },
          resourceType: 'image',
        })

        const s3Uploader = new S3Uploader({assetLogger: mockLogger, cloudFile, s3Config})
        const result = await s3Uploader.putLocalFile()

        expect(result).toBe(true)
        expect(mockSend).toHaveBeenCalledTimes(1)
      })

      it('uses a Buffer to support AWS SDK retry behavior', async () => {
        // Setup the mock to return the expected response
        mockSend.mockResolvedValue(AI_OVERLORDS_S3_RESPONSE)

        const cloudFile = new CloudFile({
          localPathToFile: 'test/fixtures/samples/image/ai overlords.jpg',
          remoteAttr: {
            ...AI_OVERLORDS_RESERVATION,
            asset: cleansedAssetName('test/fixtures/samples/image/ai overlords.jpg'),
          },
          resourceType: 'image',
        })

        const s3Uploader = new S3Uploader({assetLogger: mockLogger, cloudFile, s3Config})
        await s3Uploader.putLocalFile()

        // Verify PutObjectCommand was called
        expect(putObjectCommandMock).toHaveBeenCalledTimes(1)

        // Get the arguments passed to PutObjectCommand constructor
        const commandArgs = putObjectCommandMock.mock.calls[0][0] as {Body: unknown}

        // Verify that Body is a Buffer, not a ReadStream
        // Buffers can be reused on retries, whereas streams can only be consumed once
        expect(commandArgs.Body).toBeInstanceOf(Buffer)
        expect(commandArgs.Body).not.toBeInstanceOf(ReadStream)
      })

      it('throws an error when localPathToFile is null', async () => {
        const cloudFile = new CloudFile({
          localPathToFile: null,
          remoteAttr: {
            ...AI_OVERLORDS_RESERVATION,
            asset: cleansedAssetName('test/fixtures/samples/image/ai overlords.jpg'),
          },
          resourceType: 'image',
        })

        const s3Uploader = new S3Uploader({assetLogger: mockLogger, cloudFile, s3Config})

        await expect(s3Uploader.putLocalFile()).rejects.toThrow(
          'S3Uploader#putLocalFile requires CloudFile.localPathToFile to be set',
        )
      })
    })
  })
})
