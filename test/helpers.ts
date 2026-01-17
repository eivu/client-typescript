import path from 'node:path'

import {TEMP_FOLDER_ROOT} from '../src/constants'

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
    for (const field of excludeFields) {
      if (field.includes(':')) {
        // Field is a metadata key - filter it from metadata_list
        // eslint-disable-next-line dot-notation
        if (actualBody['metadata_list'] && Array.isArray(actualBody['metadata_list'])) {
          // eslint-disable-next-line dot-notation
          actualBody['metadata_list'] = actualBody['metadata_list'].filter((item: unknown) => {
            const key = Object.keys(item as Record<string, unknown>)[0]

            return key !== field && key !== 'original_local_path_to_file'
          })
        }

        // eslint-disable-next-line dot-notation
        if (expectedBody['metadata_list'] && Array.isArray(expectedBody['metadata_list'])) {
          // eslint-disable-next-line dot-notation
          expectedBody['metadata_list'] = expectedBody['metadata_list'].filter((item: unknown) => {
            const key = Object.keys(item as Record<string, unknown>)[0]

            return key !== field && key !== 'original_local_path_to_file'
          })
        }
      } else {
        // Check if the field value starts with the temp directory path
        // Normalize paths for cross-platform compatibility (handles / vs \ separators)
        // Check both expected and actual body values to handle dynamic temp paths
        const expectedValue = expectedBody?.[field]
        const actualValue = actualBody?.[field]

        if (typeof expectedValue === 'string' && typeof actualValue === 'string') {
          const normalizedExpected = path.normalize(expectedValue)
          const normalizedActual = path.normalize(actualValue)

          // Remove the field if either value is in the temp directory
          if (normalizedExpected.startsWith(TEMP_FOLDER_ROOT) || normalizedActual.startsWith(TEMP_FOLDER_ROOT)) {
            delete expectedBody[field]
            delete actualBody[field]
          }
        } else if (typeof expectedValue === 'string') {
          const normalizedValue = path.normalize(expectedValue)
          if (normalizedValue.startsWith(TEMP_FOLDER_ROOT)) {
            delete expectedBody[field]
            delete actualBody[field]
          }
        } else if (typeof actualValue === 'string') {
          const normalizedValue = path.normalize(actualValue)
          if (normalizedValue.startsWith(TEMP_FOLDER_ROOT)) {
            delete expectedBody[field]
            delete actualBody[field]
          }
        }
      }
    }

    // Also filter original_local_path_to_file from metadata_list if either body has a temp path
    // This handles cases where cover art is extracted to temp files
    let hasTempPath = false

    // eslint-disable-next-line dot-notation
    if (actualBody['metadata_list'] && Array.isArray(actualBody['metadata_list'])) {
      // eslint-disable-next-line dot-notation
      hasTempPath = actualBody['metadata_list'].some((item: unknown) => {
        const key = Object.keys(item as Record<string, unknown>)[0]
        const value = Object.values(item as Record<string, unknown>)[0]

        return key === 'original_local_path_to_file' && typeof value === 'string' && path.normalize(value).startsWith(TEMP_FOLDER_ROOT)
      })
    }

    // If either body has a temp path, filter original_local_path_to_file from both
    if (hasTempPath) {
      // eslint-disable-next-line dot-notation
      if (actualBody['metadata_list'] && Array.isArray(actualBody['metadata_list'])) {
        // eslint-disable-next-line dot-notation
        actualBody['metadata_list'] = actualBody['metadata_list'].filter((item: unknown) => {
          const key = Object.keys(item as Record<string, unknown>)[0]

          return key !== 'original_local_path_to_file'
        })
      }

      // eslint-disable-next-line dot-notation
      if (expectedBody['metadata_list'] && Array.isArray(expectedBody['metadata_list'])) {
        // eslint-disable-next-line dot-notation
        expectedBody['metadata_list'] = expectedBody['metadata_list'].filter((item: unknown) => {
          const key = Object.keys(item as Record<string, unknown>)[0]

          return key !== 'original_local_path_to_file'
        })
      }
    }

    return JSON.stringify(actualBody) === JSON.stringify(expectedBody)
  }
}
