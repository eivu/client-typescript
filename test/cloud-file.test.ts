import {describe, expect, it} from '@jest/globals'
import nock from 'nock'

import {CloudFile} from '../src/cloud-file'
import {CloudFileState} from '../src/types/cloud-file-type'
import {
  AI_OVERLORDS_RESERVATION,
  AI_OVERLORDS_TRANSFER,
  DREDD_TRANSFER,
  MOV_BBB_TRANSFER,
  PEXELS_TRANSFER,
} from './fixtures/responses'

const SERVER_HOST = process.env.EIVU_UPLOAD_SERVER_HOST as string
const BUCKET_UUID = process.env.EIVU_BUCKET_UUID
const URL_BUCKET_PREFIX = `/api/upload/v1/buckets/${BUCKET_UUID}`
const aiFilesize = 66_034

describe('CloudFile', () => {
  beforeEach(() => {
    nock.cleanAll()
  })

  describe('completed', () => {
    it('returns true if the CloudFile state is completed', () => {
      const cloudFile = new CloudFile({remoteAttr: {...AI_OVERLORDS_RESERVATION, state: CloudFileState.COMPLETED}})
      expect(cloudFile.completed()).toBe(true)
    })

    it('returns false if the CloudFile state is not completed', () => {
      const cloudFile = new CloudFile({remoteAttr: {...AI_OVERLORDS_RESERVATION, state: CloudFileState.RESERVED}})
      expect(cloudFile.completed()).toBe(false)
    })
  })

  describe('fetch', () => {
    describe('when the file exists', () => {
      it('fetches a cloud file by MD5 hash', async () => {
        const md5 = '7ED971313D1AEA1B6E2BF8AF24BED64A'
        const req = nock(SERVER_HOST)
          .get(`${URL_BUCKET_PREFIX}/cloud_files/${md5}`)
          .query({keyFormat: 'camel_lower'})
          .reply(200, AI_OVERLORDS_RESERVATION)

        const cloudFile = await CloudFile.fetch(md5)
        expect(cloudFile).toBeDefined()
        expect(cloudFile.localPathToFile).toBeNull()
        expect(cloudFile.remoteAttr).toEqual(AI_OVERLORDS_RESERVATION)
        expect(req.isDone()).toBe(true)
      })
    })

    describe('when the file does not exist', () => {
      it('throws a 404 error', async () => {
        const md5 = 'NONEXISTENTMD5HASH00000000000000'
        const req = nock(SERVER_HOST)
          .get(`${URL_BUCKET_PREFIX}/cloud_files/${md5}`)
          .query({keyFormat: 'camel_lower'})
          .reply(404, {error: 'Not Found'})

        await expect(CloudFile.fetch(md5)).rejects.toThrow('Request failed with status code 404')
        expect(req.isDone()).toBe(true)
      })
    })
  })

  describe('fetchOrReserveBy', () => {
    describe('when the file does not exist', () => {
      it('reserves a cloud file via the MD5 hash', async () => {
        const pathToFile = 'test/fixtures/samples/image/ai overlords.jpg'
        const md5 = '7ED971313D1AEA1B6E2BF8AF24BED64A'
        const req = nock(SERVER_HOST)
          .post(`${URL_BUCKET_PREFIX}/cloud_files/${md5}/reserve`, {nsfw: false, secured: false})
          .query({keyFormat: 'camel_lower'})
          .reply(200, AI_OVERLORDS_RESERVATION)

        const cloudFile = await CloudFile.fetchOrReserveBy({pathToFile})
        expect(cloudFile).toBeDefined()
        expect(cloudFile.localPathToFile).toEqual(pathToFile)
        expect(cloudFile.remoteAttr).toEqual(AI_OVERLORDS_RESERVATION)
        expect(req.isDone()).toBe(true)
      })
    })

    describe('when the file already exists', () => {
      it('fetches the existing cloud file via the MD5 hash', async () => {
        const pathToFile = 'test/fixtures/samples/image/ai overlords.jpg'
        const md5 = '7ED971313D1AEA1B6E2BF8AF24BED64A'

        const reserveReq = nock(SERVER_HOST)
          .post(`${URL_BUCKET_PREFIX}/cloud_files/${md5}/reserve`, {nsfw: false, secured: false})
          .query({keyFormat: 'camel_lower'})
          .reply(422, {error: 'A file with that MD5 hash already exists'})

        const fetchReq = nock(SERVER_HOST)
          .get(`${URL_BUCKET_PREFIX}/cloud_files/${md5}`)
          .query({keyFormat: 'camel_lower'})
          .reply(200, AI_OVERLORDS_RESERVATION)
        const cloudFile = await CloudFile.fetchOrReserveBy({pathToFile})
        expect(cloudFile).toBeDefined()
        expect(cloudFile.remoteAttr).toEqual(AI_OVERLORDS_RESERVATION)
        expect(reserveReq.isDone()).toBe(true)
        expect(fetchReq.isDone()).toBe(true)
      })
    })
  })

  describe('reset', () => {
    it('resets a CloudFile back to reserved state', async () => {
      const cloudFile = new CloudFile({
        localPathToFile: 'test/fixtures/samples/image/ai overlords.jpg',
        remoteAttr: AI_OVERLORDS_TRANSFER,
      })
      const req = nock(SERVER_HOST)
        .post(`${URL_BUCKET_PREFIX}/cloud_files/${cloudFile.remoteAttr.md5}/reset`)
        .query({keyFormat: 'camel_lower'})
        .reply(200, {...AI_OVERLORDS_RESERVATION, state: CloudFileState.RESERVED})

      const resetCloudFile = await cloudFile.reset()
      expect(resetCloudFile).toBeDefined()
      expect(resetCloudFile.stateHistory).toEqual([CloudFileState.RESERVED])
      expect(resetCloudFile.remoteAttr.state).toEqual(CloudFileState.RESERVED)
      expect(req.isDone()).toBe(true)
    })
  })

  describe('reserve', () => {
    describe('when the file does not exist', () => {
      it('reserves a cloud file by path', async () => {
        const pathToFile = 'test/fixtures/samples/image/ai overlords.jpg'
        const md5 = '7ED971313D1AEA1B6E2BF8AF24BED64A'
        const req = nock(SERVER_HOST)
          .post(`${URL_BUCKET_PREFIX}/cloud_files/${md5}/reserve`, {nsfw: false, secured: false})
          .query({keyFormat: 'camel_lower'})
          .reply(200, AI_OVERLORDS_RESERVATION)

        const cloudFile = await CloudFile.reserve({pathToFile})
        expect(cloudFile).toBeDefined()
        expect(cloudFile.localPathToFile).toEqual(pathToFile)
        expect(cloudFile.remoteAttr).toEqual(AI_OVERLORDS_RESERVATION)
        expect(req.isDone()).toBe(true)
      })
    })

    describe('when the file already exists', () => {
      it('throws a 422 error', async () => {
        const pathToFile = './test/fixtures/samples/image/ai overlords.jpg'
        const req = nock(SERVER_HOST)
          .post(`${URL_BUCKET_PREFIX}/cloud_files/7ED971313D1AEA1B6E2BF8AF24BED64A/reserve`, {
            nsfw: false,
            secured: false,
          })
          .query({keyFormat: 'camel_lower'})
          .reply(422, {error: 'A file with that MD5 hash already exists'})

        await expect(CloudFile.reserve({pathToFile})).rejects.toThrow('Request failed with status code 422')
        expect(req.isDone()).toBe(true)
      })
    })
  })

  describe('reserved', () => {
    it('returns true if the CloudFile state is reserved', () => {
      const cloudFile = new CloudFile({remoteAttr: {...AI_OVERLORDS_RESERVATION, state: CloudFileState.RESERVED}})
      expect(cloudFile.reserved()).toBe(true)
    })

    it('returns false if the CloudFile state is not reserved', () => {
      const cloudFile = new CloudFile({remoteAttr: {...AI_OVERLORDS_RESERVATION, state: CloudFileState.COMPLETED}})
      expect(cloudFile.reserved()).toBe(false)
    })
  })

  describe('transfer', () => {
    it('marks a CloudFile as transferred', async () => {
      const cloudFile = new CloudFile({
        localPathToFile: 'test/fixtures/samples/image/ai overlords.jpg',
        remoteAttr: AI_OVERLORDS_RESERVATION,
      })
      cloudFile.remoteAttr.content_type = 'image/jpeg' // eslint-disable-line camelcase
      const req = nock(SERVER_HOST)
        .post(`${URL_BUCKET_PREFIX}/cloud_files/${cloudFile.remoteAttr.md5}/transfer`, {
          asset: 'image',
          content_type: 'image/jpeg', // eslint-disable-line camelcase
          filesize: aiFilesize,
        })
        .query({keyFormat: 'camel_lower'})
        .reply(200, {...AI_OVERLORDS_TRANSFER, filesize: aiFilesize})
      await cloudFile.transfer({asset: 'image', filesize: aiFilesize})
      expect(cloudFile.stateHistory).toEqual([CloudFileState.RESERVED, CloudFileState.TRANSFERRED])
      expect(cloudFile.remoteAttr).toEqual({...AI_OVERLORDS_TRANSFER, filesize: aiFilesize})
      expect(cloudFile.remoteAttr.filesize).toEqual(aiFilesize)
      expect(req.isDone()).toBe(true)
    })
  })

  describe('transferred', () => {
    it('returns true if the CloudFile state is transferred', () => {
      const cloudFile = new CloudFile({remoteAttr: {...AI_OVERLORDS_RESERVATION, state: CloudFileState.TRANSFERRED}})
      expect(cloudFile.transferred()).toBe(true)
    })

    it('returns false if the CloudFile state is not transferred', () => {
      const cloudFile = new CloudFile({remoteAttr: {...AI_OVERLORDS_RESERVATION, state: CloudFileState.RESERVED}})
      expect(cloudFile.transferred()).toBe(false)
    })
  })

  describe('url', () => {
    // it('returns null if the CloudFile state is reserved', () => {
    //   const cloudFile = new CloudFile({remoteAttr: AI_OVERLORDS_RESERVATION})
    //   expect(cloudFile.url()).toBeNull()
    // })

    it('returns a valid URL for ai_overlords.jpg', () => {
      const cloudFile = new CloudFile({remoteAttr: AI_OVERLORDS_TRANSFER})
      expect(cloudFile.url()).toEqual(
        'https://eivu-test.s3.wasabisys.com/image/7E/D9/71/31/3D/1A/EA/1B/6E/2B/F8/AF/24/BE/D6/4A/ai_overlords.jpg',
      )
    })

    it('returns a valid URL for big_buck_bunny.mp4', () => {
      const cloudFile = new CloudFile({remoteAttr: MOV_BBB_TRANSFER})
      expect(cloudFile.url()).toEqual(
        'https://eivu-test.s3.wasabisys.com/video/19/89/18/F4/0E/CC/7C/AB/0F/C4/23/1A/DA/F6/7C/96/mov_bbb.mp4',
      )
    })

    it('returns a valid URL for dredd.txt', () => {
      const cloudFile = new CloudFile({remoteAttr: DREDD_TRANSFER})
      expect(cloudFile.url()).toEqual(
        'https://eivu-test.s3.wasabisys.com/archive/D3/49/7D/5E/97/E4/39/33/40/72/37/FF/2C/A4/6D/CA/Dredd.txt',
      )
    })

    it('returns a valid URL for (secure) pexels-gesel-792764.jpg', () => {
      const cloudFile = new CloudFile({remoteAttr: PEXELS_TRANSFER})
      expect(cloudFile.url()).toEqual(
        'https://eivu-test.s3.wasabisys.com/secured/F0/0F/4D/45/AE/63/D7/4F/4F/2E/39/2A/E8/2E/23/A2/pexels-gesel-792764.jpg',
      )
    })
  })
})
