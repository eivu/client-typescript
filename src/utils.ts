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
