import YAML from 'yaml'

/** Validation result: sanitized YAML on success, or an error message on failure. */
export type ValidationResult = {error: string} | {yaml: string}

/**
 * Checks whether an unquoted YAML scalar value contains characters that could
 * break parsing. Covers comment indicators, nested mapping separators, and
 * reserved start-of-value characters.
 */
function needsQuoting(value: string): boolean {
  // " #" in YAML starts a comment, silently truncating the value
  if (/ #/.test(value)) return true
  // ": " can be misinterpreted as a nested mapping separator
  if (/: /.test(value)) return true
  // These characters are reserved at the start of a YAML value:
  // [/{ = flow collection, */& = alias/anchor, ! = tag, @/` = reserved
  if (/^[\[{*&!@`]/.test(value.trimStart())) return true
  return false
}

/**
 * Quotes unquoted YAML values that contain characters known to break parsing.
 *
 * Processes line-by-line, tracking block scalar context (`|` / `>`) so
 * continuation lines are never modified. For each key-value line, if the value
 * is unquoted and contains problematic characters (` #`, `: `, or starts with
 * `[`, `{`, `*`, `&`, `!`, `@`, backtick), it wraps the value in double quotes
 * (escaping existing `\` and `"`).
 *
 * @param yaml - Raw YAML string
 * @returns Sanitized YAML string with problematic values quoted
 */
export function sanitizeYamlValues(yaml: string): string {
  const lines = yaml.split('\n')
  let inBlockScalar = false
  let blockScalarBaseIndent = -1

  const result = lines.map((line) => {
    const trimmed = line.trimStart()
    const currentIndent = line.length - trimmed.length

    // Block scalar content (lines after | or >) is literal text — never modify it.
    // We exit when we encounter a non-empty line at the same or lesser indent as the key.
    if (inBlockScalar) {
      if (trimmed === '' || currentIndent > blockScalarBaseIndent) {
        return line
      }

      inBlockScalar = false
    }

    // Match key-value lines: optional indent, optional list prefix, key (may contain colons
    // without trailing spaces, e.g. ai:rating), separator (: + whitespace), and value.
    // The lazy .*? ensures we split at the FIRST `: ` that acts as the YAML key separator.
    const match = line.match(/^(\s*(?:-\s+)?\S.*?:\s+)(.+)$/)
    if (!match) return line

    const [, prefix, value] = match

    // Block scalar indicator (| or >) — track context so we skip continuation lines
    if (/^[|>]/.test(value.trim())) {
      inBlockScalar = true
      blockScalarBaseIndent = currentIndent
      return line
    }

    // Already quoted — no modification needed
    if (/^["']/.test(value.trim())) return line

    if (!needsQuoting(value)) return line

    // Escape existing backslashes and double quotes before wrapping in double quotes
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return `${prefix}"${escaped}"`
  })

  return result.join('\n')
}

/**
 * Validates that a raw YAML string meets the minimum requirements for an .eivu.yml file.
 *
 * Checks (in order):
 *   1. A line starting with `name:` (required top-level key)
 *   2. A line starting with `metadata_list:` (required top-level key)
 *   3. Sanitizes values with characters that break YAML (` #`, `: `, etc.)
 *   4. Valid YAML syntax (parseable after sanitization)
 *
 * @param yaml - Raw YAML string to validate
 * @returns `{yaml}` with the sanitized YAML on success, or `{error}` on failure
 */
export function validateEivuYaml(yaml: string): ValidationResult {
  const lines = yaml.split('\n')

  // Structural checks first (cheap) — these catch responses that are clearly
  // not eivu YAML (e.g. the AI returned prose or a partial response)
  if (!lines.some((line) => /^name:/.test(line))) {
    return {error: 'Missing required top-level key: name'}
  }

  if (!lines.some((line) => /^metadata_list:/.test(line))) {
    return {error: 'Missing required top-level key: metadata_list'}
  }

  // Sanitize before parsing — the AI sometimes forgets to quote values containing
  // special YAML characters (e.g. `collects: Batman #1-5` where `#1-5` becomes a comment)
  const sanitized = sanitizeYamlValues(yaml)

  try {
    YAML.parse(sanitized)
  } catch (error) {
    return {error: `Invalid YAML: ${error instanceof Error ? error.message : String(error)}`}
  }

  // Return the sanitized version so it flows through to post-processing
  return {yaml: sanitized}
}
