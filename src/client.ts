import {CloudFile} from '@src/cloud-file'
import logger, {type Logger} from '@src/logger'
import {generateDataProfile, MetadataPair} from '@src/metadata-extraction'
import {S3Uploader, S3UploaderConfig} from '@src/s3-uploader'
import {cleansedAssetName, generateMd5, isOnline} from '@src/utils'
import {Glob} from 'glob'
import * as fs from 'node:fs/promises'
import pLimit from 'p-limit'

type BaseParams = {
  metadataList?: MetadataPair[]
  nsfw?: boolean
  secured?: boolean
}

type UploadFileParams = BaseParams & {
  pathToFile: string
}

type UploadFolderParams = BaseParams & {
  concurrency?: number
  pathToFolder: string
}

/**
 * Client for managing file uploads to the cloud storage service
 * Handles file validation, reservation, transfer, and status tracking
 */
export class Client {
  static SKIPPABLE_EXTENSIONS: string[] = [
    'ds_store',
    'gitignore',
    'gitkeep',
    'cue',
    'eivu.yml',
    'm4p',
    'log',
    'md5',
    'sfv',
    'info',
    'nfo',
    'm3u',
    'm3u8',
    'com',
    'db.lo',
    'db.lo.1',
  ]
  static SKIPPABLE_FOLDERS: string[] = ['.git', 'podcasts']
  logger: Logger
  status = {
    failure: {},
    success: {},
  }

  constructor() {
    this.logger = logger
  }

  /**
   * Static helper method to upload a file without instantiating a client
   * Creates a new client instance and delegates to the instance method
   * @param params - Upload parameters
   * @param params.metadataList - Optional array of metadata key-value pairs to attach to the file
   * @param params.pathToFile - Path to the local file to upload
   * @returns The CloudFile instance representing the uploaded file
   */
  static async uploadFile({
    metadataList = [],
    nsfw = false,
    pathToFile,
    secured = false,
  }: UploadFileParams): Promise<CloudFile> {
    const client = new Client()
    return client.uploadFile({metadataList, nsfw, pathToFile, secured})
  }

  static async uploadFolder({
    concurrency = 3,
    metadataList = [],
    nsfw = false,
    pathToFolder,
    secured = false,
  }: UploadFolderParams): Promise<CloudFile[]> {
    const client = new Client()
    return client.uploadFolder({concurrency, metadataList, nsfw, pathToFolder, secured})
  }

  /**
   * Uploads a file to cloud storage
   * Validates the file, reserves a slot, and transfers the file to S3
   * @param params - Upload parameters
   * @param params.metadataList - Optional array of metadata key-value pairs to attach to the file
   * @param params.pathToFile - Path to the local file to upload
   * @returns The CloudFile instance representing the uploaded file
   * @throws Error if the file is empty or upload fails
   */
  async uploadFile({
    metadataList = [],
    nsfw = false,
    pathToFile,
    secured = false,
  }: UploadFileParams): Promise<CloudFile> {
    if (await this.isEmptyFile(pathToFile)) {
      throw new Error(`Can not upload empty file: ${pathToFile}`)
    }

    const asset = cleansedAssetName(pathToFile)
    const md5 = await generateMd5(pathToFile)
    const assetLogger = this.logger.child({asset, md5})

    assetLogger.info(`Fetching/Reserving: ${asset}`)
    let cloudFile = await CloudFile.fetchOrReserveBy({nsfw, pathToFile, secured})
    cloudFile.remoteAttr.asset = asset
    await this.processTransfer({asset, assetLogger, cloudFile})

    const dataProfile = await generateDataProfile({metadataList, pathToFile})

    if (cloudFile.transfered()) {
      assetLogger.info('Completing')
      cloudFile = await cloudFile.complete(dataProfile)
    } else {
      assetLogger.info('Updating/Skipping')
      cloudFile = await cloudFile.updateMetadata(dataProfile)
    }

    return cloudFile
  }

