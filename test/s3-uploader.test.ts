import {describe, expect, it} from '@jest/globals'
import nock from 'nock'


import {CloudFile} from '../src/cloud-file'
import {S3Uploader, type S3UploaderConfig} from '../src/s3-uploader'
import {cleansedAssetName} from '../src/utils'
import {AI_OVERLORDS_RESERVATION, MOV_BBB_RESERVATION} from './fixtures/responses'

describe('S3Uploader', () => {
  const s3Config: S3UploaderConfig = {
    accessKeyId: process.env.EIVU_ACCESS_KEY_ID as string,
    bucketName: process.env.EIVU_BUCKET_NAME as string,
    endpoint: process.env.EIVU_ENDPOINT as string,
    region: process.env.EIVU_REGION as string,
    secretAccessKey: process.env.EIVU_SECRET_ACCESS_KEY as string,
  }

  beforeEach(() => {
    nock.cleanAll()
  })

  describe('generateRemotePath', () => {
    describe('image: ai overlords', () => {
      it('generates the correct remote path based on resourceType, md5, and asset', () => {
        const remoteAttr = {...AI_OVERLORDS_RESERVATION}
        const resourceType = 'image'
        const asset = cleansedAssetName('test/fixtures/samples/image/ai overlords.jpg')

        const cloudFile = new CloudFile({remoteAttr, resourceType})
        const s3Uploader = new S3Uploader({asset, cloudFile, s3Config})
        expect(s3Uploader.generateRemotePath()).toBe(
          'image/7E/D9/71/31/3D/1A/EA/1B/6E/2B/F8/AF/24/BE/D6/4A/ai_overlords.jpg',
        )
      })
    })

    describe('video: big buck bunny', () => {
      it('generates the correct remote path based on resourceType, md5, and asset', () => {
        const remoteAttr = {...MOV_BBB_RESERVATION}
        const resourceType = 'video'
        const asset = cleansedAssetName('test/fixtures/samples/video/mov_bbb.mp4')

        const cloudFile = new CloudFile({remoteAttr, resourceType})
        const s3Uploader = new S3Uploader({asset, cloudFile, s3Config})
        expect(s3Uploader.generateRemotePath()).toBe(
          'video/19/89/18/F4/0E/CC/7C/AB/0F/C4/23/1A/DA/F6/7C/96/mov_bbb.mp4',
        )
      })
    })
  })

  describe('md5AsFolders', () => {
    describe('image: ai overlords', () => {
      it('converts an MD5 hash into a folder structure', () => {
        const remoteAttr = {...AI_OVERLORDS_RESERVATION}
        const resourceType = 'image'
        const asset = cleansedAssetName('test/fixtures/samples/image/ai overlords.jpg')

        const cloudFile = new CloudFile({remoteAttr, resourceType})
        const s3Uploader = new S3Uploader({asset, cloudFile, s3Config})
        expect(s3Uploader.md5AsFolders('7ED971313D1AEA1B6E2BF8AF24BED64A')).toBe(
          '7E/D9/71/31/3D/1A/EA/1B/6E/2B/F8/AF/24/BE/D6/4A',
        )
      })
    })

    describe('video: big buck bunny', () => {
      it('converts an MD5 hash into a folder structure', () => {
        const remoteAttr = {...MOV_BBB_RESERVATION}
        const resourceType = 'video'
        const asset = cleansedAssetName('test/fixtures/samples/video/mov_bbb.mp4')

        const cloudFile = new CloudFile({remoteAttr, resourceType})
        const s3Uploader = new S3Uploader({asset, cloudFile, s3Config})
        expect(s3Uploader.md5AsFolders('198918F40ECC7CAB0FC4231ADAF67C96')).toBe(
          '19/89/18/F4/0E/CC/7C/AB/0F/C4/23/1A/DA/F6/7C/96',
        )
      })
    })
  })
})
