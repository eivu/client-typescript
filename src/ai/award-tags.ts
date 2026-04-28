/**
 * Award tag normalization — ensures all implied tags are present when
 * an award Winner or Nominee tag exists.
 *
 * Post-processing rules:
 *
 * If tag: `{Award} Winner {year}` is present, also ensure:
 *   - `{Award} Nominee {year}`           (winners are always nominees)
 *   - `{Award} Nominee`                  (generic nominee tag)
 *   - `{Award} Winning Series`           (series-level winner tag)
 *   - `{Award} Nominated Series`         (winning implies nominated)
 *   - `{Award} Recognized Series`        (series-level recognition)
 *   - `Award Winning Series`             (cross-award generic)
 *   - `Award Recognized Series`          (cross-award generic)
 *
 * If tag: `{Award} Nominee {year}` is present (without a Winner for that year), also ensure:
 *   - `{Award} Nominee`                  (generic nominee tag)
 *   - `{Award} Nominated Series`         (series-level nominee tag)
 *   - `{Award} Recognized Series`        (series-level recognition)
 *   - `Award Recognized Series`          (cross-award generic)
 *
 * Recognized award prefixes: Eisner Award, Harvey Award, Hugo Award, Pulitzer Prize,
 * Ringo Award, Ignatz Award, and any other `X Award` pattern.
 */

/** Matches `{AwardName} Winner {year}` (case-insensitive) */
const WINNER_PATTERN = /^(.+?)\s+Winner\s+(\d{4})$/i

/** Matches `{AwardName} Nominee {year}` (case-insensitive) */
const NOMINEE_YEAR_PATTERN = /^(.+?)\s+Nominee\s+(\d{4})$/i

/**
 * Title-cases an award name prefix so that derived tags have canonical casing
 * regardless of what the AI emitted (e.g. "eisner award" → "Eisner Award").
 */
function titleCaseAward(award: string): string {
  return award
    .split(' ')
    .map((word) => (word ? capitalizeFirst(word) : word))
    .join(' ')
}

/** Capitalizes the first character and lowercases the rest (e.g. "WINNER" → "Winner"). */
function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

/**
 * Case-insensitive add to a Map<lowercase, canonicalValue>.
 * The first value wins, so earlier (winner) branches take precedence.
 */
function ciAdd(map: Map<string, string>, value: string): void {
  const key = value.toLowerCase()
  if (!map.has(key)) map.set(key, value)
}

/**
 * Given a set of existing tag values, computes all implied award tags
 * that should also be present.
 *
 * @param existingTags - Set of current tag values (without the `- tag: ` prefix)
 * @returns Array of tag values to add (excluding any already in existingTags)
 */
export function deriveAwardTags(existingTags: Set<string>): string[] {
  // Map<lowercase → canonical> so internally-derived tags are deduplicated
  // case-insensitively. Without this, two source tags whose award names differ
  // only in casing (e.g. "eisner award Winner 2020" and "Eisner Award Winner 2021")
  // would each add their own casing variant of the same implied tag.
  const toAdd = new Map<string, string>()

  for (const tag of existingTags) {
    const winnerMatch = tag.match(WINNER_PATTERN)
    if (winnerMatch) {
      const [, rawAward, year] = winnerMatch
      const award = titleCaseAward(rawAward)
      // Winner implies all of these
      ciAdd(toAdd, `${award} Nominee ${year}`)
      ciAdd(toAdd, `${award} Nominee`)
      ciAdd(toAdd, `${award} Winning Series`)
      ciAdd(toAdd, `${award} Nominated Series`)
      ciAdd(toAdd, `${award} Recognized Series`)
      ciAdd(toAdd, 'Award Winning Series')
      ciAdd(toAdd, 'Award Recognized Series')
      continue
    }

    const nomineeMatch = tag.match(NOMINEE_YEAR_PATTERN)
    if (nomineeMatch) {
      const [, rawAward] = nomineeMatch
      const award = titleCaseAward(rawAward)
      // Nominee implies these (but not winning)
      ciAdd(toAdd, `${award} Nominee`)
      ciAdd(toAdd, `${award} Nominated Series`)
      ciAdd(toAdd, `${award} Recognized Series`)
      ciAdd(toAdd, 'Award Recognized Series')
    }
  }

  // Filter out tags that already exist, using a case-insensitive check so that
  // a partially-normalized tag (e.g. "award Recognized Series") still blocks the
  // correctly-cased derived form ("Award Recognized Series") from being added as
  // a duplicate. Casing normalization (SERIES_CASING_FIXES) is the primary fix;
  // this is a defense-in-depth safety net for any edge cases that slip through.
  const existingTagsLower = new Set([...existingTags].map((t) => t.toLowerCase()))
  return [...toAdd.values()].filter((t) => !existingTagsLower.has(t.toLowerCase()))
}

