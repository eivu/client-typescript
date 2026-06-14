import YAML from 'yaml'
import {z} from 'zod'

/** Stable code identifying a specific class of validation failure. */
export type ValidationCode =
  | 'metadata_list_invalid_type'
  | 'missing_metadata_list'
  | 'missing_name'
  | 'missing_reasoning'
  | 'name_invalid_type'
  | 'non_mapping_item'
  | 'rating_invalid_type'
  | 'rating_off_step'
  | 'rating_out_of_range'
  | 'reasoning_invalid_type'
  | 'yaml_syntax_error'

/**
 * One structured validation failure. `code` is stable for downstream telemetry
 * + log analysis; `message` is human-readable; `path` is dotted (`metadata_list[3].ai:rating`)
 * so a reader can locate the offending field; `retriable` flags whether the
 * retry loop should re-prompt the AI (vs hand off to deterministic postprocess).
 *
 * Phase 3 marks every code retriable=true; downstream phases may flip codes
 * like `name_invalid_type` to retriable=false once deterministic-fix routing
 * exists in `MetadataGenerator`.
 */
export type ValidationIssue = {
  code: ValidationCode
  message: string
  path: string
  retriable: boolean
}

/** Sanitized YAML on success; structured issues + the raw input on failure. */
export type ValidationFailed = {errors: ValidationIssue[]; rawYaml: string}
export type ValidationOk = {sanitizedYaml: string}
export type ValidationResult = ValidationFailed | ValidationOk

const AI_RATING_KEY = 'ai:rating'
const AI_RATING_REASONING_KEY = 'ai:rating_reasoning'
const RATING_MIN = 0
const RATING_MAX = 5

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
  if (/^[[{*&!@`]/.test(value.trimStart())) return true
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
    const escaped = value.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`)
    return `${prefix}"${escaped}"`
  })

  return result.join('\n')
}

/**
 * Zod schema for the structural shape: required `name` (non-empty string),
 * required `metadata_list` (array of mappings). `.loose()` lets other top-level
 * fields (year, description, info_url, etc.) flow through unvalidated —
 * postprocess and downstream code own those values.
 */
const structuralSchema = z
  .object({
    // eslint-disable-next-line camelcase -- key name is dictated by the .eivu.yml schema
    metadata_list: z.array(z.record(z.string(), z.unknown())),
    name: z.string().min(1),
  })
  .loose()

/**
 * Coerces a numeric string (e.g. `"4.5"`) to a number so the AI's occasionally-quoted
 * rating values don't need to wait for postprocess #12 to unquote before validation
 * can see the half-step structure.
 */
function coerceRating(value: unknown): unknown {
  if (typeof value === 'string' && /^[+-]?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value)
  }

  return value
}

/**
 * Format a path array (`['metadata_list', 3, 'ai:rating']`) as the dotted form
 * used in `ValidationIssue.path` (`metadata_list[3].ai:rating`). The bracket
 * syntax for array indices keeps the form unambiguous for keys that themselves
 * contain dots.
 */
function formatPath(segments: Array<number | string>): string {
  let result = ''
  for (const [i, seg] of segments.entries()) {
    if (typeof seg === 'number') {
      result += `[${seg}]`
    } else {
      result += i === 0 ? seg : `.${seg}`
    }
  }

  return result
}

/**
 * Converts a Zod issue at the top-level shape into one of our structured
 * `ValidationIssue` codes. Missing-key cases are handled upstream of zod
 * (so missing_* codes never need to be inferred from issue type), leaving
 * this fn to handle WRONG-TYPE cases only.
 */
function zodIssueToValidationIssue(issue: z.core.$ZodIssue): null | ValidationIssue {
  const path = formatPath(issue.path as Array<number | string>)

  if (path === 'name') {
    return {code: 'name_invalid_type', message: 'name must be a non-empty string', path, retriable: true}
  }

  if (path === 'metadata_list') {
    return {
      code: 'metadata_list_invalid_type',
      message: 'metadata_list must be an array of mappings',
      path,
      retriable: true,
    }
  }

  // Per-item: an entry in metadata_list that is not a mapping (string, array, number, etc.)
  if (path.startsWith('metadata_list[')) {
    return {
      code: 'non_mapping_item',
      message: `${path} must be a single-key mapping (e.g. \`- writer: Someone\`)`,
      path,
      retriable: true,
    }
  }

  // Unknown structural shape — fall back to null and let the caller surface a
  // generic error rather than silently dropping the issue.
  return null
}

/**
 * Half-step + range check for `ai:rating`. Accepts a number or numeric string
 * (`"4.5"` is normalized to `4.5`); rejects out-of-range or non-half-step values.
 * Range check fires BEFORE the half-step check so a value like `6` produces
 * `rating_out_of_range` (the more actionable code) rather than `rating_off_step`.
 */
function validateRating(rawValue: unknown, basePath: string): ValidationIssue[] {
  const value = coerceRating(rawValue)
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return [
      {
        code: 'rating_invalid_type',
        message: `${basePath} must be a number (received ${typeof rawValue})`,
        path: basePath,
        retriable: true,
      },
    ]
  }

  if (value < RATING_MIN || value > RATING_MAX) {
    return [
      {
        code: 'rating_out_of_range',
        message: `${basePath} (${value}) must be in [${RATING_MIN}, ${RATING_MAX}]`,
        path: basePath,
        retriable: true,
      },
    ]
  }

  if (Math.round(value * 2) !== value * 2) {
    return [
      {
        code: 'rating_off_step',
        message: `${basePath} (${value}) must be a half-step value (0, 0.5, 1.0, …, 5.0)`,
        path: basePath,
        retriable: true,
      },
    ]
  }

  return []
}

