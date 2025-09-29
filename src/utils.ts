import mime from 'mime-types'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'

/**
 * Generate the MD5 hash of a file's contents asynchronously using streams.
 * @param path_to_file - The path to the file to hash
 * @returns Promise that resolves to the MD5 hash in hex digest format
 */
export async function generateMd5(pathToFile: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(pathToFile)) {
      reject(new Error(`File not found: ${pathToFile}`))
    }

    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(pathToFile)
    stream.on('error', (err) => reject(err))
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex').toUpperCase()))
  })
}

export const detectMime = (pathToFile: string): false | {mediatype: string; subtype: string; type: string} => {
  const type = mimeLookup(pathToFile)

  if (!type) return false

  const [mediatype, subtype] = type.split('/')

  return {mediatype, subtype, type}
}

const mimeLookup = (pathToFile: string): string | false => {
  if (pathToFile.endsWith('.m4a')) return 'audio/mpeg'
  if (pathToFile.endsWith('.mp3')) return 'audio/mpeg'
  if (pathToFile.endsWith('.a52')) return 'application/x-atari-5200-rom'
  if (pathToFile.endsWith('.j64') || pathToFile.endsWith('.jag')) return 'application/x-atari-jaguar-rom'
  if (pathToFile.endsWith('.bsv')) return 'application/x-nes-rom'
  if (pathToFile.endsWith('.col')) return 'application/x-colecovision-rom'

  return mime.lookup(pathToFile) || false
}
