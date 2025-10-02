import {describe, expect, it} from '@jest/globals'
import nock from 'nock'
import {CloudFile} from '../src/cloud-file'
import {AI_OVERLORDS_RESERVATION} from './fixtures/responses'

describe('S3Uploader', () => {
  beforeEach(() => {
    nock.cleanAll()
  })

  describe('generateRemotePath', () => {
    it('generates the correct remote path based on resourceType, md5, and asset', () => {
      // const cloudFile = new CloudFile({...AI_OVERLORDS_RESERVATION, resourceType: 'image'})
      // const s3Uploader = new S3Uploader({asset: 'ai overlords.jpg', cloudFile})
    })
  })
})