/**
 * AI-specific rules over a validated `metadata_list`:
 *   - `ai:rating` items must carry a valid half-step number in [0, 5]
 *   - `ai:rating_reasoning` items must be non-empty strings
 *   - If any `ai:rating` is present, at least one `ai:rating_reasoning` must accompany it
 *
 * Other keys pass through. `ai:engine` / `ai:skill_version` values are NOT
 * validated here — postprocess rewrites both, and validating values would
 * force redundant retries.
 */
function validateAiRules(metadataList: Array<Record<string, unknown>>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  let hasRating = false
  let hasReasoning = false
  let firstRatingIndex = -1

  for (const [i, item] of metadataList.entries()) {
    if (AI_RATING_KEY in item) {
      hasRating = true
      if (firstRatingIndex === -1) firstRatingIndex = i
      issues.push(...validateRating(item[AI_RATING_KEY], `metadata_list[${i}].${AI_RATING_KEY}`))
    }

    if (AI_RATING_REASONING_KEY in item) {
      const reasoning = item[AI_RATING_REASONING_KEY]
      if (typeof reasoning !== 'string' || reasoning.trim() === '') {
        issues.push({
          code: 'reasoning_invalid_type',
          message: `metadata_list[${i}].${AI_RATING_REASONING_KEY} must be a non-empty string`,
          path: `metadata_list[${i}].${AI_RATING_REASONING_KEY}`,
          retriable: true,
        })
      } else {
        hasReasoning = true
      }
    }
  }

  if (hasRating && !hasReasoning) {
    issues.push({
      code: 'missing_reasoning',
      message: `${AI_RATING_KEY} is present but ${AI_RATING_REASONING_KEY} is missing`,
      path: `metadata_list[${firstRatingIndex}].${AI_RATING_REASONING_KEY}`,
      retriable: true,
    })
  }

  return issues
}

/**
 * Validates a raw YAML string against the .eivu.yml schema.
 *
 * Order of checks (cheapest first; later checks assume earlier ones passed):
 *   1. Sanitize values that would break the YAML parser (` #`, `: `, etc.)
 *   2. `YAML.parse` — any failure → single `yaml_syntax_error` issue
 *   3. Zod structural check — `name`, `metadata_list`, item-is-mapping
 *   4. AI rule check — `ai:rating` half-step + range, reasoning paired with rating
 *
 * On success, returns the sanitized YAML so callers don't re-run the pre-pass.
 * On failure, returns every issue detected at the failing layer plus the
 * original raw YAML so the caller can save it for debugging.
 */
export function validateEivuYaml(yaml: string): ValidationResult {
  // Sanitize before parsing — the AI sometimes forgets to quote values containing
  // special YAML characters (e.g. `collects: Batman #1-5` where `#1-5` becomes a comment).
  const sanitized = sanitizeYamlValues(yaml)

  let parsed: unknown
  try {
    parsed = YAML.parse(sanitized)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      errors: [
        {
          code: 'yaml_syntax_error',
          message: `Invalid YAML: ${message}`,
          path: '',
          retriable: true,
        },
      ],
      rawYaml: yaml,
    }
  }

  // YAML that parses to a non-mapping (null, string, array) can't have name/metadata_list.
  // Surface both missing-key codes directly so the caller doesn't see a single noisy
  // "expected object" message from zod.
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      errors: [
        {
          code: 'missing_name',
          message: 'Missing required top-level key: name',
          path: 'name',
          retriable: true,
        },
        {
          code: 'missing_metadata_list',
          message: 'Missing required top-level key: metadata_list',
          path: 'metadata_list',
          retriable: true,
        },
      ],
      rawYaml: yaml,
    }
  }

  // Pre-check missing top-level keys: zod's `invalid_type` issues can't
  // distinguish "key undefined" from "wrong type" without parsing the message,
  // and the two cases want different codes (missing_* vs *_invalid_type).
  const parsedObj = parsed as Record<string, unknown>
  const missingKeyIssues: ValidationIssue[] = []
  if (!('name' in parsedObj)) {
    missingKeyIssues.push({
      code: 'missing_name',
      message: 'Missing required top-level key: name',
      path: 'name',
      retriable: true,
    })
  }

  if (!('metadata_list' in parsedObj)) {
    missingKeyIssues.push({
      code: 'missing_metadata_list',
      message: 'Missing required top-level key: metadata_list',
      path: 'metadata_list',
      retriable: true,
    })
  }

  if (missingKeyIssues.length > 0) {
    return {errors: missingKeyIssues, rawYaml: yaml}
  }

  const structural = structuralSchema.safeParse(parsed)
  if (!structural.success) {
    const issues = structural.error.issues
      .map((i) => zodIssueToValidationIssue(i))
      .filter((i): i is ValidationIssue => i !== null)
    if (issues.length === 0) {
      // Defensive: every zod issue mapped to null. Surface a generic syntax-level
      // error so the caller never gets an empty errors[] when validation failed.
      return {
        errors: [
          {
            code: 'yaml_syntax_error',
            message: 'YAML failed structural validation but no codes were emitted',
            path: '',
            retriable: true,
          },
        ],
        rawYaml: yaml,
      }
    }

    return {errors: issues, rawYaml: yaml}
  }

  const aiIssues = validateAiRules(structural.data.metadata_list)
  if (aiIssues.length > 0) {
    return {errors: aiIssues, rawYaml: yaml}
  }

  return {sanitizedYaml: sanitized}
}

/** Joins issue messages into the single-string error field used by failure.csv + AgentResult.error. */
export function summarizeIssues(issues: ValidationIssue[]): string {
  return issues.map((i) => i.message).join('; ')
}
