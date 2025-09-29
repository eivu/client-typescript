import {CloudFile} from '@src/cloud-file'
import {generateMd5} from '@src/utils'

async function demo(md5: string) {
  try {
    const cloudFile = await CloudFile.fetch(md5)
    console.dir(cloudFile)
    const aiImage = await CloudFile.reserve('/Users/jinx/Desktop/ai overlords.jpg')
    console.dir(aiImage)
  } catch (error) {
    console.error('Error fetching cloud file:', error)
  }
}

await demo('F04CD103EDDFB64EFD8D9FC48F3023FD')

console.log(await generateMd5('./package.json'))
console.log(await generateMd5('/Users/jinx/Desktop/ai overlords.jpg'))
