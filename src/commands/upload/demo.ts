import {Client} from '@src/client'
import {CloudFile} from '@src/cloud-file'

// const x = await CloudFile.fetchOrReserveBy({pathToFile: 'test/fixtures/samples/image/ai overlords.jpg'})
// console.dir(x)

const client = new Client()
const y = await client.upload('test/fixtures/samples/image/ai overlords.jpg')
console.dir(y)
