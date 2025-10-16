import {Client} from '@src/client'
import {CloudFile} from '@src/cloud-file'
// import {extractAudioInfo, generateDataProfile} from '@src/metadata-extraction'
// import {parseFile} from 'music-metadata'

const client = new Client()
const pathToFileAi = 'test/fixtures/samples/image/ai overlords.jpg'
// const ai = await CloudFile.fetchOrReserveBy({pathToFile: pathToFileAi})
// ai.reset()

const x: CloudFile = await client.upload(pathToFileAi)
console.log('====================')
console.log('Upload Result:')
console.dir(x)
