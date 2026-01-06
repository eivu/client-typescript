import {Client} from '@src/client'
import {CloudFile} from '@src/cloud-file'
import {
  COVERART_PREFIX,
  PERFORMER_REGEX,
  RATING_425_REGEX,
  RATING_500_475_REGEX,
  STUDIO_REGEX,
  TAG_REGEX,
  TEMP_FOLDER_ROOT,
  V2_FRAMES,
  YEAR_REGEX,
} from '@src/constants'
import {type Artist} from '@src/types/artist'
import {type Release} from '@src/types/release'
import {detectMime} from '@src/utils'
import filter from 'lodash/filter'
import uniq from 'lodash/uniq'
import {type IAudioMetadata, parseFile} from 'music-metadata'
import {exec} from 'node:child_process'
import {promises as fsp} from 'node:fs'
import path from 'node:path'
import tmp from 'tmp'
import {parse as yamlParse} from 'yaml'

/**
 * Acoustid fingerprint containing the fingerprint and duration
 */
export type AcoustidFingerprint = {
  duration: number
  fingerprint: string
}

export type MetadataPair = Record<string, number | string>

/**
 * Metadata profile containing extracted file information and tags
 */
export type MetadataProfile = {
  artists: Artist[]
  artwork_md5?: null | string
  description?: null | string
  duration?: null | number
  info_url?: null | number
  metadata_list: MetadataPair[]
  name?: null | string
  path_to_file: null | string
  rating: null | number
  release: Release
  year?: null | number
}

export const EMPTY_RELEASE: Release = {
  artwork_md5: null, // eslint-disable-line camelcase
  bundle_pos: null, // eslint-disable-line camelcase
  name: null,
  // matched_recording: null,
  position: null,
  primary_artist_name: null, // eslint-disable-line camelcase
  year: null,
}

export const EMPTY_METADATA_PROFILE: MetadataProfile = {
  artists: [],
  artwork_md5: null, // eslint-disable-line camelcase
  description: null,
  duration: null,
  info_url: null,
  metadata_list: [], // eslint-disable-line camelcase
  name: null,
  path_to_file: null, // eslint-disable-line camelcase
  rating: null,
  release: EMPTY_RELEASE,
  year: null,
}

/**
 * Extracts metadata tags from a filename, including performers, studios, and general tags
 * @param pathToFile - The file path to extract metadata from
 * @returns An array of metadata objects with type-value pairs
 */
export const extractAudioInfo = async (pathToFile: string): Promise<MetadataPair[]> => {
  const metadata = await parseFile(pathToFile)
  const id3InfoArray: MetadataPair[] = []
  const v2TagsId = metadata.format.tagTypes.find((value) => ['ID3v2.2', 'ID3v2.3', 'ID3v2.4'].includes(value))
  const id3InfoObject: MetadataPair = {}

  // construct an object i id3 info
  if (v2TagsId) {
    for (const tag of metadata.native[v2TagsId]) {
      if (Object.keys(V2_FRAMES).includes(tag.id)) {
        const finalValue =
          typeof tag.value === 'object' && tag.value !== null && !Array.isArray(tag.value) && 'text' in tag.value
            ? (tag.value.text as string)
            : (tag.value as string)

        // skip empty values
        if (!finalValue) continue

        const finalKey = `id3:${V2_FRAMES[tag.id as keyof typeof V2_FRAMES]}`
        id3InfoObject[finalKey] = finalValue
      }
    }
  }

  // id3 year tag can be mishappend and 1811 can be mangled to  1811-01-01
  if (metadata.common.year) id3InfoObject['id3:year'] = metadata.common.year

  // create an array of metadata pairs from the object
  for (const [key, value] of Object.entries(id3InfoObject)) {
    id3InfoArray.push({[key]: value})
  }

  const {duration, fingerprint} = await generateAcoustidFingerprint(pathToFile)
  const audioInfo: MetadataPair[] = [
    {'acoustid:duration': duration},
    {'acoustid:fingerprint': fingerprint},
    {'eivu:duration': duration},
    ...id3InfoArray,
  ]
  if (id3InfoObject['id3:title']) audioInfo.push({'eivu:name': id3InfoObject['id3:title']})
  if (id3InfoObject['id3:track_nr']) audioInfo.push({'eivu:release_pos': id3InfoObject['id3:track_nr']})
  if (id3InfoObject['id3:year']) audioInfo.push({'eivu:year': id3InfoObject['id3:year']})
  if (id3InfoObject['id3:album']) audioInfo.push({'eivu:release_name': id3InfoObject['id3:album']})
  if (id3InfoObject['id3:artist']) audioInfo.push({'eivu:artist_name': id3InfoObject['id3:artist']})
  if (id3InfoObject['id3:band']) audioInfo.push({'eivu:album_artist': id3InfoObject['id3:band']})
  if (id3InfoObject['id3:disc_nr']) audioInfo.push({'eivu:bundle_pos': id3InfoObject['id3:disc_nr']})

  const artworkCloudFile = await uploadMetadataArtwork({iAudioMetadata: metadata, metadataList: audioInfo})

  if (artworkCloudFile) {
    audioInfo.push({'eivu:artwork_md5': artworkCloudFile.remoteAttr.md5})
  }

  return audioInfo
}

