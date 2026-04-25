/**
 * Mechanical post-process rules — enforces formatting/structural rules that are
 * purely deterministic and don't require model judgment. These rules are kept in
 * the runtime violations table (so the model is aware of conventions) but removed
 * from the checklist (so the model doesn't waste reasoning tokens re-verifying).
 *
 * Rules enforced here:
 *   #7  — ai:rating >= 4.0 → add Masterwork tag
 *   #12 — Numbers never quoted (year, ai:rating, duration, position)
 *   #17 — Remove `format: Digital`
 *   #19 — Force correct ai:skill_version
 *   #22 — Zero-pad S##, v##, E## in name field
 *   #24 — Genre values Title Case
 */

/** Current skill version — update when the runtime version changes. */
const CURRENT_SKILL_VERSION = '7.16.4'

const MASTERWORK_TAG = "Eivu's AI Masterwork Collection"

/**
 * #7 — If ai:rating >= 4.0, ensure the Masterwork tag is present.
 * If ai:rating < 4.0, ensure it is NOT present (in case model added it erroneously).
 */
export function enforceMasterworkTag(yaml: string): string {
  const lines = yaml.split('\n')

  // Find ai:rating value
  let ratingValue = -1
  for (const line of lines) {
    const match = line.match(/^\s*- ai:rating:\s*"?(\d+(?:\.\d+)?)"?/)
    if (match) {
      ratingValue = Number.parseFloat(match[1])
      break
    }
  }

  if (ratingValue < 0) return yaml // no rating found, leave as-is

  const hasMasterwork = lines.some((l) => l.includes(`tag: ${MASTERWORK_TAG}`))

  if (ratingValue >= 4 && !hasMasterwork) {
    // Add Masterwork tag after ai:engine line
    const engineIndex = lines.findIndex((l) => /^\s*- ai:engine:/.test(l))
    if (engineIndex !== -1) {
      const indentMatch = lines[engineIndex].match(/^(\s*)/)
      const indent = indentMatch ? indentMatch[1] : '  '
      lines.splice(engineIndex + 1, 0, `${indent}- tag: ${MASTERWORK_TAG}`)
    }
  } else if (ratingValue < 4 && hasMasterwork) {
    // Remove erroneous Masterwork tag
    return lines.filter((l) => !l.includes(`tag: ${MASTERWORK_TAG}`)).join('\n')
  }

  return lines.join('\n')
}

/**
 * #12 — Unquote numeric values for known numeric fields.
 * Matches: year, ai:rating, duration, position, bundle_pos, release.year, release.position
 */
export function unquoteNumbers(yaml: string): string {
  // Top-level numeric fields: year, duration
  let result = yaml.replaceAll(/^((?:year|duration):\s*)"(\d+(?:\.\d+)?)"$/gm, '$1$2')

  // metadata_list numeric fields: ai:rating
  result = result.replaceAll(/^(\s*- ai:rating:\s*)"(\d+(?:\.\d+)?)"$/gm, '$1$2')

  // release sub-fields: year, position, bundle_pos
  result = result.replaceAll(/^(\s+(?:year|position|bundle_pos):\s*)"(\d+(?:\.\d+)?)"$/gm, '$1$2')

  return result
}

/**
 * #17 — Remove any `- format: Digital` line from metadata_list.
 */
export function removeFormatDigital(yaml: string): string {
  return yaml
    .split('\n')
    .filter((line) => !/^\s*- format:\s*Digital\s*$/i.test(line))
    .join('\n')
}

/**
 * #19 — Force ai:skill_version to the current version.
 * If the line exists, overwrite the value. If missing, add after ai:rating_reasoning.
 */