/**
 * Given a full YAML string, finds all `- tag: ...` entries that match award
 * patterns, derives any missing implied tags, and inserts them after the
 * last award-related tag line.
 *
 * @param yaml - The full YAML string
 * @returns YAML with missing award tags added
 */
export function normalizeAwardTags(yaml: string): string {
  let lines = yaml.split('\n')

  // Step 0: Normalize casing of award tag lines to canonical Title Case so that
  // WINNER_PATTERN / NOMINEE_YEAR_PATTERN (and the duplicate filter) operate on
  // consistently-cased values regardless of what the AI emitted.
  //
  // Both the award-name PREFIX and the trailing keyword are title-cased. Using a
  // plain regex backreference replacement (e.g. `$1 Winner $2`) would preserve
  // the prefix's original casing, leaving inconsistent casing between source tags
  // (e.g. "eisner award Winner 2020") and derived tags (always "Eisner Award …").
  // The case-insensitive dedup filter in deriveAwardTags would then block the
  // correctly-cased derived form from being added, leaving the badly-cased
  // original as the only copy in the output YAML.
  //
  // Pattern order: year-suffixed winner/nominee runs first so the trailing
  // `\d{4}` is consumed before the series-suffix pass looks at the line.
  const YEAR_SUFFIX_AWARD_RE = /^(\s*- tag:\s*)(.+?)\s+(winner|nominee)\s+(\d{4})$/i
  const SERIES_SUFFIX_AWARD_RE = /^(\s*- tag:\s*)(.+?)\s+(winning|nominated|recognized)\s+series$/i

  lines = lines.map((line) => {
    const yearMatch = line.match(YEAR_SUFFIX_AWARD_RE)
    if (yearMatch) {
      const [, prefix, rawAward, keyword, year] = yearMatch
      return `${prefix}${titleCaseAward(rawAward)} ${capitalizeFirst(keyword)} ${year}`
    }

    const seriesMatch = line.match(SERIES_SUFFIX_AWARD_RE)
    if (seriesMatch) {
      const [, prefix, rawAward, keyword] = seriesMatch
      // titleCaseAward("award") → "Award", so the cross-award generic form
      // (e.g. "award recognized series" → "Award Recognized Series") is also
      // covered without needing a separate pattern.
      return `${prefix}${titleCaseAward(rawAward)} ${capitalizeFirst(keyword)} Series`
    }

    return line
  })

  // Normalize standalone `{Award} Nominee` / `{Award} Winner` tags that have no year suffix.
  // SERIES_CASING_FIXES handles the year-suffixed forms (e.g. "nominee 2020" → "Nominee 2020")
  // but leaves year-free variants (e.g. "eisner award nominee") untouched.  Without this pass,
  // "eisner award nominee" ends up in existingTagsLower and the case-insensitive dedup filter
  // at the bottom of deriveAwardTags blocks the correctly-cased "Eisner Award Nominee" from
  // being added — leaving the badly-cased original as the only copy in the output YAML.
  const STANDALONE_AWARD_KEYWORD_RE = /^(\s*- tag:\s*)(.+?)\s+(nominee|winner)$/i
  lines = lines.map((line) => {
    const m = line.match(STANDALONE_AWARD_KEYWORD_RE)
    if (!m) return line
    const [, prefix, rawAward, keyword] = m
    return `${prefix}${titleCaseAward(rawAward)} ${capitalizeFirst(keyword)}`
  })

  // Collect existing tags and track award tag positions
  const existingTags = new Set<string>()
  let lastAwardTagIndex = -1
  let lastTagIndex = -1

  for (const [i, line] of lines.entries()) {
    const tagMatch = line.match(/^(\s*)- tag:\s*(.+)$/)
    if (tagMatch) {
      const tagValue = tagMatch[2].trim()
      existingTags.add(tagValue)
      lastTagIndex = i

      // Track last award-related tag for insertion point
      if (WINNER_PATTERN.test(tagValue) || NOMINEE_YEAR_PATTERN.test(tagValue) ||
          /(?:Award|Prize)\s+(?:Nominee|Winning|Nominated|Recognized)/i.test(tagValue) ||
          /^Award\s+(?:Winning|Recognized)\s+Series$/i.test(tagValue)) {
        lastAwardTagIndex = i
      }
    }
  }

  // No tags at all → nothing to do
  if (lastTagIndex === -1) return lines.join('\n')

  const derived = deriveAwardTags(existingTags)
  if (derived.length === 0) return lines.join('\n')

  // Determine indent from existing tag line
  const insertAfter = lastAwardTagIndex >= 0 ? lastAwardTagIndex : lastTagIndex
  const indentMatch = lines[insertAfter].match(/^(\s*)/)
  const indent = indentMatch ? indentMatch[1] : '  '

  // Insert new tag lines after the last award tag (or last tag)
  const newLines = derived.map((t) => `${indent}- tag: ${t}`)
  lines.splice(insertAfter + 1, 0, ...newLines)

  return lines.join('\n')
}