/**
 * Extracts metadata from a file
 * @param pathToFile - The file path to extract metadata from
 * @returns The extracted metadata
 */
export const extractInfo = async (pathToFile: string): Promise<MetadataPair[]> => {
  const {mediatype} = detectMime(pathToFile)
  if (mediatype === 'audio') return extractAudioInfo(pathToFile)

  return extractMetadataList(pathToFile)
}

export const extractInfoFromYml = async (pathToFile: string): Promise<MetadataProfile> => {
  const ymlPath = `${pathToFile}.eivu.yml`
  try {
    const file = await fsp.readFile(ymlPath, 'utf8')
    const info = yamlParse(file) as MetadataProfile
    return {...EMPTY_METADATA_PROFILE, ...info, path_to_file: pathToFile} // eslint-disable-line camelcase
  } catch {
    return {...EMPTY_METADATA_PROFILE, path_to_file: pathToFile} // eslint-disable-line camelcase
  }
}

/**
 * Extracts metadata tags from a filename, including performers, studios, and general tags
 * @param input - The file path or filename to extract metadata from
 * @returns An array of metadata objects with type-value pairs
 */
export const extractMetadataList = (input: string): MetadataPair[] => {
  let base = path.basename(input)

  // remove year
  base = base.replaceAll(YEAR_REGEX, '')

  const regexMap: Record<string, RegExp> = {
    performer: PERFORMER_REGEX,
    studio: STUDIO_REGEX,
    tag: TAG_REGEX,
  }

  const results: MetadataPair[] = []

  for (const [type, regex] of Object.entries(regexMap)) {
    const matches = [...base.matchAll(regex)].map((m) => m[1]).filter(Boolean)

    if (matches.length > 0) {
      // remove matched part from the string
      base = base.replaceAll(regex, '')
      for (const extraction of matches) {
        results.push({[type]: extraction.toLowerCase().trim()})
      }
    }
  }

  return results
}

/**
 * Extracts the rating from a filename based on prefix characters
 * - '__' prefix = 5.0 rating
 * - '_' prefix = 4.75 rating
 * - '`' prefix = 4.25 rating
 * @param input - The file path or filename to extract the rating from
 * @returns The extracted rating as a number, or null if not found
 */
export function extractRating(input: string): null | number {
  const base = path.basename(input)

  if (base.startsWith('__')) return 5
  if (base.startsWith('_')) return 4.75
  if (base.startsWith('`')) return 4.25

  return null
}

/**
 * Extracts the year from a filename using the ((y YEAR)) tag format
 * @param input - The file path or filename to extract the year from
 * @returns The extracted year as a number, or null if not found
 */
export const extractYear = (input: string): null | number => {
  const base = path.basename(input)
  const match = /\(\(y ([^)]+)\)\)/.exec(base)
  return match ? Number(match[1].trim()) : null
}

/**
 * Generates an Acoustid fingerprint for a file
 * @param pathToFile - The file path to generate an Acoustid fingerprint for
 * @returns A promise that resolves to the Acoustid fingerprint
 */
