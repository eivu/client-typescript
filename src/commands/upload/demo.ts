/* eslint-disable camelcase */
import {Client} from '@src/client'
import {type MetadataProfile} from '@src/metadata-extraction'
import {logResponse} from '@src/utils'
/*

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
  await Client.uploadFolder({
    nsfw: true,
    pathToFolder: 'test/fixtures/samples/secured/',
    secured: true,
  }),
)

logResponse(
  await Client.uploadFile({
    pathToFile: 'test/fixtures/samples/comics/The_Peacemaker_01_1967.eivu_compressed.cbz',
  }),
)

// logResponse(
//   await client.uploadFile({
//     pathToFile: 'test/fixtures/samples/comics/Space_Adventures_033.eivu_compressed.cbr',
//   }),
// )

logResponse(
  await Client.uploadFile({
    pathToFile: 'test/fixtures/samples/comics/Werewolf 001 (c2c) (Dell 1966).eivu_compressed.cbr',
  }),
)

logResponse(
  await Client.uploadFile({
    pathToFile: 'test/fixtures/samples/comics/Werewolf 002 [Dell] (1967) (Vigilante407-DCP).eivu_compressed.cbr',
  }),
)

logResponse(await Client.bulkUpdateCloudFiles({pathToFolder: 'test/fixtures/samples/updates'}))
*/

const metadataProfile: MetadataProfile = {
  description:
    'Official box art for Fallout 4 Anniversary Edition, featuring the iconic power armor-clad Sole Survivor standing in the post-apocalyptic wasteland of the Commonwealth.\n\nThe image depicts the lone figure against the backdrop of a devastated Boston landscape, 210 years after the nuclear apocalypse known as the Great War. This tenth anniversary edition celebrates one of the most acclaimed open-world RPGs, winner of over 200 "Best Of" awards including DICE and BAFTA Game of the Year.\n',
  info_url: 'https://fallout.bethesda.net/en/games/fallout-4',
  metadata_list: [
    {studio: 'Bethesda Game Studios'},
    {publisher: 'Bethesda Softworks'},
    {director: 'Todd Howard'},
    {character: 'Sole Survivor'},
    {character: 'Dogmeat'},
    {character: 'Nick Valentine'},
    {character: 'Preston Garvey'},
    {character: 'Piper Wright'},
    {character: 'Codsworth'},
    {character: 'Dogmeat'},
    {character: 'Nick Valentine'},
    {character: 'Preston Garvey'},
    {character: 'Piper Wright'},
    {character: 'Codsworth'},
    {character: 'Dogmeat'},
    {character: 'Nick Valentine'},
    {performer: 'Brian T. Delaney'},
    {genre: 'Post-Apocalyptic'},
    {genre: 'Open World'},
    {genre: 'Sci-Fi'},
    {tag: 'eivu-testing'},
    {tag: 'video game'},
    {tag: 'box art'},
    {tag: 'power armor'},
    {tag: 'wasteland'},
    {tag: 'RPG'},
    {tag: 'post-nuclear'},
    {tag: 'retro-futuristic'},
    {tag: "Eivu's AI Masterwork Collection"},
    {tag: 'Fallout'},
    {tag: 'Fallout Universe'},
    {tag: 'Fallout 4'},
    {tag: 'Fallout 4 Anniversary Edition'},
    {franchise: 'Fallout'},
    {universe: 'Fallout Universe'},
    {'ai:rating': 5},
    {
      'ai:reasoning':
        "Won over 200 'Best Of' awards including 2016 DICE and BAFTA Game of the Year. Shipped 12 million units and generated $750 million in first 24 hours. Became one of the most celebrated open-world RPGs with 81% positive Steam reviews from over 174,000 users. Landmark achievement in open-world game design that defined modern post-apocalyptic RPG standards.",
    },
  ],
  name: 'Fallout 4 Anniversary Edition Box Art',
  year: 2015,
}

logResponse(
  await Client.uploadRemoteFile({
    assetFilename: 'FO4_boxart.png',
    downloadUrl: 'https://fallout.bethesda.net/_static-fallout/images/overview-art-lg.png',
    metadataProfile,
  }),
)
