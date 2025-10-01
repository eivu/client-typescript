/* eslint-disable camelcase */

import api from '@src/services/api.config'
import {type AxiosError} from 'axios'

import {CloudFileState, type CloudFileType} from './types/cloud-file-type'
import {detectMime, generateMd5} from './utils'

export class CloudFile {
  attr: CloudFileType
  localPathToFile: null | string

  constructor(attributes: CloudFileType, localPathToFile: null | string = null) {
    this.attr = attributes
    this.inferStateHistory()
    this.localPathToFile = localPathToFile
  }

  static async fetch(md5: string): Promise<CloudFile> {
    const {data} = await api.get(`/cloud_files/${md5}`)
    return new CloudFile(data)
  }

  static async fetchOrReserveBy(pathToFile: string, secured = false, nsfw = false): Promise<CloudFile> {
    try {
      return await CloudFile.reserve(pathToFile, secured, nsfw)
    } catch (error) {
      // a file already exists with the same MD5 hash
      if ((error as AxiosError).response?.status === 422) {
        const md5 = await generateMd5(pathToFile)
        const cloudFile = await CloudFile.fetch(md5)
        cloudFile.localPathToFile = pathToFile
        return cloudFile
      }

      throw error
    }
  }

  static async reserve(pathToFile: string, secured = false, nsfw = false): Promise<CloudFile> {
    const md5 = await generateMd5(pathToFile)
    const payload = {nsfw, secured}
    const {data: responseData} = await api.post(`/cloud_files/${md5}/reserve`, payload)
    const data: CloudFileType = responseData
    return new CloudFile(data, pathToFile)
  }

  identifyContentType(): void {
    if (!this.localPathToFile) {
      throw new Error('CloudFile#identifyContentType requires this.localPathToFile to be set')
    }

    const {type} = detectMime(this.localPathToFile)
    this.attr.content_type = type
  }

  async transfer(pathToFile: string): Promise<CloudFile> {
    const mime = detectMime(pathToFile)
    if (!mime) throw new Error(`Could not detect MIME type for file: ${pathToFile}`)

    if (this.attr.content_type !== mime.type) {
      throw new Error(`MIME type mismatch. Expected ${this.attr.content_type}, got ${mime.type}`)
    }

    return this
    // const md5 = await generateMd5(pathToFile)
  }

  private inferStateHistory(): void {
    switch (this.attr.state) {
      case CloudFileState.COMPLETED: {
        this.attr.state_history = [CloudFileState.RESERVED, CloudFileState.TRANSFERRED, CloudFileState.COMPLETED]
        break
      }

      case CloudFileState.RESERVED: {
        this.attr.state_history = [CloudFileState.RESERVED]
        break
      }

      case CloudFileState.TRANSFERRED: {
        this.attr.state_history = [CloudFileState.RESERVED, CloudFileState.TRANSFERRED]
        break
      }

      default: {
        this.attr.state_history = []
      }
    }
  }
}
