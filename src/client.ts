import {CloudFile} from '@src/cloud-file'
import {METADATA_YML_SUFFIX} from '@src/constants'
import logger, {type Logger} from '@src/logger'
import {
  extractInfoFromYml,
  filterMetadataProfile,
  generateDataProfile,
  type MetadataPair,
} from '@src/metadata-extraction'
import {S3Uploader, S3UploaderConfig} from '@src/s3-uploader'
import {cleansedAssetName, generateMd5, isOnline, validateDirectoryPath, validateFilePath} from '@src/utils'
import * as fastCsv from 'fast-csv'
import {Glob} from 'glob'
import fs from 'node:fs'
import * as fsPromise from 'node:fs/promises'
import path from 'node:path'
import pLimit from 'p-limit'

type BaseParams = {
  metadataList?: MetadataPair[]
  nsfw?: boolean
  secured?: boolean
}

type BulkUpdateCloudFilesParams = {
  concurrency?: number
  pathToFolder: string
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
 *
 * Provides both static convenience methods and instance methods for uploading
 * individual files or entire folders with configurable concurrency and metadata
 */
export class Client {
  static SKIPPABLE_EXTENSIONS: string[] = [
    'ds_store',
    'gitignore',
    'gitkeep',
    'cue',
    METADATA_YML_SUFFIX.replace('.', ''), // 'eivu.yml' NOT '.eivu.yml'
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

  constructor() {
    this.logger = logger
  }

  static async bulkUpdateCloudFiles({concurrency = 3, pathToFolder}: BulkUpdateCloudFilesParams): Promise<string[]> {
    const client = new Client()
    return client.bulkUpdateCloudFiles({concurrency, pathToFolder})
  }

  /**
   * Static helper method to upload a file without instantiating a client
   * Creates a new client instance and delegates to the instance method
   * @param params - Upload parameters
   * @param params.metadataList - Optional array of metadata key-value pairs to attach to the file
   * @param params.nsfw - Optional flag indicating if the file contains NSFW content (default: false)
   * @param params.pathToFile - Path to the local file to upload
   * @param params.secured - Optional flag indicating if the file should be secured (default: false)
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

  /**
   * Static helper method to upload a folder without instantiating a client
   * Creates a new client instance and delegates to the instance method
   * @param params - Upload parameters
   * @param params.concurrency - Optional number of concurrent uploads (default: 3)
   * @param params.metadataList - Optional array of metadata key-value pairs to attach to files
   * @param params.nsfw - Optional flag indicating if files contain NSFW content (default: false)
   * @param params.pathToFolder - Path to the local folder to upload
   * @param params.secured - Optional flag indicating if files should be secured (default: false)
   * @returns Promise resolving to an array of status messages for each upload attempt
   */
  static async uploadFolder({
    concurrency = 3,
    metadataList = [],
    nsfw = false,
    pathToFolder,
    secured = false,
  }: UploadFolderParams): Promise<string[]> {
    const client = new Client()
    return client.uploadFolder({concurrency, metadataList, nsfw, pathToFolder, secured})
  }

  async bulkUpdateCloudFiles({concurrency = 3, pathToFolder}: BulkUpdateCloudFilesParams): Promise<string[]> {
    pathToFolder = validateDirectoryPath(pathToFolder)

    const directoryGlob = new Glob(`${pathToFolder}/**/*`, {nodir: true})
    const limit = pLimit(concurrency)
    const updatePromises: Promise<string>[] = []
    await fsPromise.mkdir('logs', {recursive: true}) // ensure logs directory exists

    for await (const pathToFile of directoryGlob) {
      if (!pathToFile.endsWith(METADATA_YML_SUFFIX)) continue

      this.logger.info(`queueing: ${pathToFile}`)
      const updatePromise = limit(() => this.processRateLimitedCloudFileUpdate(pathToFile))
      updatePromises.push(updatePromise)
    }

    return Promise.all(updatePromises)
  }

  async updateCloudFile(pathToFile: string): Promise<CloudFile> {
    if (!pathToFile.endsWith(METADATA_YML_SUFFIX))
      throw new Error(`Client#updateFile only supports ${METADATA_YML_SUFFIX} metadata files`)

    // Validate file path for existence and security, and get trimmed path
    pathToFile = validateFilePath(pathToFile)
    const md5 = path.basename(pathToFile, METADATA_YML_SUFFIX)
    try {
      const cloudFile = await CloudFile.fetch(md5)
      const dataProfile = await extractInfoFromYml(pathToFile)
      const filteredProfile = filterMetadataProfile(dataProfile)
      return cloudFile.updateMetadata(filteredProfile)
    } catch (error) {
      this.logger.error({error, md5, pathToFile}, 'Failed to update file metadata')
      throw error
    }
  }

  /**
   * Uploads a file to cloud storage
   * Validates the file, reserves a slot, and transfers the file to S3
   * @param params - Upload parameters
   * @param params.metadataList - Optional array of metadata key-value pairs to attach to the file
   * @param params.nsfw - Optional flag indicating if the file contains NSFW content (default: false)
   * @param params.pathToFile - Path to the local file to upload
   * @param params.secured - Optional flag indicating if the file should be secured (default: false)
   * @returns The CloudFile instance representing the uploaded file
   * @throws Error if the file is empty or upload fails
   */
  async uploadFile({
    metadataList = [],
    nsfw = false,
    pathToFile,
    secured = false,
  }: UploadFileParams): Promise<CloudFile> {
    // Validate file path for existence and security, and get trimmed path
    pathToFile = validateFilePath(pathToFile)

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

  /**
   * Uploads all files in a folder to cloud storage
   * Recursively processes files in the folder with configurable concurrency
   * Skips files with skippable extensions and files in skippable folders
   * @param params - Upload parameters
   * @param params.concurrency - Optional number of concurrent uploads (default: 3)
   * @param params.metadataList - Optional array of metadata key-value pairs to attach to files
   * @param params.nsfw - Optional flag indicating if files contain NSFW content (default: false)
   * @param params.pathToFolder - Path to the local folder to upload
   * @param params.secured - Optional flag indicating if files should be secured (default: false)
   * @returns Promise resolving to an array of status messages for each upload attempt
   */
  async uploadFolder({
    concurrency = 3,
    metadataList = [],
    nsfw = false,
    pathToFolder,
    secured = false,
  }: UploadFolderParams): Promise<string[]> {
    // Validate directory path for existence and security, and get trimmed path
    pathToFolder = validateDirectoryPath(pathToFolder)

    const directoryGlob = new Glob(`${pathToFolder}/**/*`, {nodir: true})
    const limit = pLimit(concurrency)
    const uploadPromises: Promise<string>[] = []
    await fsPromise.mkdir('logs', {recursive: true}) // ensure logs directory exists

    for await (const pathToFile of directoryGlob) {
      if (Client.SKIPPABLE_EXTENSIONS.some((ext) => pathToFile.toLowerCase().endsWith(`.${ext}`))) continue
      if (Client.SKIPPABLE_FOLDERS.some((folder) => pathToFile.includes(`/${folder}/`))) continue

      this.logger.info(`queueing: ${pathToFile}`)
      const uploadPromise = limit(() => this.processRateLimitedUpload({metadataList, nsfw, pathToFile, secured}))
      uploadPromises.push(uploadPromise)
    }

    return Promise.all(uploadPromises)
  }

  /**
   * Verifies if a file has been successfully uploaded and completed
   * Checks the file's MD5 hash against the cloud storage service
   * @param pathToFile - Path to the local file to verify
   * @returns Promise resolving to true if the file exists in cloud storage and is completed, false otherwise
   * @throws Will not throw, but returns false if the file cannot be fetched from the cloud storage
   */
  async verifyUpload(pathToFile: string): Promise<boolean> {
    // Validate file path for existence and security, and get trimmed path
    pathToFile = validateFilePath(pathToFile)

    const md5 = await generateMd5(pathToFile)
    try {
      const cloudFile = await CloudFile.fetch(md5)
      return cloudFile.completed()
    } catch (error) {
      this.logger.debug({error, md5, pathToFile}, 'Failed to verify upload')
      return false
    }
  }

  /**
   * Checks if a file is empty (has zero size)
   * @param pathToFile - Path to the file to check
   * @returns True if the file exists and has zero size, false if the file doesn't exist or has content
   * @private
   */
  private async isEmptyFile(pathToFile: string): Promise<boolean> {
    try {
      const stats = await fsPromise.stat(pathToFile)
      return stats.size === 0
    } catch {
      return false
    }
  }

  /**
   * Logs a failed upload attempt to the failure log file
   * @param pathToFile - Path to the file that failed to upload
   * @param error - The error that occurred during upload
   * @returns Promise that resolves when the log entry has been written
   * @private
   */
  private async logFailure(pathToFile: string, error: Error): Promise<void> {
    let md5: string
    try {
      md5 = await generateMd5(pathToFile)
    } catch {
      // If the file doesn't exist (e.g., was deleted), use a placeholder
      // This prevents logFailure from throwing and crashing the entire batch upload
      md5 = 'FILE_NOT_FOUND'
    }

    await this.logMessage('logs/failure.csv', [new Date().toISOString(), pathToFile, md5, error.message])
  }

  /**
   * Writes a log message to a CSV file
   * Appends a new row to the specified CSV log file
   * @param logPath - Path to the log file
   * @param data - Array of string values to write as a CSV row
   * @returns Promise that resolves when the log entry has been written, or rejects on error
   * @private
   */
  private async logMessage(logPath: string, data: string[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const stream = fs.createWriteStream(logPath, {flags: 'a'})
      const csvStream = fastCsv.format({headers: false})
      stream.write('\n')
      csvStream.pipe(stream)

      stream.on('error', reject)
      csvStream.on('error', reject)

      stream.on('finish', resolve)

      csvStream.write(data)
      csvStream.end()
    })
  }

  /**
   * Logs a successful upload to the success log file
   * @param pathToFile - Path to the file that was successfully uploaded
   * @returns Promise that resolves when the log entry has been written
   * @private
   */
  private async logSuccess(pathToFile: string): Promise<void> {
    const md5 = await generateMd5(pathToFile)
    await this.logMessage('logs/success.csv', [new Date().toISOString(), pathToFile, md5, 'Upload successful'])
  }

  private async processRateLimitedCloudFileUpdate(pathToFile: string): Promise<string> {
    try {
      await this.updateCloudFile(pathToFile)
      return `${pathToFile}: updated successfully`
    } catch (error) {
      await this.logFailure(pathToFile, error as Error)
      return `${pathToFile}: ${(error as Error).message}`
    }
  }

  /**
   * Processes an upload with rate limiting and error handling
   * Attempts to upload a file, verifies the upload, and logs the result
   * @param params - Upload parameters
   * @param params.metadataList - Optional array of metadata key-value pairs to attach to the file
   * @param params.nsfw - Optional flag indicating if the file contains NSFW content (default: false)
   * @param params.pathToFile - Path to the local file to upload
   * @param params.secured - Optional flag indicating if the file should be secured (default: false)
   * @returns Promise resolving to a status message string indicating the upload result
   * @private
   */
  private async processRateLimitedUpload({
    metadataList = [],
    nsfw = false,
    pathToFile,
    secured = false,
  }: UploadFileParams): Promise<string> {
    try {
      await this.uploadFile({metadataList, nsfw, pathToFile, secured})

      if (await this.verifyUpload(pathToFile)) {
        await this.logSuccess(pathToFile)
        return `${pathToFile}: uploaded successfully`
      }

      const failedError = 'upload verification failed'
      await this.logFailure(pathToFile, new Error(failedError))
      return `${pathToFile}: ${failedError}`
    } catch (error) {
      await this.logFailure(pathToFile, error as Error)
      return `${pathToFile}: ${(error as Error).message}`
    }
  }

  /**
   * Processes the transfer of a file to S3 cloud storage
   * Uploads the file to S3, verifies it's online, and updates the CloudFile state
   * @param params - Transfer parameters
   * @param params.asset - The cleansed asset name
   * @param params.assetLogger - Logger instance for logging asset-specific messages
   * @param params.cloudFile - The CloudFile instance to transfer
   * @returns Promise resolving to the updated CloudFile instance after transfer
   * @throws {Error} If the CloudFile is not in reserved state (returns early without throwing)
   * @throws {Error} If localPathToFile is not set on the CloudFile
   * @throws {Error} If the S3 upload fails
   * @throws {Error} If the uploaded file is offline or has a filesize mismatch
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
    const stats = await fsPromise.stat(cloudFile.localPathToFile)
    const filesize = stats.size

    assetLogger.info(`filesize: ${filesize}`)

    // Validate required environment variables
    const requiredEnvVars = {
      EIVU_ACCESS_KEY_ID: process.env.EIVU_ACCESS_KEY_ID,
      EIVU_BUCKET_NAME: process.env.EIVU_BUCKET_NAME,
      EIVU_ENDPOINT: process.env.EIVU_ENDPOINT,
      EIVU_REGION: process.env.EIVU_REGION,
      EIVU_SECRET_ACCESS_KEY: process.env.EIVU_SECRET_ACCESS_KEY,
    }

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([, value]) => !value || value === '')
      .map(([key]) => key)

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
    }

    // Safe to use type assertions after runtime validation
    const s3Config: S3UploaderConfig = {
      accessKeyId: requiredEnvVars.EIVU_ACCESS_KEY_ID as string,
      bucketName: requiredEnvVars.EIVU_BUCKET_NAME as string,
      endpoint: requiredEnvVars.EIVU_ENDPOINT as string,
      region: requiredEnvVars.EIVU_REGION as string,
      secretAccessKey: requiredEnvVars.EIVU_SECRET_ACCESS_KEY as string,
    }

    const s3Uploader = new S3Uploader({assetLogger, cloudFile, s3Config})
    if (!(await s3Uploader.putLocalFile())) {
      throw new Error(`Failed to upload file to S3: ${cloudFile.localPathToFile}`)
    }

    const onlineCheck = await isOnline(cloudFile.url(), filesize, assetLogger)
    if (onlineCheck.isOnline) {
      return cloudFile.transfer({asset, filesize})
    }

    await cloudFile.reset() // set state back to reserved
    const remoteFilesizeStr = onlineCheck.remoteFilesize === null ? 'unknown' : String(onlineCheck.remoteFilesize)
    throw new Error(
      `File ${cloudFile.remoteAttr.md5}:${asset} is offline/filesize mismatch. expected size: ${filesize} got: ${remoteFilesizeStr}`,
    )
  }
}
