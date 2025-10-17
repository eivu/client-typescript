import pino from 'pino'
// import pretty from 'pino-pretty'

// const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined

const config =
  process.env.NODE_ENV === 'production'
    ? {}
    : {
        transport: {
          options: {sync: true}, // Forces synchronous pretty printing
          target: 'pino-pretty',
        },
      }

export default pino(config)
// // In test environment, create a logger that uses console.log for synchronous output
// // In production, use normal pino logger
// const createLogger = () => {
//   if (isTestEnvironment) {
//     // Mock logger that uses console.log for immediate synchronous output
//     return {
//       debug: (msg: string) => console.debug(msg),
//       error: (msg: string) => console.error(msg),
//       fatal: (msg: string) => console.error(msg),
//       info: (msg: string) => console.log(msg),
//       trace: (msg: string) => console.log(msg),
//       warn: (msg: string) => console.warn(msg),
//     } as pino.Logger
//   }

//   return pino({})
// }

// export default createLogger()
