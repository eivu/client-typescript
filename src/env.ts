/**
 * Environment variable validation and access.
 * Ensures all required environment variables are present before use.
 */

/** Validated EIVU environment variables (all required and non-empty). */
interface ValidatedEnv {
  EIVU_ACCESS_KEY_ID: string
  EIVU_BUCKET_NAME: string
  EIVU_BUCKET_UUID: string
  EIVU_ENDPOINT: string
  EIVU_REGION: string
  EIVU_SECRET_ACCESS_KEY: string
  EIVU_UPLOAD_SERVER_HOST: string
  EIVU_USER_TOKEN: string
}

let validatedEnv: null | ValidatedEnv = null

/**
 * Validates that all required environment variables are present
 * @throws Error if any required environment variable is missing
 */
function validateEnv(): ValidatedEnv {
  const requiredVars: Array<keyof ValidatedEnv> = [
    'EIVU_ACCESS_KEY_ID',
    'EIVU_BUCKET_NAME',
    'EIVU_BUCKET_UUID',
    'EIVU_ENDPOINT',
    'EIVU_REGION',
    'EIVU_SECRET_ACCESS_KEY',
    'EIVU_UPLOAD_SERVER_HOST',
    'EIVU_USER_TOKEN',
  ]

  const missing: string[] = []

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Please ensure all required EIVU environment variables are set.',
    )
  }

  return {
    EIVU_ACCESS_KEY_ID: process.env.EIVU_ACCESS_KEY_ID!,
    EIVU_BUCKET_NAME: process.env.EIVU_BUCKET_NAME!,
    EIVU_BUCKET_UUID: process.env.EIVU_BUCKET_UUID!,
    EIVU_ENDPOINT: process.env.EIVU_ENDPOINT!,
    EIVU_REGION: process.env.EIVU_REGION!,
    EIVU_SECRET_ACCESS_KEY: process.env.EIVU_SECRET_ACCESS_KEY!,
    EIVU_UPLOAD_SERVER_HOST: process.env.EIVU_UPLOAD_SERVER_HOST!,
    EIVU_USER_TOKEN: process.env.EIVU_USER_TOKEN!,
  }
}

/**
 * Gets validated environment variables
 * Validates on first call and caches the result
 * @throws Error if any required environment variable is missing
 */
export function getEnv(): ValidatedEnv {
  if (!validatedEnv) {
    validatedEnv = validateEnv()
  }

  return validatedEnv
}

/**
 * Resets the cached environment variables (useful for testing)
 */
export function resetEnv(): void {
  validatedEnv = null
}
