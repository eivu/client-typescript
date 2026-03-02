/* eslint-disable camelcase */

import {type MetadataProfile} from '@src/metadata-extraction'
import api from '@src/services/api.config'
import {CloudFileState, type CloudFileType} from '@src/types/cloud-file-type'
import {detectMime, generateMd5, md5AsFolders, validateFilePath} from '@src/utils'
import {isAxiosError} from 'axios'

import {getEnv} from './env'

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
   * @param params.md5 - MD5 hash of the file
   * @param params.nsfw - Whether the file contains NSFW content
   * @param params.pathToFile - Path to the local file
   * @param params.secured - Whether the file should be secured/private
   * @returns A CloudFile instance, either newly reserved or fetched if it already exists
   */
  static async fetchOrReserveBy({
    md5,
    nsfw = false,
    pathToFile,
    secured = false,
  }: {
    md5?: string
    nsfw?: boolean
    pathToFile?: string
    secured?: boolean
  }): Promise<CloudFile> {
    if (!md5 && !pathToFile) throw new Error('CloudFile#fetchOrReserveBy requires either md5 or pathToFile to be set')
    if (md5 && pathToFile)
      throw new Error('CloudFile#fetchOrReserveBy requires only one of md5 or pathToFile to be set')
    if (pathToFile) {
      // Validate file path for existence and security, and get trimmed path
      pathToFile = validateFilePath(pathToFile)
      md5 = await generateMd5(pathToFile)
    }

    try {
      return await CloudFile.reserve({md5, nsfw, pathToFile, secured})
    } catch (error) {
      // a file already exists with the same MD5 hash
      if (isAxiosError(error) && error.response?.status === 422) {
        md5 = md5 || (await generateMd5(pathToFile as string))
        const cloudFile = await CloudFile.fetch(md5)
        if (pathToFile) cloudFile.localPathToFile = pathToFile
        return cloudFile
      }

      throw error
    }
  }

  /**
   * Reserves a new cloud file slot on the server
   * @param params - Configuration object
   * @param params.md5 - MD5 hash of the file
   * @param params.nsfw - Whether the file contains NSFW content
   * @param params.pathToFile - Path to the local file
   * @param params.secured - Whether the file should be secured/private
   * @returns A CloudFile instance in the reserved state
   */
  static async reserve({
    md5,
    nsfw = false,
    pathToFile,
    secured = false,
  }: {
    md5?: string
    nsfw?: boolean
    pathToFile?: string
    secured?: boolean
  }): Promise<CloudFile> {
    if (!md5 && !pathToFile) throw new Error('CloudFile#reserve requires either md5 or pathToFile to be set')
    if (pathToFile) {
      pathToFile = validateFilePath(pathToFile) // Validate file path for existence and security, and get trimmed path
      md5 = md5 || (await generateMd5(pathToFile))
    }

    const payload = {nsfw, secured}
    const {data: responseData} = await api.post(`/cloud_files/${md5}/reserve`, payload)
    const data: CloudFileType = responseData
    return new CloudFile({localPathToFile: pathToFile, remoteAttr: data})
  }

  /**
   * Marks the cloud file as complete with metadata and finalizes the upload process
   * @param dataProfile - The metadata profile containing extracted information
   * @returns The updated CloudFile instance
   */
  async complete(dataProfile: MetadataProfile): Promise<CloudFile> {
    return this.updateData({action: 'complete', dataProfile})
  }

  /**
   * Checks if the cloud file is in the completed state
   * @returns True if the file upload is completed
   */
  completed(): boolean {
    return this.remoteAttr.state === CloudFileState.COMPLETED
  }

  /**
   * Deletes the cloud file on the server.
   * @returns Promise resolving to true on success (204)
   * @throws Error if the delete request does not return 204
   */
  async delete(): Promise<boolean> {
    const result = await api.delete(`/cloud_files/${this.remoteAttr.md5}`)
    if (result.status !== 204) {
      throw new Error(`Failed to delete cloud file: ${this.remoteAttr.md5}`)
    }

    return true
  }

  /**
   * Determines the grouping/category for the cloud file based on its attributes
   * Files are grouped as 'secured', by resource type (audio/image/video), or 'archive'
   * @returns The grouping string: 'secured', 'audio', 'image', 'video', or 'archive'
   */
  grouping(): string {
    if (this.remoteAttr.peepy || this.remoteAttr.secured) {
      return 'secured'
    }

    if (this.resourceType && ['audio', 'image', 'staging', 'video'].includes(this.resourceType))
      return this.resourceType

    return 'archive'
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
    this.resourceType = mediatype
    this.remoteAttr.content_type = type
  }

  /**
   * Checks if the cloud file is in the reserved state
   * @returns True if the file is reserved but not yet transferred
   */
  reserved(): boolean {
    return this.remoteAttr.state === CloudFileState.RESERVED
  }

  /**
   * Resets the cloud file back to the reserved state
   * @returns The reset CloudFile instance
   */
  async reset(): Promise<CloudFile> {
    const {data} = await api.post(`/cloud_files/${this.remoteAttr.md5}/reset`)
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
  transferred(): boolean {
    // Handle both spellings for backward compatibility with server
    return (
      this.remoteAttr.state === CloudFileState.TRANSFERRED || this.remoteAttr.state === ('transfered' as CloudFileState)
    )
  }

  /**
   * Updates the metadata for an already uploaded cloud file
   * @param dataProfile - The metadata profile containing updated information
   * @returns The updated CloudFile instance
   */
  async updateMetadata(dataProfile: MetadataProfile): Promise<CloudFile> {
    return this.updateData({action: 'update_metadata', dataProfile})
  }

  /**
   * Updates the cloud file's MD5 on the server, or fetches the existing file if a conflict (409) occurs.
   * @param md5 - The target MD5 to update to
   * @returns This CloudFile with updated remoteAttr, or fetched data on conflict
   * @throws Error for non-409 failures
   */
  async updateOrFetch(md5: string): Promise<CloudFile> {
    const {asset, filesize} = this.remoteAttr
    try {
      return await this.update(md5)
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        const cloudFile = await CloudFile.fetch(md5)
        this.remoteAttr = {...cloudFile.remoteAttr, asset, filesize}
        this.inferStateHistory()
        return this
      }

      throw error
    }
  }

  /**
   * Generates the public URL for accessing the cloud file
   * @returns The full URL to the file in cloud storage
   * @throws Error if resourceType, md5, or asset are not set
   */
  url(): string {
    if (!this.resourceType) throw new Error('CloudFile#url requires this.resourceType to be set')
    if (!this.remoteAttr.md5) throw new Error('CloudFile#url requires this.remoteAttr.md5 to be set')
    if (!this.remoteAttr.asset) throw new Error('CloudFile#url requires this.remoteAttr.asset to be set')

    const env = getEnv()
    return `https://${env.EIVU_BUCKET_NAME}.s3.wasabisys.com/${this.grouping()}/${md5AsFolders(
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

      // Grouped cases for backward compatibility - both spellings map to same state
      // eslint-disable-next-line perfectionist/sort-switch-case
      case 'transfered' as CloudFileState:
      case CloudFileState.TRANSFERRED: {
        this.stateHistory = [CloudFileState.RESERVED, CloudFileState.TRANSFERRED]
        break
      }

      default: {
        this.stateHistory = []
      }
    }
  }

  /**
   * Updates the cloud file's MD5 on the server (move/rename by content).
   * @param md5 - The target MD5 to update to
   * @returns This CloudFile with updated remoteAttr
   * @private
   */
  private async update(md5: string): Promise<CloudFile> {
    const {asset, filesize} = this.remoteAttr
    const {data} = await api.patch(`/cloud_files/${this.remoteAttr.md5}`, {target_md5: md5})
    this.remoteAttr = {...data, asset, filesize}
    this.stateHistory = [CloudFileState.RESERVED]
    return this
  }

  /**
   * Internal method to update cloud file data with the specified action
   * @param params - Update parameters
   * @param params.action - The action to perform ('complete' or 'update_metadata')
   * @param params.dataProfile - The metadata profile to send
   * @returns The updated CloudFile instance
   * @private
   */
  private async updateData({
    action,
    dataProfile,
  }: {
    action: 'complete' | 'update_metadata'
    dataProfile: MetadataProfile
  }): Promise<CloudFile> {
    const {data: parsedBody} = await api.post(`/cloud_files/${this.remoteAttr.md5}/${action}`, dataProfile)
    this.remoteAttr = parsedBody
    // Only update state history for 'complete' action, not for 'update_metadata'
    // updateMetadata is just updating data without changing the file's lifecycle state
    if (action === 'complete') {
      this.stateHistory.push(CloudFileState.COMPLETED)
    }

    return this
  }
}
