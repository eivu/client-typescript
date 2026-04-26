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

/** Matches `{AwardName} Winner {year}` */
const WINNER_PATTERN = /^(.+?)\s+Winner\s+(\d{4})$/

/** Matches `{AwardName} Nominee {year}` */
const NOMINEE_YEAR_PATTERN = /^(.+?)\s+Nominee\s+(\d{4})$/

/**
 * Given a set of existing tag values, computes all implied award tags
 * that should also be present.
 *
 * @param existingTags - Set of current tag values (without the `- tag: ` prefix)
 * @returns Array of tag values to add (excluding any already in existingTags)
 */
export function deriveAwardTags(existingTags: Set<string>): string[] {
  const toAdd = new Set<string>()

  for (const tag of existingTags) {
    const winnerMatch = tag.match(WINNER_PATTERN)
    if (winnerMatch) {
      const [, award, year] = winnerMatch
      // Winner implies all of these
      toAdd.add(`${award} Nominee ${year}`)
      toAdd.add(`${award} Nominee`)
      toAdd.add(`${award} Winning Series`)
      toAdd.add(`${award} Nominated Series`)
      toAdd.add(`${award} Recognized Series`)
      toAdd.add('Award Winning Series')
      toAdd.add('Award Recognized Series')
      continue
    }

    const nomineeMatch = tag.match(NOMINEE_YEAR_PATTERN)
    if (nomineeMatch) {
      const [, award] = nomineeMatch
      // Nominee implies these (but not winning)
      toAdd.add(`${award} Nominee`)
      toAdd.add(`${award} Nominated Series`)
      toAdd.add(`${award} Recognized Series`)
      toAdd.add('Award Recognized Series')
    }
  }

  // Filter out tags that already exist, using a case-insensitive check so that
  // a partially-normalized tag (e.g. "award Recognized Series") still blocks the
  // correctly-cased derived form ("Award Recognized Series") from being added as
  // a duplicate. Casing normalization (SERIES_CASING_FIXES) is the primary fix;
  // this is a defense-in-depth safety net for any edge cases that slip through.
  const existingTagsLower = new Set([...existingTags].map((t) => t.toLowerCase()))
  return [...toAdd].filter((t) => !existingTagsLower.has(t.toLowerCase()))
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

  // Step 0: Normalize casing of existing award series tags to Title Case.
  //   e.g. "Eisner Award winning series" → "Eisner Award Winning Series"
  //        "award recognized series"     → "Award Recognized Series"
  //
  // Specific patterns for the standalone cross-award generic tags come FIRST so
  // they take priority and fully normalize both the prefix AND the suffix.
  // The generic suffix-only patterns below would leave the prefix lowercase
  // (e.g. "award recognized series" → "award Recognized Series") which would
  // cause the derived "Award Recognized Series" to pass the case-sensitive
  // duplicate filter and create a duplicate tag.
  const SERIES_CASING_FIXES: Array<{pattern: RegExp; replacement: string}> = [
    {pattern: /^(\s*- tag:\s*)award\s+winning\s+series$/i, replacement: '$1Award Winning Series'},
    {pattern: /^(\s*- tag:\s*)award\s+nominated\s+series$/i, replacement: '$1Award Nominated Series'},
    {pattern: /^(\s*- tag:\s*)award\s+recognized\s+series$/i, replacement: '$1Award Recognized Series'},
    {pattern: /^(\s*- tag:\s*.+?)\s+winning series$/i, replacement: '$1 Winning Series'},
    {pattern: /^(\s*- tag:\s*.+?)\s+nominated series$/i, replacement: '$1 Nominated Series'},
    {pattern: /^(\s*- tag:\s*.+?)\s+recognized series$/i, replacement: '$1 Recognized Series'},
  ]

  lines = lines.map((line) => {
    for (const {pattern, replacement} of SERIES_CASING_FIXES) {
      if (pattern.test(line)) {
        return line.replace(pattern, replacement)
      }
    }

    return line
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
