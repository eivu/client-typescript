/* eslint-disable camelcase */

import api from '@src/services/api.config'
import {type AxiosError} from 'axios'

import {CloudFileState, type CloudFileType} from './types/cloud-file-type'
import {detectMime, generateMd5, md5AsFolders} from './utils'

/**
 * Parameters for constructing a CloudFile instance
 */
type CloudFileConstructorParams = {
  localPathToFile?: null | string
  remoteAttr: CloudFileType
  resourceType?: null | string
}

/**
 * Represents a cloud file with its local and remote attributes
 * Manages the lifecycle of file uploads including reservation, transfer, and completion states
 */
export class CloudFile {
  localPathToFile: null | string
  remoteAttr: CloudFileType
  resourceType: null | string = null
  stateHistory: CloudFileState[] = []

  /**
   * Creates a new CloudFile instance
   * @param params - Constructor parameters
   * @param params.localPathToFile - Optional local file system path
   * @param params.remoteAttr - Remote file attributes from the server
   * @param params.resourceType - Optional resource type classification
   */
  constructor({localPathToFile = null, remoteAttr, resourceType = null}: CloudFileConstructorParams) {
    this.remoteAttr = remoteAttr
    this.inferStateHistory()
    this.localPathToFile = localPathToFile
    this.resourceType = resourceType
    if (!this.resourceType && this.remoteAttr.content_type) {
      this.resourceType = this.remoteAttr.content_type.split('/')[0]
    }
  }

  /**
   * Fetches an existing cloud file by its MD5 hash
   * @param md5 - The MD5 hash of the file to fetch
   * @returns A CloudFile instance with the fetched remote attributes
   */
  static async fetch(md5: string): Promise<CloudFile> {
    const {data: remoteAttr} = await api.get(`/cloud_files/${md5}`)
    return new CloudFile({remoteAttr})
  }

  /**
   * Attempts to reserve a file, or fetches it if already exists (based on MD5)
   * @param params - Configuration object
   * @param params.nsfw - Whether the file contains NSFW content
   * @param params.pathToFile - Path to the local file
   * @param params.secured - Whether the file should be secured/private
   * @returns A CloudFile instance, either newly reserved or fetched if it already exists
   */
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

  /**
   * Reserves a new cloud file slot on the server
   * @param params - Configuration object
   * @param params.nsfw - Whether the file contains NSFW content
   * @param params.pathToFile - Path to the local file
   * @param params.secured - Whether the file should be secured/private
   * @returns A CloudFile instance in the reserved state
   */
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

  /**
   * Checks if the cloud file is in the completed state
   * @returns True if the file upload is completed
   */
  completed(): boolean {
    return this.remoteAttr.state === CloudFileState.COMPLETED
  }

  /**
   * Identifies and sets the content type and resource type for the cloud file
   * @throws Error if localPathToFile is not set
   */
  identifyContentType(): void {
    if (!this.localPathToFile) {
      throw new Error('CloudFile#identifyContentType requires this.localPathToFile to be set')
    }

    const {mediatype, type} = detectMime(this.localPathToFile)
    this.resourceType = this.remoteAttr.peepy ? 'secured' : mediatype
    this.remoteAttr.content_type = type
  }

  /**
   * Checks if the cloud file is in the reserved state
   * @returns True if the file is reserved but not yet transferred
   */
  reserved(): boolean {
    return this.remoteAttr.state === CloudFileState.RESERVED
  }

  async reset(): Promise<CloudFile> {
    const {data} = await api.post(`/cloud_files/${this.remoteAttr.md5}/reset`, {
      content_type: this.remoteAttr.content_type,
    })
    this.remoteAttr = data
    this.stateHistory = [CloudFileState.RESERVED]
    return this
  }

  /**
   * Marks the file as transferred and updates the server with asset information
   * @param params - Transfer parameters
   * @param params.asset - The asset name in the cloud storage
   * @param params.filesize - The size of the file in bytes
   * @returns The updated CloudFile instance
   * @throws Error if content_type is not set
   */
  async transfer({asset, filesize}: {asset: string; filesize: number}): Promise<CloudFile> {
    if (!this.remoteAttr.content_type) {
      throw new Error('CloudFile#transfer requires this.contentType to be set')
    }

    const payload = {asset, content_type: this.remoteAttr.content_type, filesize}
    const {data} = await api.post(`/cloud_files/${this.remoteAttr.md5}/transfer`, payload)
    // Sets asset, content_type and filesize
    this.remoteAttr = data
    this.stateHistory.push(CloudFileState.TRANSFERRED)
    return this
  }

  /**
   * Checks if the cloud file is in the transferred state
   * @returns True if the file has been transferred to cloud storage
   */
  transfered(): boolean {
    return this.remoteAttr.state === CloudFileState.TRANSFERRED
  }

  url(): null | string {
    if (this.reserved()) return null
    return `https://${process.env.EIVU_BUCKET_NAME}.s3.wasabisys.com/${this.resourceType}/${md5AsFolders(
      this.remoteAttr.md5,
    )}/${this.remoteAttr.asset}`
  }

  /**
   * Infers and sets the state history based on the current state
   * @private
   */
  private inferStateHistory(): void {
    switch (this.remoteAttr.state) {
      case CloudFileState.COMPLETED: {
        this.stateHistory = [CloudFileState.RESERVED, CloudFileState.TRANSFERRED, CloudFileState.COMPLETED]
        break
      }

      case CloudFileState.RESERVED: {
        this.stateHistory = [CloudFileState.RESERVED]
        break
      }

      case CloudFileState.TRANSFERRED: {
        this.stateHistory = [CloudFileState.RESERVED, CloudFileState.TRANSFERRED]
        break
      }

      default: {
        this.stateHistory = []
      }
    }
  }
}
