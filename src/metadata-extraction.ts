import {type Artist} from '@src/types/artist'
import {type Release} from '@src/types/release'
import path from 'node:path'

// Regex constants
const TAG_REGEX = /\(\((?![psy] )([^)]+)\)\)/g
const PERFORMER_REGEX = /\(\(p ([^)]+)\)\)/g
const STUDIO_REGEX = /\(\(s ([^)]+)\)\)/g
const YEAR_REGEX = /\(\(y ([^)]+)\)\)/g
const RATING_500_475_REGEX = /^_+/g
const RATING_425_REGEX = /^`/g
export const COVERART_PREFIX = 'eivu-coverart'

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

export type OverrideOptions = {
  name?: null | string
  skipOriginalLocalPathToFile?: boolean | null
}

// Extract year from filename
export const extractYear = (input: string): null | number => {
  const base = path.basename(input)
  const match = /\(\(y ([^)]+)\)\)/.exec(base)
  return match ? Number(match[1].trim()) : null
}

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

// Extract rating from filename
export function extractRating(input: string): null | number {
  const base = path.basename(input)

  if (base.startsWith('__')) return 5
  if (base.startsWith('_')) return 4.75
  if (base.startsWith('`')) return 4.25

  return null
}

export const generateDataProfile = ({
  metadataList = [],
  override = {},
  pathToFile,
}: {
  metadataList?: Array<Record<string, string>>
  override?: OverrideOptions
  pathToFile: string
}): MetadataProfile => {
  metadataList = [...metadataList, ...extractMetadataList(pathToFile)]

  // Optionally include original local path
  if (!override?.skipOriginalLocalPathToFile) {
    // eslint-disable-next-line camelcase
    metadataList.push({original_local_path_to_file: pathToFile})
  }

  // const year = extractYear(pathToFile) ?? pruneFromMetadataList(metadataList, 'eivu:year')
  return {} as MetadataProfile
}

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

export const pruneFromMetadataList = (
  metadataList: Array<Record<string, unknown>>,
  key: string,
): null | Record<string, unknown> => {
  const index = metadataList.findIndex((item) => Object.hasOwn(item, key))
  if (index !== -1) {
    const [item] = metadataList.splice(index, 1)
    return item
  }

  return null
}