export const generateAcoustidFingerprint = (pathToFile: string): Promise<AcoustidFingerprint> =>
  new Promise((resolve, reject) => {
    exec(`fpcalc -json "${pathToFile}"`, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Error executing fpcalc: ${stderr}`))
      } else {
        resolve(JSON.parse(stdout))
      }
    })
  })

/**
 * Generates a complete metadata profile for a file by extracting and combining metadata from the filename and provided metadata list
 * @param params - Configuration object
 * @param params.metadataList - Additional metadata to include in the profile
 * @param params.pathToFile - Path to the file being processed
 * @returns A complete metadata profile including artists, release info, and extracted tags
 */
export const generateDataProfile = async ({
  metadataList = [],
  pathToFile,
}: {
  metadataList?: MetadataPair[]
  pathToFile: string
}): Promise<MetadataProfile> => {
  // Extract additional metadata from the filename and merge with provided metadata list
  const fileInfo = await extractInfo(pathToFile)
  const ymlInfo: MetadataProfile = await extractInfoFromYml(pathToFile)
  let name: null | string
  metadataList = uniq([...metadataList, ...fileInfo, ...ymlInfo.metadata_list])

  // Optionally include original local path
  if (!pathToFile.startsWith(TEMP_FOLDER_ROOT)) {
    metadataList.push({original_local_path_to_file: pathToFile}) // eslint-disable-line camelcase
  }

  // if working on cover art, prune unneeded metadata
  if (pathToFile.includes(COVERART_PREFIX)) {
    metadataList = filter(metadataList, (item) => {
      const key = Object.keys(item)[0]
      return ['eivu:artist_name', 'eivu:release_name', 'eivu:year', 'id3:album', 'id3:artist', 'id3:genre'].includes(
        key,
      )
    })
    metadataList.push({'id3:track_nr': 0}, {'id3:disc_nr': 0})
  }

  /* eslint-disable camelcase */
  const year = ymlInfo.year ?? extractYear(pathToFile) ?? pruneNumber(metadataList, 'eivu:year')
  const artwork_md5 = pruneString(metadataList, 'eivu:artwork_md5')
  const position = pruneNumber(metadataList, 'eivu:release_pos')
  const bundle_pos = pruneNumber(metadataList, 'eivu:bundle_pos')
  const duration = ymlInfo.duration ?? pruneNumber(metadataList, 'eivu:duration')
  const artist_name = pruneString(metadataList, 'eivu:artist_name')
  const release_name = pruneString(metadataList, 'eivu:release_name')
  const album_artist = pruneString(metadataList, 'eivu:album_artist')
  // const matched_recording = null

  // alter name for cover art files
  if (pathToFile.includes(COVERART_PREFIX)) {
    name = 'Cover Art'
    const label = [artist_name, release_name].filter(Boolean).join(' - ')
    const name_xtra = label ? ` for ${label}` : ''
    name += name_xtra
  } else {
    name = ymlInfo.name ?? pruneString(metadataList, 'eivu:name')
  }

  const dataProfile: MetadataProfile = {
    artists: name ? [{name: artist_name} as Artist] : [],
    artwork_md5,
    duration,
    metadata_list: metadataList,
    name,
    path_to_file: pathToFile,
    rating: ymlInfo.rating ?? extractRating(pathToFile),
    release: {
      artwork_md5,
      bundle_pos: bundle_pos === null ? null : Number(bundle_pos),
      name: release_name,
      // matched_recording,
      position: position === null ? null : Number(position),
      primary_artist_name: album_artist,
      year: year === null ? null : Number(year),
    },
    year,
  }
  /* eslint-enable camelcase */

  return dataProfile
}

/**
 * Removes metadata tags and rating prefixes from a string
 * @param string - The string to clean
 * @returns The string with all metadata tags removed
 */
export const pruneMetadata = (string: string): string => {
  // trim spaces around metadata tags
  let output = string.trim().replaceAll(' ((', '((').replaceAll(')) ', '))')
  // Remove metadata tags
  const regexes = [TAG_REGEX, PERFORMER_REGEX, STUDIO_REGEX, YEAR_REGEX, RATING_500_475_REGEX, RATING_425_REGEX]
  for (const regex of regexes) {
    output = output.replaceAll(regex, '')
  }

  return output
}

/**
 * Searches for and removes a specific key from the metadata list, returning its value
 * Mutates the metadata list by removing the found item
 * @param metadataList - The array of metadata objects to search
 * @param key - The key to search for
 * @returns The value associated with the key, or null if not found
 */
export const pruneFromMetadataList = (metadataList: MetadataPair[], key: string): null | number | string => {
  const index = metadataList.findIndex((item) => Object.hasOwn(item, key))
  if (index !== -1) {
    const [item] = metadataList.splice(index, 1)
    return Object.values(item)[0] as number | string
  }

  return null
}

/**
 * Helper function to extract a string value from the metadata list
 * @param metadataList - The array of metadata objects
 * @param key - The key to search for
 * @returns The string value, or null if not found
 */
const pruneString = (metadataList: MetadataPair[], key: string): null | string => {
  const value = pruneFromMetadataList(metadataList, key)
  return value === null ? null : String(value)
}

/**
 * Helper function to extract a number value from the metadata list
 * @param metadataList - The array of metadata objects
 * @param key - The key to search for
 * @returns The number value, or null if not found
 */
const pruneNumber = (metadataList: MetadataPair[], key: string): null | number => {
  const value = pruneFromMetadataList(metadataList, key)
  return value === null ? null : Number(value)
}

/**
 * Uploads embedded artwork from audio file metadata as a separate cloud file
 * @param params - Configuration object
 * @param params.iAudioMetadata - The parsed audio metadata containing picture data
 * @param params.metadataList - Metadata list to attach to the artwork file
 * @returns The uploaded CloudFile instance for the artwork, or null if no artwork exists
 */
const uploadMetadataArtwork = async ({
  iAudioMetadata,
  metadataList,
}: {
  iAudioMetadata: IAudioMetadata
  metadataList: MetadataPair[]
}): Promise<CloudFile | null> => {
  // Short circuit if no artwork in metadata
  if (!iAudioMetadata.common.picture || iAudioMetadata.common.picture.length === 0) {
    return null
  }

  const contentType = iAudioMetadata.common.picture[0].format
  const [, subtype] = contentType ? contentType.split('/') : ['application', 'octet-stream']

  const bufferData = Buffer.from(iAudioMetadata.common.picture[0].data)

  const tmpFile = tmp.fileSync({mode: 0o644, postfix: `.${subtype}`, prefix: `${COVERART_PREFIX}-`})

  await fsp.appendFile(tmpFile.name, bufferData)

  return Client.uploadFile({metadataList, pathToFile: tmpFile.name})
}
