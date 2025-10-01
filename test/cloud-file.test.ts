import {describe, expect, it} from '@jest/globals'
import nock from 'nock'

import {CloudFile} from '../src/cloud-file'
import {AI_OVERLORDS_RESERVERATION} from './fixtures/responses'

const SERVER_HOST = process.env.EIVU_UPLOAD_SERVER_HOST as string
const BUCKET_UUID = process.env.EIVU_BUCKET_UUID
// const USER_UUID = process.env.EIVU_USER_UUID
const URL_BUCKET_PREFIX = `/api/upload/v1/buckets/${BUCKET_UUID}`

// url: "#{Eivu::Client.configuration.host}/api/upload/v1/buckets/#{bucket_uuid}/cloud_files/#{md5}",
//             method: :get,
//             headers: { 'Authorization' => "Token #{Eivu::Client.configuration.user_token}" },
//             verify_ssl: !Eivu::Client.configuration.ignore_ssl_cert
//           )

//           /api/upload/v1/buckets/#{bucket_uuid}/cloud_files/#{md5}"

describe('CloudFile', () => {
  beforeEach(() => {
    nock.cleanAll()
    // nock('http://localhost:5000').post(`/path`, data).log(console.log).reply(200, {id: 1})
  })

  it('fetches a cloud file by MD5 hash', async () => {
    const md5 = '7ED971313D1AEA1B6E2BF8AF24BED64A'
    const req = nock(SERVER_HOST).get(`${URL_BUCKET_PREFIX}/cloud_files/${md5}`).reply(200, AI_OVERLORDS_RESERVERATION)

    const cloudFile = await CloudFile.fetch(md5)
    expect(cloudFile).toBeDefined()
    expect(cloudFile.attr).toEqual(AI_OVERLORDS_RESERVERATION)
    expect(req.isDone()).toBe(true)
  })
})
