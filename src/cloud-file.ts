/* eslint-disable camelcase */

import api from '@src/services/api.config'
import {type AxiosError} from 'axios'

import {CloudFileState, type CloudFileType} from './types/cloud-file-type'
import {detectMime, generateMd5} from './utils'
// import {file} from '@oclif/core/args'

export class CloudFile {
  localPathToFile: null | string
  remoteAttr: CloudFileType
  resourceType: null | string = null

  constructor({localPathToFile = null, remoteAttr}: {localPathToFile?: null | string; remoteAttr: CloudFileType}) {
    this.remoteAttr = remoteAttr
    this.inferStateHistory()
    this.localPathToFile = localPathToFile
  }

  static async fetch(md5: string): Promise<CloudFile> {
    const {data} = await api.get(`/cloud_files/${md5}`)
    return new CloudFile({remoteAttr: data})
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
    return new CloudFile({localPathToFile: pathToFile, remoteAttr: data})
  }

  completed(): boolean {
    return this.remoteAttr.state === CloudFileState.COMPLETED
  }

  identifyContentType(): void {
    if (!this.localPathToFile) {
      throw new Error('CloudFile#identifyContentType requires this.localPathToFile to be set')
    }

    const {mediatype, type} = detectMime(this.localPathToFile)
    this.resourceType = this.remoteAttr.peepy ? 'secured' : mediatype
    this.remoteAttr.content_type = type
  }

  reserved(): boolean {
    return this.remoteAttr.state === CloudFileState.RESERVED
  }

  async transfer({asset, filesize}: {asset: string; filesize: number}): Promise<CloudFile> {
    this.identifyContentType()

    if (!this.remoteAttr.content_type) {
      throw new Error('CloudFile#transfer requires this.contentType to be set')
    }

    this.remoteAttr.filesize = filesize
    const payload = {asset, content_type: this.remoteAttr.content_type, filesize}
    const {data} = await api.post(`/cloud_files/${this.remoteAttr.md5}/transfer`, payload)
    this.remoteAttr = data
    this.remoteAttr.state_history.push(CloudFileState.TRANSFERRED)
    return this
  }

  transfered(): boolean {
    return this.remoteAttr.state === CloudFileState.TRANSFERRED
  }

  private inferStateHistory(): void {
    switch (this.remoteAttr.state) {
      case CloudFileState.COMPLETED: {
        this.remoteAttr.state_history = [CloudFileState.RESERVED, CloudFileState.TRANSFERRED, CloudFileState.COMPLETED]
        break
      }

      case CloudFileState.RESERVED: {
        this.remoteAttr.state_history = [CloudFileState.RESERVED]
        break
      }

      case CloudFileState.TRANSFERRED: {
        this.remoteAttr.state_history = [CloudFileState.RESERVED, CloudFileState.TRANSFERRED]
        break
      }

      default: {
        this.remoteAttr.state_history = []
      }
    }
  }
}
