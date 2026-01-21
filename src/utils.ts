import {COVERART_AUDIO_PREFIX, COVERART_COMIC_PREFIX, COVERART_PREFIX} from '@src/constants'
import {pruneMetadata} from '@src/metadata-extraction'
import axios from 'axios'
import mime from 'mime-types'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import path from 'node:path'

/**
 * Validates a file path for existence and security issues
 * @param pathToFile - The path to validate
 * @param options - Validation options
 * @param options.checkExists - Whether to check if the file exists (default: true)
 * @param options.allowDirectories - Whether to allow directories (default: false)
 * @returns The trimmed and validated file path
 * @throws Error if the path is invalid, contains path traversal, or doesn't exist
 */
export function validateFilePath(
  pathToFile: string,
  options: {allowDirectories?: boolean; checkExists?: boolean} = {},
): string {
  const {allowDirectories = false, checkExists = true} = options

  // Check for null, undefined, or empty string
  if (!pathToFile || typeof pathToFile !== 'string') {
    throw new Error('File path must be a non-empty string')
  }

  // Trim whitespace
  const trimmedPath = pathToFile.trim()
  if (trimmedPath.length === 0) {
    throw new Error('File path must be a non-empty string')
  }

  // Resolve to absolute path to check for path traversal
  const resolvedPath = path.resolve(trimmedPath)

  // Check for path traversal by checking if any path segment is exactly ".."
  // This prevents attacks like "../../../etc/passwd" but allows legitimate filenames with ".." in them
  // Check the original path (before normalization) to catch traversal attempts that would be resolved away
  // IMPORTANT: Split by both / and \ using regex /[/\\]/ instead of path.sep because:
  // - Node.js accepts both / and \ as path separators on Windows
  // - Using path.sep (which is \ on Windows) would miss path traversal in absolute paths like "C:/Users/../file"
  // - The regex ensures we detect ".." segments regardless of which separator is used
  const pathSegments = trimmedPath.split(/[/\\]/)
  if (pathSegments.includes('..')) {
    throw new Error(`Invalid file path: path traversal detected in "${pathToFile}"`)
  }

  // Additional check: ensure the resolved path doesn't escape the current working directory
  // unless it's an absolute path provided by the user
  if (!path.isAbsolute(trimmedPath)) {
    const cwd = process.cwd()
    const cwdWithSep = cwd + path.sep
    // Check that the path is actually inside cwd, not just a sibling directory with a prefix match
    // For example, if cwd is /home/user/project, we should reject /home/user/project-evil/file.txt
    if (resolvedPath !== cwd && !resolvedPath.startsWith(cwdWithSep)) {
      throw new Error(`Invalid file path: path escapes working directory "${pathToFile}"`)
    }
  }

  // Check if file exists
  if (checkExists) {
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${pathToFile}`)
    }

    // Check if it's a directory when not allowed
    if (!allowDirectories) {
      const stats = fs.statSync(resolvedPath)
      if (stats.isDirectory()) {
        throw new Error(`Expected a file but got a directory: ${pathToFile}`)
      }
    }
  }

  // Return the trimmed path so callers can use it for file operations
  return trimmedPath
}

/**
 * Validates a directory path for existence and security issues
 * @param pathToFolder - The path to validate
 * @param options - Validation options
 * @param options.checkExists - Whether to check if the directory exists (default: true)
 * @returns The trimmed and validated directory path
 * @throws Error if the path is invalid, contains path traversal, or doesn't exist
 */
export function validateDirectoryPath(
  pathToFolder: string,
  options: {checkExists?: boolean} = {},
): string {
  const {checkExists = true} = options

  // Check for null, undefined, or empty string
  if (!pathToFolder || typeof pathToFolder !== 'string') {
    throw new Error('Directory path must be a non-empty string')
  }

  // Trim whitespace
  const trimmedPath = pathToFolder.trim()
  if (trimmedPath.length === 0) {
    throw new Error('Directory path must be a non-empty string')
  }

  // Resolve to absolute path to check for path traversal
  const resolvedPath = path.resolve(trimmedPath)

  // Check for path traversal by checking if any path segment is exactly ".."
  // This prevents attacks like "../../../etc" but allows legitimate directory names with ".." in them
  // Check the original path (before normalization) to catch traversal attempts that would be resolved away
  // IMPORTANT: Split by both / and \ using regex /[/\\]/ instead of path.sep because:
  // - Node.js accepts both / and \ as path separators on Windows
  // - Using path.sep (which is \ on Windows) would miss path traversal in absolute paths like "C:/Users/../dir"
  // - The regex ensures we detect ".." segments regardless of which separator is used
  const pathSegments = trimmedPath.split(/[/\\]/)
  if (pathSegments.includes('..')) {
    throw new Error(`Invalid directory path: path traversal detected in "${pathToFolder}"`)
  }

  // Additional check: ensure the resolved path doesn't escape the current working directory
  // unless it's an absolute path provided by the user
  if (!path.isAbsolute(trimmedPath)) {
    const cwd = process.cwd()
    const cwdWithSep = cwd + path.sep
    // Check that the path is actually inside cwd, not just a sibling directory with a prefix match
    // For example, if cwd is /home/user/project, we should reject /home/user/project-evil/
    if (resolvedPath !== cwd && !resolvedPath.startsWith(cwdWithSep)) {
      throw new Error(`Invalid directory path: path escapes working directory "${pathToFolder}"`)
    }
  }

  // Check if directory exists
  if (checkExists) {
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Directory not found: ${pathToFolder}`)
    }

    const stats = fs.statSync(resolvedPath)
    if (!stats.isDirectory()) {
      throw new Error(`Expected a directory but got a file: ${pathToFolder}`)
    }
  }

  // Return the trimmed path so callers can use it for directory operations
  return trimmedPath
}

