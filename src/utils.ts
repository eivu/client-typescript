import axios from 'axios'
import mime from 'mime-types'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import path from 'node:path'

import {pruneMetadata} from './metadata-extraction'
/**
 * Generate the MD5 hash of a file's contents asynchronously using streams.
 * @param pathToFile - The path to the file to hash
 * @returns Promise that resolves to the MD5 hash in hex digest format
 */
export async function generateMd5(pathToFile: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(pathToFile)) {
      reject(new Error(`File not found: ${pathToFile}`))
      return
    }

    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(pathToFile)
    stream.on('error', (err) => reject(err))
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex').toUpperCase()))
  })
}

/**
 * Checks if a file is available online by sending a HEAD request
 * Optionally verifies that the remote file size matches the local file size
 * @param uri - The URL of the remote file to check
 * @param localFilesize - Optional local file size to compare against remote content-length header
 * @returns True if the file is online and file sizes match (if provided), false otherwise
 */
export const isOnline = async (uri: null | string | undefined, localFilesize?: number): Promise<boolean> => {
  if (!uri) return false

  try {
    const response = await axios.head(uri)
    const headerOk = response.status === 200
    let filesizeOk = true
    if (localFilesize !== undefined) {
      const remoteFilesizeHeader = response.headers['content-length']
      const remoteFilesize = remoteFilesizeHeader ? Number.parseInt(remoteFilesizeHeader, 10) : Number.NaN
      filesizeOk = !Number.isNaN(remoteFilesize) && remoteFilesize === localFilesize
    }

    return headerOk && filesizeOk
  } catch (error) {
    console.warn('USE PINO: https://www.npmjs.com/package/pino')
    console.warn(`isOnline check failed for ${uri}: ${(error as Error).message}`)
    // If the request fails, treat as not online
    return false
  }
}

/**
 * Detects the MIME type of a file based on its extension
 * @param pathToFile - The path to the file
 * @returns An object containing the mediatype, subtype, and full type string
 */
export const detectMime = (pathToFile: string): {mediatype: string; subtype: string; type: string} => {
  const type = mimeLookup(pathToFile) || 'unknown/unknown'
  const [mediatype, subtype] = type.split('/')

  return {mediatype, subtype, type}
}

/**
 * Converts an MD5 hash into a folder path structure
 * Example: "ABC123" -> "AB/C1/23"
 * @param md5 - The MD5 hash string
 * @returns The MD5 hash formatted as a folder path
 */
export const md5AsFolders = (md5: string): string => {
  const upper = md5.toUpperCase() // Convert to uppercase
  const parts = upper.match(/.{2}|.+/g) // Match pairs of 2 characters, and if odd-length, the last leftover chunk
  return parts ? parts.join('/') : '' // Join with "/"
}

/**
 * Performs MIME type lookup with custom mappings for specific file extensions
 * @param pathToFile - The path to the file
 * @returns The MIME type string, or false if not found
 */
const mimeLookup = (pathToFile: string): false | string => {
  if (pathToFile.endsWith('.m4a')) return 'audio/mpeg'
  if (pathToFile.endsWith('.mp3')) return 'audio/mpeg'
  if (pathToFile.endsWith('.a52')) return 'application/x-atari-5200-rom'
  if (pathToFile.endsWith('.j64') || pathToFile.endsWith('.jag')) return 'application/x-atari-jaguar-rom'
  if (pathToFile.endsWith('.bsv')) return 'application/x-nes-rom'
  if (pathToFile.endsWith('.col')) return 'application/x-colecovision-rom'

  return mime.lookup(pathToFile) || false
}

/**
 * Returns a cleansed and sanitized asset name from a file path
 * Removes metadata tags and sanitizes the filename for storage
 * @param name - The original file name or path
 * @returns The cleansed asset name
 */
export function cleansedAssetName(name: string): string {
  console.log('NEED TO IMPLEMENT: func(coverart logic)')
  return sanitize(name)
}

/**
 * Sanitizes a filename by removing metadata, special characters, and normalizing the result
 * @param name - The filename to sanitize
 * @returns The sanitized filename safe for storage
 */
function sanitize(name: string): string {
  name = pruneMetadata(name)
  name = name.replaceAll('\\', '/')
  name = path.basename(name)
  name = name.replaceAll(/[^a-zA-Z0-9.\-+_]/g, '_')
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
