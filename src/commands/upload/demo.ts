import {Client} from '@src/client'
import {CloudFile} from '@src/cloud-file'

const x = await CloudFile.fetchOrReserveBy({pathToFile: 'test/fixtures/samples/image/ai overlords.jpg'})
console.dir(x)

const client = new Client()
const y = await client.upload('/Users/jinx/Downloads/Funny/20160328_190901.jpg')
console.dir(y)

// const reservedMd5 = 'B41BDA7B436091F9DBC2B3AD1299D729'
// const reservedFile = await CloudFile.fetch(reservedMd5)
// console.dir(reservedFile)
