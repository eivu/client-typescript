import YAML from 'yaml'

/** Allowed rating values: 0.5 increments from 0.5 to 5.0 (per skill v7.16.4 §E). */
const ALLOWED_RATINGS = new Set([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5])

/** Result of trying to extract a rating from a model response. */
export type RatingExtraction = {
  errorMessage: null | string
  rating: null | number
  reasoning: null | string
}

/**
 * Pulls `ai:rating` and `ai:rating_reasoning` from raw YAML text.
 *
 * The model's output may include preamble prose before the YAML (the existing
 * `extractYamlFromResponse` handles that pattern); for the spike we use the
 * simpler `yaml.parse(...)` on the raw text and fall back to a regex if parsing
 * fails. We deliberately avoid the validation pipeline here — we want to
 * measure rating consistency even on outputs that wouldn't pass full schema
 * validation, since that's a separate failure mode the harness tracks.
 *
 * Returns `{rating: null}` only when the rating cannot be parsed; the harness
 * decides whether that's `parse_failure` vs. `validation_failure` based on
 * additional context.
 */
export function extractRatingFromYaml(rawText: string): RatingExtraction {
  // Try parsing the whole text first.
  const parsed = tryParseYaml(rawText)
  if (parsed) {
    const found = findRatingInParsed(parsed)
    if (found.rating !== null) return found
  }

  // Fall back to regex scan — handles cases where the AI emitted prose before YAML.
  return extractRatingByRegex(rawText)
}

/**
 * Pulls `rating` and `rating_reasoning` from a structured-output tool-use input
 * (variant 5). The tool's JSON schema constrains rating to the 0.5-step enum,
 * so we just validate and pass through.
 */
export function extractRatingFromToolInput(input: Record<string, unknown>): RatingExtraction {
  const ratingRaw = input.rating
  const reasoning = typeof input.rating_reasoning === 'string' ? input.rating_reasoning : null

  if (typeof ratingRaw !== 'number') {
    return {errorMessage: 'tool input missing numeric `rating` field', rating: null, reasoning}
  }

  if (!ALLOWED_RATINGS.has(ratingRaw)) {
    return {errorMessage: `rating ${ratingRaw} not in allowed 0.5-step set`, rating: null, reasoning}
  }

  return {errorMessage: null, rating: ratingRaw, reasoning}
}

/** Computes the median of an array of ratings; null entries are filtered out. */
export function median(samples: Array<null | number>): null | number {
  const valid = samples.filter((s): s is number => typeof s === 'number')
  if (valid.length === 0) return null

  const sorted = [...valid].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

function extractRatingByRegex(text: string): RatingExtraction {
  // Match lines like `- ai:rating: 4.0` or `ai:rating: 3.5`
  const ratingMatch = text.match(/^[\s-]*ai:rating:\s*([0-5](?:\.[05])?)\s*$/m)
  if (!ratingMatch) {
    return {errorMessage: 'no ai:rating field found in output', rating: null, reasoning: null}
  }

  const rating = Number.parseFloat(ratingMatch[1])
  if (!ALLOWED_RATINGS.has(rating)) {
    return {errorMessage: `parsed rating ${rating} not in allowed 0.5-step set`, rating: null, reasoning: null}
  }

  const reasoningMatch = text.match(/ai:rating_reasoning:\s*["']?(.+?)["']?\s*$/m)
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : null

  return {errorMessage: null, rating, reasoning}
}

function findRatingInParsed(parsed: unknown): RatingExtraction {
  if (!parsed || typeof parsed !== 'object') {
    return {errorMessage: 'YAML parse did not return an object', rating: null, reasoning: null}
  }

  const root = parsed as {metadata_list?: unknown}
  const list = root.metadata_list
  if (!Array.isArray(list)) {
    return {errorMessage: 'metadata_list is not an array', rating: null, reasoning: null}
  }

  let rating: null | number = null
  let reasoning: null | string = null

  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    if ('ai:rating' in obj && typeof obj['ai:rating'] === 'number') {
      rating = obj['ai:rating'] as number
    }

    if ('ai:rating_reasoning' in obj && typeof obj['ai:rating_reasoning'] === 'string') {
      reasoning = obj['ai:rating_reasoning'] as string
    }
  }

  if (rating === null) {
    return {errorMessage: 'no ai:rating entry in metadata_list', rating: null, reasoning}
  }

  if (!ALLOWED_RATINGS.has(rating)) {
    return {errorMessage: `parsed rating ${rating} not in allowed 0.5-step set`, rating: null, reasoning}
  }

  return {errorMessage: null, rating, reasoning}
}

function tryParseYaml(text: string): unknown {
  try {
    return YAML.parse(text)
  } catch {
    return null
  }
}
