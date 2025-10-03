import path from 'node:path'

// Regex constants
const TAG_REGEX = /\(\((?![psy] )([^)]+)\)\)/g
const PERFORMER_REGEX = /\(\(p ([^)]+)\)\)/g
const STUDIO_REGEX = /\(\(s ([^)]+)\)\)/g
const YEAR_REGEX = /\(\(y ([^)]+)\)\)/g

export const COVERART_PREFIX = 'eivu-coverart'

// Extract year from filename
export const extractYear = (input: string): null | number => {
  const base = path.basename(input)
  const match = /\(\(y ([^)]+)\)\)/.exec(base)
  return match ? Number(match[1].trim()) : null
}

// Extract metadata list
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
