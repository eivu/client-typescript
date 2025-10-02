/* eslint-disable camelcase */

import api from '@src/services/api.config'
import {type AxiosError} from 'axios'

import {CloudFileState, type CloudFileType} from './types/cloud-file-type'
import {detectMime, generateMd5} from './utils'
// import {file} from '@oclif/core/args'

export class CloudFile {
  attr: CloudFileType
  localPathToFile: null | string
  resourceType: null | string = null

  constructor(attributes: CloudFileType, localPathToFile: null | string = null) {
    this.attr = attributes
    this.inferStateHistory()
    this.localPathToFile = localPathToFile
  }

  static async fetch(md5: string): Promise<CloudFile> {
    const {data} = await api.get(`/cloud_files/${md5}`)
    return new CloudFile(data)
  }

  static async fetchOrReserveBy({
    nsfw = false,
    pathToFile,
    secured = false,
  }: {
    nsfw?: boolean
    pathToFile: string
    secured?: boolean
  }): Promise<CloudFile> {
    try {
      return await CloudFile.reserve({nsfw, pathToFile, secured})
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

  static async reserve({
    nsfw = false,
    pathToFile,
    secured = false,
  }: {
    nsfw?: boolean
    pathToFile: string
    secured?: boolean
  }): Promise<CloudFile> {
    const md5 = await generateMd5(pathToFile)
    const payload = {nsfw, secured}
    const {data: responseData} = await api.post(`/cloud_files/${md5}/reserve`, payload)
    const data: CloudFileType = responseData
    return new CloudFile(data, pathToFile)
  }

  completed(): boolean {
    return this.attr.state === CloudFileState.COMPLETED
  }

  identifyContentType(): void {
    if (!this.localPathToFile) {
      throw new Error('CloudFile#identifyContentType requires this.localPathToFile to be set')
    }

    const {mediatype, type} = detectMime(this.localPathToFile)
    this.resourceType = this.attr.peepy ? 'secured' : mediatype
    this.attr.content_type = type
  }

  reserved(): boolean {
    return this.attr.state === CloudFileState.RESERVED
  }

  async transfer({asset, filesize}: {asset: string; filesize: number}): Promise<CloudFile> {
    this.identifyContentType()

    if (!this.attr.content_type) {
      throw new Error('CloudFile#transfer requires this.contentType to be set')
    }

    this.attr.filesize = filesize
    const payload = {asset, content_type: this.attr.content_type, filesize}
    const {data} = await api.post(`/cloud_files/${this.attr.md5}/transfer`, payload)
    this.attr = data
    this.attr.state_history.push(CloudFileState.TRANSFERRED)
    return this
  }

  transfered(): boolean {
    return this.attr.state === CloudFileState.TRANSFERRED
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
