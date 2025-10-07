import {type Artist} from '@src/types/artist'
import {type Release} from '@src/types/release'
import {detectMime} from '@src/utils'
import {parseFile} from 'music-metadata'
import {exec} from 'node:child_process'
import path from 'node:path'

// Regex constants
const TAG_REGEX = /\(\((?![psy] )([^)]+)\)\)/g
const PERFORMER_REGEX = /\(\(p ([^)]+)\)\)/g
const STUDIO_REGEX = /\(\(s ([^)]+)\)\)/g
const YEAR_REGEX = /\(\(y ([^)]+)\)\)/g
const RATING_500_475_REGEX = /^_+/g
const RATING_425_REGEX = /^`/g

/* eslint-disable perfectionist/sort-enums, @typescript-eslint/no-duplicate-enum-values */
// ID3v2 frame identifiers
export enum V2_FRAMES {
  TALB = 'album',
  TAL = 'album',
  TP1 = 'artist',
  TPE1 = 'artist',
  WAR = 'artist url',
  WOAR = 'artist url',
  TP2 = 'band',
  TPE2 = 'band',
  TBP = 'beats per minute',
  TBPM = 'beats per minute',
  COM = 'comments',
  COMM = 'comments',
  WCM = 'commercial url',
  WCOM = 'commercial url',
  TCP = 'compilation',
  TCMP = 'compilation',
  TCM = 'composer',
  TCOM = 'composer',
  TP3 = 'conductor',
  TPE3 = 'conductor',
  TCR = 'copyright',
  TCOP = 'copyright',
  WCP = 'copyright url',
  WCOP = 'copyright url',
  TDA = 'date',
  TDAT = 'date',
  TPOS = 'disc_nr',
  TPA = 'disc_nr',
  TCO = 'genre',
  TCON = 'genre',
  TEN = 'encoded by',
  TENC = 'encoded by',
  // TSS = 'encoder settings',
  // TSSE = 'encoder settings',
  // TDEN = 'encoding time',
  TOWN = 'file owner',
  TFT = 'file type',
  TFLT = 'file type',
  WAF = 'file url',
  WOAF = 'file url',
  TT1 = 'grouping',
  GRP1 = 'grouping',
  TIT1 = 'grouping',
  // APIC = 'image',
  // PIC = 'image',
  TRC = 'isrc',
  TSRC = 'isrc',
  TKE = 'initial key',
  TKEY = 'initial key',
  TRSN = 'internet radio station name',
  TRSO = 'internet radio station owner',
  WORS = 'internet radio station url',
  TP4 = 'interpreted by',
  TPE4 = 'interpreted by',
  IPL = 'involved people',
  IPLS = 'involved people',
  TIPL = 'involved people',
  TLA = 'language',
  TLAN = 'language',
  TLE = 'length',
  TLEN = 'length',
  TXT = 'lyricist',
  TEXT = 'lyricist',
  ULT = 'lyrics',
  USLT = 'lyrics',
  TMT = 'media',
  TMED = 'media',
  TMOO = 'mood',
  MVNM = 'movement name',
  MVIN = 'movement number',
  MCDI = 'music cd identifier',
  TMCL = 'musician credits',
  XOLY = 'olympus dss',
  TOT = 'original album',
  TOAL = 'original album',
  TOA = 'original artist',
  TOPE = 'original artist',
  TOF = 'original file name',
  TOFN = 'original file name',
  TOL = 'original lyricist',
  TOLY = 'original lyricist',
  XDOR = 'original release time',
  TDOR = 'original release time',
  TOR = 'original release year',
  TORY = 'original release year',
  OWNE = 'ownership',
  WPAY = 'payment url',
  PCS = 'podcast?',
  PCST = 'podcast?',
  TCAT = 'podcast category',
  TDES = 'podcast description',
  TGID = 'podcast id',
  TKWD = 'podcast keywords',
  WFED = 'podcast url',
  POP = 'popularimeter',
  POPM = 'popularimeter',
  // PRIV = 'private',
  TPRO = 'produced notice',
  TPB = 'publisher',
  TPUB = 'publisher',
  WPB = 'publisher url',
  WPUB = 'publisher url',
  TRD = 'recording dates',
  TRDA = 'recording dates',
  // TDRC = 'recording time',
  RVA = 'relative volume adjustment',
  RVA2 = 'relative volume adjustment',
  TDRL = 'release time',
  TSST = 'set subtitle',
  TSI = 'size',
  TSIZ = 'size',
  WAS = 'source url',
  WOAS = 'source url',
  TT3 = 'subtitle',
  TIT3 = 'subtitle',
  SLT = 'syn lyrics',
  SYLT = 'syn lyrics',
  TDTG = 'tagging time',
  USER = 'terms of use',
  TIM = 'time',
  TIME = 'time',
  TT2 = 'title',
  TIT2 = 'title',
  TRK = 'track_nr',
  TRCK = 'track_nr',
  TXX = 'user defined text',
  TXXX = 'user defined text',
  WXX = 'user defined url',
  WXXX = 'user defined url',
  TDRC = 'year',
  TYE = 'year',
  TYER = 'year',
  ITU = 'iTunesU?',
  ITNU = 'iTunesU?',
}
/* eslint-enable */

/** Prefix used for cover art identification */
export const COVERART_PREFIX = 'eivu-coverart'

/**
 * Acoustid fingerprint containing the fingerprint and duration
 */
export type AcoustidFingerprint = {
  duration: number
  fingerprint: string
}

/**
 * Metadata profile containing extracted file information and tags
 */
export type MetadataProfile = {
  artists: Artist[]
  duration?: null | number
  metadata_list: Array<Record<string, string>>
  name?: null | string
  path_to_file: null | string
  rating: null | number
  release: Release
  year?: null | number
}

/**
 * Options for overriding metadata extraction behavior
 */
export type OverrideOptions = {
  name?: null | string
  skipOriginalLocalPathToFile?: boolean | null
}

/**
 * Extracts metadata tags from a filename, including performers, studios, and general tags
 * @param pathToFile - The file path to extract metadata from
 * @returns An array of metadata objects with type-value pairs
 */
export const extractAudioInfo = async (pathToFile: string): Promise<Array<Record<string, string>>> => {
  const metadata = await parseFile(pathToFile)
  const v2TagsIds = metadata.format.tagTypes.filter((value) => ['ID3v2.2', 'ID3v2.3', 'ID3v2.4'].includes(value))

  // short cirtcuit if no v2 tags found
  if (v2TagsIds.length === 0) return []

  const v2TagsId = v2TagsIds[0]
  let extractedValue: string
  const tags = metadata.native[v2TagsId]
    .map((tag): Record<string, string> | undefined => {
      if (Object.keys(V2_FRAMES).includes(tag.id)) {
        extractedValue =
          typeof tag.value === 'object' && tag.value !== null && !Array.isArray(tag.value) && 'text' in tag.value
            ? (tag.value.text as string)
            : (tag.value as string)
        return {[`id3:${V2_FRAMES[tag.id as keyof typeof V2_FRAMES]}`]: extractedValue}
      }

      return undefined
    })
    .filter((tag): tag is Record<string, string> => tag !== undefined)
  const metadataHash = {} as Record<string, number | string | undefined>
  const {duration, fingerprint} = await generateAcoustidFingerprint(pathToFile)
  metadataHash['acoustid:fingerprint'] = fingerprint
  metadataHash['acoustid:duration'] = duration
  metadataHash['eivu:release_pos'] = metadataHash.track_nr
  metadataHash['eivu:year'] = metadataHash.year
  metadataHash['eivu:duration'] = duration
  metadataHash['eivu:name'] = metadataHash['id3:title']
  // metadataHash['eivu:artist_name'] = metadataHash

  // metadata_hash['acoustid:fingerprint'] = acoustid_client.fingerprint
  // metadata_hash['acoustid:duration']    = acoustid_client.duration
  // metadata_hash['eivu:release_pos']     = metadata_hash['id3:track_nr']
  // metadata_hash['eivu:year']            = metadata_hash['id3:year']
  // metadata_hash['eivu:duration']        = acoustid_client.duration
  // metadata_hash['eivu:name']            = metadata_hash['id3:title']
  // metadata_hash['eivu:artist_name']     = metadata_hash['id3:artist']
  // metadata_hash['eivu:release_name']    = metadata_hash['id3:album']
  // metadata_hash['eivu:bundle_pos']      = metadata_hash['id3:disc_nr']
  // metadata_hash['eivu:album_artist']    = metadata_hash['id3:band']
  // artwork = upload_audio_artwork(path_to_file, metadata_hash.dup)
  // metadata_hash['eivu:artwork_md5'] = artwork.md5 if artwork.present?
  // metadata_hash.compact_blank.map { |k, v| { k => v } }

  return tags
}

/**
 * Extracts metadata from a file
 * @param pathToFile - The file path to extract metadata from
 * @returns The extracted metadata
 */
export const extractInfo = async (pathToFile: string): Promise<Array<Record<string, string>>> => {
  const {mediatype} = detectMime(pathToFile)
  if (mediatype === 'audio') return extractAudioInfo(pathToFile)

  return extractMetadataList(pathToFile)
}

/**
 * Extracts metadata tags from a filename, including performers, studios, and general tags
 * @param input - The file path or filename to extract metadata from
 * @returns An array of metadata objects with type-value pairs
 */
export const extractMetadataList = (input: string): Array<Record<string, string>> => {
  let base = path.basename(input)

  // remove year
  base = base.replaceAll(YEAR_REGEX, '')

  const regexMap: Record<string, RegExp> = {
    performer: PERFORMER_REGEX,
    studio: STUDIO_REGEX,
    tag: TAG_REGEX,
  }

  const results: Array<Record<string, string>> = []

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
 * @param params.override - Options to override default extraction behavior
 * @param params.pathToFile - Path to the file being processed
 * @returns A complete metadata profile including artists, release info, and extracted tags
 */
export const generateDataProfile = async ({
  metadataList = [],
  override = {},
  pathToFile,
}: {
  metadataList?: Array<Record<string, string>>
  override?: OverrideOptions
  pathToFile: string
}): Promise<MetadataProfile> => {
  // Extract additional metadata from the filename and merge with provided metadata list
  const fileInfo = await extractInfo(pathToFile)
  metadataList = [...metadataList, ...fileInfo]

  // Optionally include original local path
  if (!override?.skipOriginalLocalPathToFile) {
    // eslint-disable-next-line camelcase
    metadataList.push({original_local_path_to_file: pathToFile})
  }

  const year = extractYear(pathToFile) ?? pruneNumber(metadataList, 'eivu:year')
  const name = override?.name ?? pruneString(metadataList, 'eivu:name')
  const artwork_md5 = pruneString(metadataList, 'eivu:artwork_md5') // eslint-disable-line camelcase
  const position = pruneNumber(metadataList, 'eivu:release_pos')
  const bundle_pos = pruneNumber(metadataList, 'eivu:bundle_pos') // eslint-disable-line camelcase
  const duration = pruneNumber(metadataList, 'eivu:duration')
  const artist_name = pruneString(metadataList, 'eivu:artist_name') // eslint-disable-line camelcase
  const release_name = pruneString(metadataList, 'eivu:release_name') // eslint-disable-line camelcase
  const album_artist = pruneString(metadataList, 'eivu:album_artist') // eslint-disable-line camelcase
  // const matched_recording = null
  const param_path_to_file = override?.skipOriginalLocalPathToFile ? null : pathToFile // eslint-disable-line camelcase

  const dataProfile: MetadataProfile = {
    artists: name ? [{name: artist_name} as Artist] : [], // eslint-disable-line camelcase
    duration,
    metadata_list: metadataList, // eslint-disable-line camelcase
    name,
    path_to_file: param_path_to_file, // eslint-disable-line camelcase
    rating: extractRating(pathToFile),
    release: {
      artwork_md5, // eslint-disable-line camelcase
      bundle_pos: bundle_pos === null ? null : String(bundle_pos), // eslint-disable-line camelcase
      name: release_name, // eslint-disable-line camelcase
      position: position === null ? null : String(position),
      primary_artist_name: album_artist, // eslint-disable-line camelcase
      year: year === null ? null : String(year),
    },
    year,
  }

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
export const pruneFromMetadataList = (
  metadataList: Array<Record<string, unknown>>,
  key: string,
): null | number | string => {
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
const pruneString = (metadataList: Array<Record<string, unknown>>, key: string): null | string => {
  const value = pruneFromMetadataList(metadataList, key)
  return value === null ? null : String(value)
}

/**
 * Helper function to extract a number value from the metadata list
 * @param metadataList - The array of metadata objects
 * @param key - The key to search for
 * @returns The number value, or null if not found
 */
const pruneNumber = (metadataList: Array<Record<string, unknown>>, key: string): null | number => {
  const value = pruneFromMetadataList(metadataList, key)
  return value === null ? null : Number(value)
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
