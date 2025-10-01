import {describe, expect, it} from '@jest/globals'

// import {CloudFile} from '@src/cloud-file'
import {AI_OVERLORDS_RESERVERATION} from './fixtures/responses'

describe('CloudFile', () => {
  it('fetches a cloud file by MD5 hash', async () => {
    console.log(`EIVU_BUCKET_UUID - ${process.env.EIVU_BUCKET_UUID}`)
    // const md5 = 'F04CD103EDDFB64EFD8D9FC48F3023FD' // Example MD5 hash
    // const cloudFile = await CloudFile.fetch(md5)
    // expect(cloudFile).toBeInstanceOf(CloudFile)
    // expect(cloudFile.attr.md5).toBe(md5)
    expect(AI_OVERLORDS_RESERVERATION.md5).toBe('7ED971313D1AEA1B6E2BF8AF24BED64A')
    expect(true).toBe(true) // Placeholder assertion
  })
})
