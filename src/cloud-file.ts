import api from '@src/services/api.config'
import {CloudFileState, type CloudFileType} from './types/cloud-file-type'
import {generateMd5, detectMime} from './utils'

export class CloudFile {
  attr: CloudFileType

  constructor(attributes: CloudFileType) {
    this.attr = attributes
    this.inferStateHistory()
  }

  static async fetch(md5: string): Promise<CloudFile> {
    const response = await api.get(`/cloud_files/${md5}`)
    const data: CloudFileType = response.data
    return new CloudFile(data)
  }

  static async reserve(pathToFile: string, secured = false, nsfw = false): Promise<CloudFile> {
    const mime = detectMime(pathToFile)
    if (!mime) throw new Error(`Could not detect MIME type for file: ${pathToFile}`)

    const md5 = await generateMd5(pathToFile)
    const payload = {nsfw, secured}
    const response = await api.post(`/cloud_files/${md5}/reserve`, payload)
    const data: CloudFileType = {
      ...response.data,
      content_type: mime.type,
    }
    return new CloudFile(data)
  }

  private inferStateHistory(): void {
    switch (this.attr.state) {
      case CloudFileState.COMPLETED: {
        this.attr.state_history = [CloudFileState.RESERVED, CloudFileState.TRANSFERED, CloudFileState.COMPLETED]
        break
      }

      case CloudFileState.RESERVED: {
        this.attr.state_history = [CloudFileState.RESERVED]
        break
      }

      case CloudFileState.TRANSFERED: {
        this.attr.state_history = [CloudFileState.RESERVED, CloudFileState.TRANSFERED]
        break
      }

      default: {
        this.attr.state_history = []
      }
    }
  }
}
