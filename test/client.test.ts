import {describe, expect, it} from '@jest/globals'
import nock from 'nock'

import {Client} from '../src/client'
import {CloudFile} from '../src/cloud-file'

describe('Client', () => {
  // const s3Config: S3UploaderConfig = {
  //   accessKeyId: process.env.EIVU_ACCESS_KEY_ID as string,
  //   bucketName: process.env.EIVU_BUCKET_NAME as string,
  //   endpoint: process.env.EIVU_ENDPOINT as string,
  //   region: process.env.EIVU_REGION as string,
  //   secretAccessKey: process.env.EIVU_SECRET_ACCESS_KEY as string,
  // }

  describe('upload', () => {
    beforeEach(() => {
      nock.cleanAll()
    })

    // describe('success', () => {
    //   it('uploads an image file, when it does not exist on the server', async () => {
    //     const client = new Client()
    //     const pathToFile = 'test/fixtures/samples/image/ai overlords.jpg'
    //     const cloudFile = await client.upload(pathToFile)

    //     reserveReq = nock(SERVER_HOST)

    //     expect(cloudFile).toBeInstanceOf(CloudFile)
    //     expect(cloudFile.localPathToFile).toBe(pathToFile)
    //     expect(cloudFile.remoteAttr).toBeDefined()
    //     expect(cloudFile.resourceType).toBe('image')
    //   })
    // })

    it('can be instantiated', () => {
      const client = new Client()
      expect(client).toBeInstanceOf(Client)
    })
  })
})
