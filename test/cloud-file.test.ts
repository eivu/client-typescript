import {describe, expect, it} from '@jest/globals'
import nock from 'nock'

import {CloudFile} from '../src/cloud-file'
import {CloudFileState} from '../src/types/cloud-file-type'
import {AI_OVERLORDS_RESERVATION, AI_OVERLORDS_TRANSFER} from './fixtures/responses'

const SERVER_HOST = process.env.EIVU_UPLOAD_SERVER_HOST as string
const BUCKET_UUID = process.env.EIVU_BUCKET_UUID
const URL_BUCKET_PREFIX = `/api/upload/v1/buckets/${BUCKET_UUID}`

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
        .post(`${URL_BUCKET_PREFIX}/cloud_files/${cloudFile.remoteAttr.md5}/reset`, {
          content_type: cloudFile.remoteAttr.content_type, // eslint-disable-line camelcase
        })
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
      expect(cloudFile).toBeDefined()
      // expect(cloudFile.stateHistory).toEqual([CloudFileState.RESERVED, CloudFileState.TRANSFERRED])
      // expect(cloudFile.remoteAttr.filesize).toEqual(204800)
    })
  })

  describe('transfered', () => {
    it('returns true if the CloudFile state is transferred', () => {
      const cloudFile = new CloudFile({remoteAttr: {...AI_OVERLORDS_RESERVATION, state: CloudFileState.TRANSFERRED}})
      expect(cloudFile.transfered()).toBe(true)
    })

    it('returns false if the CloudFile state is not transferred', () => {
      const cloudFile = new CloudFile({remoteAttr: {...AI_OVERLORDS_RESERVATION, state: CloudFileState.RESERVED}})
      expect(cloudFile.transfered()).toBe(false)
    })
  })
})