/**
 * Generate the MD5 hash of a file's contents asynchronously using streams.
 * @param pathToFile - The path to the file to hash
 * @returns Promise that resolves to the MD5 hash in hex digest format
 */
export async function generateMd5(pathToFile: string): Promise<string> {
  const trimmedPath = validateFilePath(pathToFile)
  
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(trimmedPath)
    stream.on('error', (err) => reject(err))
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex').toUpperCase()))
  })
}

/**
 * Result of checking if a file is online
 */
export type IsOnlineResult = {
  isOnline: boolean
  remoteFilesize: null | number
}

/**
 * Checks if a file is available online by sending a HEAD request.
 * Optionally verifies that the remote file size matches the local file size.
 * @param uri - The URL of the remote file to check. If null or undefined, the check is skipped and the function returns {isOnline: false, remoteFilesize: null}.
 * @param localFilesize - Optional local file size to compare against the remote Content-Length header.
 * @returns An object with isOnline boolean and the remote filesize (or null if unavailable). isOnline is true if a non-null URL is provided, the remote file is online, and file sizes match (if provided); false otherwise.
 */
export const isOnline = async (uri: null | string | undefined, localFilesize?: number): Promise<IsOnlineResult> => {
  if (!uri) return {isOnline: false, remoteFilesize: null}

  try {
    const response = await axios.head(uri)
    const headerOk = response.status === 200
    const remoteFilesizeHeader = response.headers['content-length']
    const remoteFilesize = remoteFilesizeHeader ? Number.parseInt(remoteFilesizeHeader, 10) : Number.NaN
    const actualRemoteFilesize = Number.isNaN(remoteFilesize) ? null : remoteFilesize

    let filesizeOk = true
    if (localFilesize !== undefined) {
      filesizeOk = actualRemoteFilesize !== null && actualRemoteFilesize === localFilesize
    }

    return {isOnline: headerOk && filesizeOk, remoteFilesize: actualRemoteFilesize}
  } catch (error) {
    console.warn('USE PINO: https://www.npmjs.com/package/pino')
    console.warn(`isOnline check failed for ${uri}: ${(error as Error).message}`)
    // If the request fails, treat as not online
    return {isOnline: false, remoteFilesize: null}
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
 * Provides custom MIME types for certain file extensions before falling back to standard mime-types lookup
 * @param pathToFile - The path to the file
 * @returns The MIME type string, or false if not found
 * @private
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
  const basename = path.basename(name)
  const extension = path.extname(basename) // Returns '.webp' (includes the dot)
  const nameWithoutExt = extension ? basename.slice(0, -extension.length) : basename

  if (nameWithoutExt.startsWith(COVERART_AUDIO_PREFIX)) return `${COVERART_AUDIO_PREFIX}${extension}`
  if (nameWithoutExt.startsWith(COVERART_COMIC_PREFIX)) return `${COVERART_COMIC_PREFIX}${extension}`
  if (nameWithoutExt.startsWith(COVERART_PREFIX)) return `${COVERART_PREFIX}${extension}`

  return sanitize(name)
}

/**
 * Sanitizes a filename by removing metadata, special characters, and normalizing the result
 * Removes metadata tags, normalizes path separators, removes special characters, and ensures a valid filename
 * @param name - The filename to sanitize
 * @returns The sanitized filename safe for storage
 * @private
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
