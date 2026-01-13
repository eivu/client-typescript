import {Client} from '@src/client'
// import {CloudFile} from '@src/cloud-file'
import {uploadComicMetadataArtwork} from '@src/metadata-extraction'

const client = new Client()
// const pathToFile = 'test/fixtures/samples/image/ai overlords.jpg'
// let pathToFile
// try {
//   const ai = await CloudFile.fetchOrReserveBy({pathToFile})
//   ai.reset()
// } catch (error) {
//   console.warn(`Server was grumpy: ${(error as Error).message}`)
// }

// pathToFile = 'test/fixtures/samples/audio/brothers_grimm/the_frog_prince/paragraph1.mp3'
// const a: CloudFile = await client.uploadFile({metadataList: [{tag: 'eivu-testing'}], pathToFile})
// console.log('====================')
// console.log('Upload Result:')
// console.dir(a)
// console.log('====================')

// pathToFile = 'test/fixtures/samples/secured/gesel-792764.jpg'
// // const obj = await CloudFile.fetchOrReserveBy({pathToFile})
// // obj.reset()
// const b: CloudFile = await client.uploadFile({
//   metadataList: [{tag: 'eivu-testing'}],
//   nsfw: true,
//   pathToFile,
//   secured: true,
// })
// console.log('====================')
// console.log('Upload Result:')
// console.dir(b)
// console.log('====================')

const e = await client.uploadFolder({
  nsfw: true,
  pathToFolder: 'test/fixtures/samples/secured/numbers/',
  secured: true,
})
console.log('====================')
console.log('Upload Result:')
console.dir(e)

const result = await uploadComicMetadataArtwork(
  'test/fixtures/samples/comics/The_Peacemaker_01_1967.eivu_compressed.cbz',
)
console.log('Uploaded cover art')
console.dir(result)