  async uploadFolder({
    concurrency = 3,
    metadataList = [],
    nsfw = false,
    pathToFolder,
    secured = false,
  }: UploadFolderParams): Promise<CloudFile[]> {
    const directoryGlob = new Glob(`${pathToFolder}/**/*`, {nodir: true})
    const limit = pLimit(concurrency)
    const uploadPromises: Promise<CloudFile>[] = []

    for await (const pathToFile of directoryGlob) {
      if (Client.SKIPPABLE_EXTENSIONS.some((ext) => pathToFile.toLowerCase().endsWith(`.${ext}`))) continue
      if (Client.SKIPPABLE_FOLDERS.some((folder) => pathToFile.includes(`/${folder}/`))) continue

      this.logger.info(`queueing: ${pathToFile}`)
      // create a new client for each file to avoid state issues
      // limit(() => this.uploadFile({pathToFile}))
      const uploadPromise = limit(() => this.uploadFile({metadataList, nsfw, pathToFile, secured}))
      uploadPromises.push(uploadPromise)
    }

    return Promise.all(uploadPromises)
  }

  async verifyUpload(pathToFile: string): Promise<boolean> {
    const md5 = await generateMd5(pathToFile)
    try {
      const cloudFile = await CloudFile.fetch(md5)
      return cloudFile.completed()
    } catch {
      return false
    }
  }

  /**
   * Checks if a file is empty (has zero size)
   * @param pathToFile - Path to the file to check
   * @returns True if the file is empty or doesn't exist
   * @private
   */
  private async isEmptyFile(pathToFile: string): Promise<boolean> {
    try {
      const stats = await fs.stat(pathToFile)
      return stats.size === 0
    } catch {
      return false
    }
  }

  /**
   * Processes the transfer of a file to S3 cloud storage
   * @param params - Transfer parameters
   * @param params.asset - The cleansed asset name
   * @param params.assetLogger - Logger instance for logging asset-specific messages
   * @param params.cloudFile - The CloudFile instance to transfer
   * @returns The updated CloudFile instance after transfer
   * @throws Error if the CloudFile is not in reserved state or localPathToFile is not set
   * @private
   */
  private async processTransfer({
    asset,
    assetLogger,
    cloudFile,
  }: {
    asset: string
    assetLogger: Logger
    cloudFile: CloudFile
  }): Promise<CloudFile> {
    if (!cloudFile.reserved()) {
      assetLogger.info(
        `CloudFile#processTransfer requires CloudFile to be in reserved state: found ${cloudFile.remoteAttr.state}`,
      )
      return cloudFile
    }

    if (!cloudFile.localPathToFile) {
      throw new Error("CloudFile#processTransfer requires CloudFile's localPathToFile to be set")
    }

    assetLogger.info(`Processing Transfer: ${cloudFile.localPathToFile}`)

    cloudFile.identifyContentType()
    assetLogger.info(`Determined resourceType: ${cloudFile.resourceType}`)
    const stats = await fs.stat(cloudFile.localPathToFile as string)
    const filesize = stats.size

    assetLogger.info(`filesize: ${filesize}`)
    const s3Config: S3UploaderConfig = {
      accessKeyId: process.env.EIVU_ACCESS_KEY_ID as string,
      bucketName: process.env.EIVU_BUCKET_NAME as string,
      endpoint: process.env.EIVU_ENDPOINT as string,
      region: process.env.EIVU_REGION as string,
      secretAccessKey: process.env.EIVU_SECRET_ACCESS_KEY as string,
    }

    const s3Uploader = new S3Uploader({assetLogger, cloudFile, s3Config})
    if (!(await s3Uploader.putLocalFile())) {
      throw new Error(`Failed to upload file to S3: ${cloudFile.localPathToFile}`)
    }

    if (!(await isOnline(cloudFile.url(), filesize))) {
      cloudFile.reset() // set state back to reserved
      throw new Error(
        `File ${cloudFile.remoteAttr.md5}:${asset} is offline/filesize mismatch. expected size: ${filesize} got: ${cloudFile.remoteAttr.filesize}`,
      )
    }

    return cloudFile.transfer({asset, filesize})
  }
}