export function enforceSkillVersion(yaml: string): string {
  const lines = yaml.split('\n')
  let skillVersionIndex = -1
  let ratingReasoningIndex = -1
  let engineIndex = -1

  for (const [i, line] of lines.entries()) {
    if (/^\s*- ai:skill_version:/.test(line)) skillVersionIndex = i
    if (/^\s*- ai:rating_reasoning:/.test(line)) ratingReasoningIndex = i
    if (/^\s*- ai:engine:/.test(line)) engineIndex = i
  }

  if (skillVersionIndex >= 0) {
    // Overwrite existing value
    lines[skillVersionIndex] = lines[skillVersionIndex].replace(
      /^(\s*- ai:skill_version:\s*).*$/,
      `$1${CURRENT_SKILL_VERSION}`,
    )
  } else {
    // Insert after ai:rating_reasoning, or before ai:engine, whichever is found
    const insertAfter = ratingReasoningIndex >= 0 ? ratingReasoningIndex : engineIndex - 1
    if (insertAfter >= 0) {
      const indentMatch = lines[insertAfter + 1]?.match(/^(\s*)/) ?? lines[insertAfter]?.match(/^(\s*)/)
      const indent = indentMatch ? indentMatch[1] : '  '
      lines.splice(insertAfter + 1, 0, `${indent}- ai:skill_version: ${CURRENT_SKILL_VERSION}`)
    }
  }

  return lines.join('\n')
}

/**
 * #22 — Zero-pad S##, v##, E## in the name field.
 * S1 → S01, v2 → v02, E9 → E09. Only targets single-digit numbers.
 */
export function zeroPadNameNumbers(yaml: string): string {
  return yaml.replace(/^(name:\s*.*)$/m, (_, nameLine: string) =>
    nameLine
      .replaceAll(/\bS(\d)(?!\d)/g, 'S0$1')
      .replaceAll(/\bv(\d)(?!\d)/g, 'v0$1')
      .replaceAll(/\bE(\d)(?!\d)/g, 'E0$1'),
  )
}

/**
 * #24 — Enforce Title Case on genre values.
 * `genre: science fiction` → `genre: Science Fiction`
 * `id3:genre: r&b` → `id3:genre: R&B`
 *
 * Uses smart Title Case that handles:
 *   - Articles/prepositions stay lowercase mid-phrase (of, the, and, in, on, for, to, a, an)
 *   - First word always capitalized
 *   - All-caps short words preserved (R&B, TV, RPG, UK, US)
 *   - Hyphenated words each capitalized (Sci-Fi → Sci-Fi)
 */
const LOWERCASE_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'but',
  'by',
  'for',
  'in',
  'nor',
  'of',
  'on',
  'or',
  'the',
  'to',
  'vs',
])
const PRESERVE_UPPERCASE = new Set(['hip-hop', 'lo-fi', 'r&b', 'rpg', 'tv', 'uk', 'us'])

function smartTitleCase(str: string): string {
  return str
    .split(/(\s+)/)
    .map((word, i) => {
      if (/^\s+$/.test(word)) return word // preserve whitespace

      // Preserve known uppercase abbreviations
      if (PRESERVE_UPPERCASE.has(word.toLowerCase())) return word.toUpperCase()

      // Handle hyphenated words
      if (word.includes('-')) {
        return word
          .split('-')
          .map((part) => {
            if (PRESERVE_UPPERCASE.has(part.toLowerCase())) return part.toUpperCase()
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          })
          .join('-')
      }

      // Lowercase articles/prepositions unless first word
      if (i > 0 && LOWERCASE_WORDS.has(word.toLowerCase())) return word.toLowerCase()

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join('')
}

export function enforceGenreTitleCase(yaml: string): string {
  return yaml.replaceAll(
    /^(\s*- (?:id3:)?genre:\s*)(.+)$/gm,
    (_, prefix: string, value: string) => `${prefix}${smartTitleCase(value.trim())}`,
  )
}

/**
 * Applies all mechanical post-process rules in sequence.
 * Call this from the main postProcess function.
 */
export function applyMechanicalRules(yaml: string): string {
  let result = yaml
  result = unquoteNumbers(result) // #12
  result = removeFormatDigital(result) // #17
  result = enforceSkillVersion(result) // #19
  result = zeroPadNameNumbers(result) // #22
  result = enforceGenreTitleCase(result) // #24
  result = enforceMasterworkTag(result) // #7 (last — depends on clean ai:rating)
  return result
}
