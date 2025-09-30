import {CloudFile} from './cloud-file.ts'
import {promises as fs} from 'node:fs'
import {generateMd5, cleansedAssetName} from './utils'

export class Client {
  status = {
    failure: {},
    success: {},
  }

  async upload(pathToFile: string): Promise<CloudFile> {
    if (await this.isEmptyFile(pathToFile)) {
      throw new Error(`Can not upload empty file: ${pathToFile}`)
    }
    const asset = cleansedAssetName(pathToFile)
    console.log(`Fetching/Reserving: ${asset}`)
  }

  private async isEmptyFile(pathToFile: string): Promise<boolean> {
    try {
      const stats = await fs.stat(pathToFile)
      return stats.size === 0
    } catch {
      return false
    }
  }
}
