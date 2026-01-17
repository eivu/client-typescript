import pino from 'pino'

const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined

export type Logger = pino.Logger

// In test environment, use synchronous destination for immediate output
// In production, use default async destination
// In development, use pretty printing with sync transport
/**
 * Creates a configured Pino logger instance based on the environment
 * Uses synchronous logging in test environments, pretty printing in development, and standard JSON in production
 * @returns A configured Pino Logger instance
 * @private
 */
const createLogger = () => {
  if (isTestEnvironment) {
    // For tests, use synchronous destination to ensure output appears immediately and in order
    // The sync: true option in pino.destination makes all writes synchronous
    return pino(
      {
        transport: {
          options: {sync: true}, // Forces synchronous pretty printing
          target: 'pino-pretty',
        },
      },
      pino.destination({sync: true}), // Synchronous destination ensures no buffering
    )
  }

  if (process.env.NODE_ENV === 'production') {
    return pino({})
  }

  return pino({
    transport: {
      // options: {sync: true}, // Forces synchronous pretty printing
      target: 'pino-pretty',
    },
  })
}

export default createLogger()
