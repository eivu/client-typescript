import mime from 'mime-types'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import path from 'node:path'

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

const mimeLookup = (pathToFile: string): false | string => {
  if (pathToFile.endsWith('.m4a')) return 'audio/mpeg'
  if (pathToFile.endsWith('.mp3')) return 'audio/mpeg'
  if (pathToFile.endsWith('.a52')) return 'application/x-atari-5200-rom'
  if (pathToFile.endsWith('.j64') || pathToFile.endsWith('.jag')) return 'application/x-atari-jaguar-rom'
  if (pathToFile.endsWith('.bsv')) return 'application/x-nes-rom'
  if (pathToFile.endsWith('.col')) return 'application/x-colecovision-rom'

  return mime.lookup(pathToFile) || false
}

export function cleansedAssetName(name: string): string {
  console.log('NEED TO IMPLEMENT: cleansedAssetName')
  console.log('NEED TO IMPLEMENT: func(coverart logic)')
  return sanitize(name)
}

function pruneMetadata(name: string): string {
  console.log('NEED TO IMPLEMENT: pruneMetadata')
  return name
}

function sanitize(name: string): string {
  name = pruneMetadata(name)
  name = name.replace(/\\/g, '/')
  name = path.basename(name)
  name = name.replace(/[^a-zA-Z0-9.\-+_]/g, '_')
  if (/^\.+$/.test(name)) {
    name = `_${name}`
  }

  // If name is empty, default to "unnamed"
  if (name.length === 0) {
    name = 'unnamed'
  }

  // Return as string (JS handles multibyte automatically)
  return name
}
