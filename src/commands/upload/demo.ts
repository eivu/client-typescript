import {Client} from '@src/client'
import {CloudFile} from '@src/cloud-file'
import {generateDataProfile} from '@src/metadata-extraction'

const x = await CloudFile.fetchOrReserveBy({pathToFile: 'test/fixtures/samples/image/ai overlords.jpg'})
console.dir(x)

const client = new Client()
const y = await client.upload('/Users/jinx/Downloads/Funny/20160328_190901.jpg')
console.dir(y)
console.log('-========')
console.dir(
  generateDataProfile({
    pathToFile:
      'test/fixtures/samples/text/_Dredd ((Comic Book Movie)) ((p Karl Urban)) ((p Lena Headey)) ((s DNA Films)) ((script)) ((y 2012)).txt',
  }),
)

// const reservedMd5 = 'B41BDA7B436091F9DBC2B3AD1299D729'
// const reservedFile = await CloudFile.fetch(reservedMd5)
// console.dir(reservedFile)
