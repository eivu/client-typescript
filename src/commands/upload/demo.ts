import {Client} from '@src/client'
// import {uploadComicMetadataArtwork} from '@src/metadata-extraction'
const logResponse = (result: unknown) => {
  console.log('====================')
  console.log('Upload Result:')
  console.dir(result)
  console.log('====================')
}

const client = new Client()
// // const pathToFile = 'test/fixtures/samples/image/ai overlords.jpg'
// // let pathToFile
// // try {
// //   const ai = await CloudFile.fetchOrReserveBy({pathToFile})
// //   ai.reset()
// // } catch (error) {
// //   console.warn(`Server was grumpy: ${(error as Error).message}`)
// // }

// // pathToFile = 'test/fixtures/samples/audio/brothers_grimm/the_frog_prince/paragraph1.mp3'
// // const a: CloudFile = await client.uploadFile({metadataList: [{tag: 'eivu-testing'}], pathToFile})
// // console.log('====================')
// // console.log('Upload Result:')
// // console.dir(a)
// // console.log('====================')

logResponse(
  await client.uploadFolder({
    nsfw: true,
    pathToFolder: 'test/fixtures/samples/secured/numbers/',
    secured: true,
  }),
)

// logResponse(
//   await client.uploadFile({
//     pathToFile: 'test/fixtures/samples/comics/The_Peacemaker_01_1967.eivu_compressed.cbz',
//   }),
// )

// logResponse(
//   await client.uploadFile({
//     pathToFile: 'test/fixtures/samples/comics/Space_Adventures_033.eivu_compressed.cbr',
//   }),
// )

logResponse(
  await client.uploadFile({
    pathToFile: 'test/fixtures/samples/comics/Werewolf 001 (c2c) (Dell 1966).eivu_compressed.cbr',
  }),
)

logResponse(await client.updateCloudFile('test/fixtures/samples/updates/6068BE59B486F912BB432DDA00D8949B.eivu.yml'))
