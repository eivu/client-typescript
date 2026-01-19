import path from 'node:path'

import {COVERART_PREFIX, TEMP_FOLDER_ROOT} from '../src/constants'

/**
 * Filters metadata_list array by removing items with the specified key.
 */
function filterMetadataListByKey(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
  keyToRemove: string,
): void {
  // eslint-disable-next-line dot-notation
  if (body['metadata_list'] && Array.isArray(body['metadata_list'])) {
    // eslint-disable-next-line dot-notation
    body['metadata_list'] = body['metadata_list'].filter((item: unknown) => {
      const key = Object.keys(item as Record<string, unknown>)[0]

      return key !== keyToRemove
    })
  }
}

/**
 * Checks if a string value is a temp path or contains coverart prefix.
 */
function isTempOrCoverartPath(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false
  }

  const normalized = path.normalize(value)

  return normalized.startsWith(TEMP_FOLDER_ROOT) || normalized.includes(COVERART_PREFIX)
}

/**
 * Removes a field from both bodies if it matches temp/coverart path patterns.
 */
function removeFieldIfTempPath(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expectedBody: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actualBody: any,
  field: string,
): void {
  const expectedValue = expectedBody?.[field]
  const actualValue = actualBody?.[field]

  const shouldRemove =
    isTempOrCoverartPath(expectedValue) || isTempOrCoverartPath(actualValue) || (!expectedValue && !actualValue)

  if (shouldRemove) {
    delete expectedBody[field]
    delete actualBody[field]
  }
}

/**
 * Checks if metadata_list contains original_local_path_to_file with temp or coverart paths.
 */
function hasTempOrCoverartPathInMetadata(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
): {hasCoverartPath: boolean; hasTempPath: boolean} {
  let hasTempPath = false
  let hasCoverartPath = false

  // eslint-disable-next-line dot-notation
  if (body['metadata_list'] && Array.isArray(body['metadata_list'])) {
    // eslint-disable-next-line dot-notation
    hasTempPath = body['metadata_list'].some((item: unknown) => {
      const key = Object.keys(item as Record<string, unknown>)[0]
      const value = Object.values(item as Record<string, unknown>)[0]

      return key === 'original_local_path_to_file' && typeof value === 'string' && path.normalize(value).startsWith(TEMP_FOLDER_ROOT)
    })
    // eslint-disable-next-line dot-notation
    hasCoverartPath = body['metadata_list'].some((item: unknown) => {
      const key = Object.keys(item as Record<string, unknown>)[0]
      const value = Object.values(item as Record<string, unknown>)[0]

      return key === 'original_local_path_to_file' && typeof value === 'string' && value.includes(COVERART_PREFIX)
    })
  }

  return {hasCoverartPath, hasTempPath}
}

/**
 * Processes exclude fields from expected and actual bodies.
 */
function processExcludeFields(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expectedBody: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actualBody: any,
  excludeFields: string[],
): void {
  for (const field of excludeFields) {
    if (field.includes(':')) {
      // Field is a metadata key - filter it from metadata_list
      filterMetadataListByKey(actualBody, field)
      filterMetadataListByKey(expectedBody, field)
      filterMetadataListByKey(actualBody, 'original_local_path_to_file')
      filterMetadataListByKey(expectedBody, 'original_local_path_to_file')
    } else if (field === 'original_local_path_to_file') {
      // Filter original_local_path_to_file from metadata_list
      filterMetadataListByKey(actualBody, 'original_local_path_to_file')
      filterMetadataListByKey(expectedBody, 'original_local_path_to_file')
    } else {
      removeFieldIfTempPath(expectedBody, actualBody, field)
    }
  }
}

/**
 * Filters out override: keys from metadata_list as a safeguard.
 */
function filterOverrideKeys(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
): void {
  // eslint-disable-next-line dot-notation
  if (body['metadata_list'] && Array.isArray(body['metadata_list'])) {
    // eslint-disable-next-line dot-notation
    body['metadata_list'] = body['metadata_list'].filter((item: unknown) => {
      const key = Object.keys(item as Record<string, unknown>)[0]

      return !key.startsWith('override:')
    })
  }
}

/**
 * Creates a body matcher function for nock that compares request bodies
 * while excluding dynamic fields (like temporary file paths).
 *
 * This is useful for testing API requests where some fields contain dynamic
 * values (e.g., timestamps, temporary file paths) that should be ignored
 * during comparison.
 *
 * @param expectedProfile - The expected data profile to match against
 * @param excludeFields - Array of field names to exclude from comparison
 * @returns A function that can be used as a nock body matcher
 *
 * @example
 * ```typescript
 * const req = nock(SERVER_HOST)
 *   .post('/endpoint', removeAttributeFromBodyTest(EXPECTED_DATA, ['path_to_file']))
 *   .reply(200, RESPONSE_DATA)
 * ```
 *
 * @example
 * ```typescript
 * // With custom exclude fields
 * const req = nock(SERVER_HOST)
 *   .post('/endpoint', removeAttributeFromBodyTest(EXPECTED_DATA, ['path_to_file', 'timestamp']))
 *   .reply(200, RESPONSE_DATA)
 * ```
 */
export function removeAttributeFromBodyTest(
  expectedProfile: Record<string, unknown>,
  excludeFields: string[],
): (body: unknown) => boolean {
  return (body: unknown): boolean => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expectedBody = {...expectedProfile} as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actualBody = {...(body as Record<string, unknown>)} as any

    // Remove dynamic fields from comparison
    processExcludeFields(expectedBody, actualBody, excludeFields)

    // Also filter original_local_path_to_file from metadata_list if either body has a temp path or coverart path
    // This handles cases where cover art is extracted to temp files or has coverart prefix
    const actualPathInfo = hasTempOrCoverartPathInMetadata(actualBody)
    const expectedPathInfo = hasTempOrCoverartPathInMetadata(expectedBody)

    if (actualPathInfo.hasTempPath || actualPathInfo.hasCoverartPath || expectedPathInfo.hasCoverartPath) {
      filterMetadataListByKey(actualBody, 'original_local_path_to_file')
      filterMetadataListByKey(expectedBody, 'original_local_path_to_file')
    }

    // Always filter out override:* keys from metadata_list (they should already be pruned, but this is a safeguard)
    filterOverrideKeys(actualBody)
    filterOverrideKeys(expectedBody)

    return JSON.stringify(actualBody) === JSON.stringify(expectedBody)
  }
}
