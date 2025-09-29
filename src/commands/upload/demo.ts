import {CloudFile} from '@src/cloud-file'

async function demo(md5: string) {
  try {
    const cloudFile = await CloudFile.fetch(md5)
    console.log(cloudFile)
  } catch (error) {
    console.error('Error fetching cloud file:', error)
  }
}

demo('F04CD103EDDFB64EFD8D9FC48F3023FD')
