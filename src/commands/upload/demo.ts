import {Client} from '@src/client'
import {CloudFile} from '@src/cloud-file'

const client = new Client()
// const pathToFile = 'test/fixtures/samples/image/ai overlords.jpg'
const pathToFile = 'test/fixtures/samples/audio/brothers_grimm/the_frog_prince/paragraph1.mp3'

// try {
//   const ai = await CloudFile.fetchOrReserveBy({pathToFile})
//   ai.reset()
// } catch (error) {
//   console.warn(`Server was grumpy: ${(error as Error).message}`)
// }

const x: CloudFile = await client.uploadFile({pathToFile})
console.log('====================')
console.log('Upload Result:')
console.dir(x)
