import {PutObjectCommand, type PutObjectCommandOutput, S3Client, S3ServiceException} from '@aws-sdk/client-s3'
import {Upload} from '@aws-sdk/lib-storage'
import {Credentials} from '@aws-sdk/types'
import {CloudFile} from '@src/cloud-file'
import {type Logger} from '@src/logger'
import {md5AsFolders} from '@src/utils'
import axios from 'axios'
import {readFile} from 'node:fs/promises'
/**
 * Error messages for S3 transfer failures
 */
enum TransferErrorMessages {
  ENTITY_TOO_LARGE = 'Error from S3 while uploading object. The object was too large. To upload objects larger than 5GB, use the S3 console (160GB max) or the multipart upload API (5TB max).',
}

/**
 * Configuration for S3 uploader
 */
export type S3UploaderConfig = {
  accessKeyId: string
  bucketName: string
  endpoint: string
  region: string
  secretAccessKey: string
}

/**
 * Parameters for constructing an S3Uploader instance
 */
type S3UploaderConstructorParams = {
  assetLogger: Logger
  cloudFile: CloudFile
  s3Config: S3UploaderConfig
}

/**
 * Handles uploading files to S3-compatible cloud storage
 * Manages path generation, file upload, and MD5 validation
 */
export class S3Uploader {
  assetLogger: Logger
  cloudFile: CloudFile
  s3Config: S3UploaderConfig

  /**
   * Creates a new S3Uploader instance
   * @param params - Constructor parameters
   * @param params.assetLogger - Logger instance for logging asset-specific upload messages
   * @param params.cloudFile - The CloudFile instance to upload
   * @param params.s3Config - S3 configuration settings
   */
  constructor({assetLogger, cloudFile, s3Config}: S3UploaderConstructorParams) {
    this.assetLogger = assetLogger
    this.cloudFile = cloudFile
    this.s3Config = s3Config
  }

  /**
   * Generates the remote S3 path for the file
   * Format: resourceType/MD5_AS_FOLDERS/asset
   * @returns The remote path string
   * @throws Error if resourceType is not set
   */
  generateRemotePath(): string {
    if (!this.cloudFile.resourceType) {
      throw new Error('S3Uploader#generateRemotePath requires CloudFile.resourceType to be set')
    }

    return `${this.cloudFile.grouping()}/${md5AsFolders(this.cloudFile.remoteAttr.md5)}/${
      this.cloudFile.remoteAttr.asset
    }`
  }

  /**
   * Uploads a local file to S3 cloud storage
   * Logs upload progress and completion/error messages using the assetLogger
   * @returns True if upload successful and MD5 validation passes, false otherwise
   * @throws Error if localPathToFile is not set
   */
  async putLocalFile(): Promise<boolean> {
    if (!this.cloudFile.localPathToFile) {
      throw new Error('S3Uploader#putLocalFile requires CloudFile.localPathToFile to be set')
    }

    const credentials: Credentials = {
      accessKeyId: this.s3Config.accessKeyId,
      secretAccessKey: this.s3Config.secretAccessKey,
    }
    const s3Config = {
      credentials,
      endpoint: this.s3Config.endpoint,
      region: this.s3Config.region,
    }

    const s3Client = new S3Client(s3Config)
    const remotePathToFile = this.generateRemotePath()

    this.assetLogger.info(
      `Uploading to S3: ${this.cloudFile.localPathToFile} -> https://${this.s3Config.bucketName}.s3.wasabisys.com/${remotePathToFile}`,
    )
    // Read file into Buffer to support AWS SDK retry behavior
    // Streams can only be consumed once, so retries would fail with createReadStream
    const fileBuffer = await readFile(this.cloudFile.localPathToFile as string)
    const putObjectCommand = new PutObjectCommand({
      ACL: 'public-read',
      Body: fileBuffer,
      Bucket: this.s3Config.bucketName,
      Key: remotePathToFile,
    })

    try {
      const response: PutObjectCommandOutput = await s3Client.send(putObjectCommand)
      this.assetLogger.info(
        `Completed upload: ${this.cloudFile.localPathToFile} -> https://${this.s3Config.bucketName}.s3.wasabisys.com/${remotePathToFile}`,
      )
      return this.validateRemoteMd5(response)
    } catch (error) {
      if (error instanceof S3ServiceException && error.name === 'EntityTooLarge') {
        this.assetLogger.error(TransferErrorMessages.ENTITY_TOO_LARGE)
      } else if (error instanceof S3ServiceException) {
        this.assetLogger.error(
          `Error from S3 while uploading object to ${this.s3Config.bucketName}.  ${error.name}: ${error.message}`,
        )
      } else {
        throw error
      }
    }

    return false
  }

  /**
   * Downloads a file from a remote URL and streams it directly to S3 cloud storage
   * Uses multipart upload to stream efficiently without buffering the entire file in memory
   * Sets the asset name to the provided asset and logs upload progress
   * @param params - Parameters for remote file upload
   * @param params.asset - The asset filename to use
   * @param params.downloadUrl - The URL to download the file from
   * @returns True if upload successful and MD5 validation passes, false otherwise
   */
  async putRemoteFile({asset, downloadUrl}: {asset: string; downloadUrl: string}): Promise<boolean> {
    const credentials: Credentials = {
      accessKeyId: this.s3Config.accessKeyId,
      secretAccessKey: this.s3Config.secretAccessKey,
    }
    const s3Config = {
      credentials,
      endpoint: this.s3Config.endpoint,
      region: this.s3Config.region,
    }

    const s3Client = new S3Client(s3Config)

    // Set resourceType to 'staging' for remote uploads
    this.cloudFile.resourceType = 'staging'
    // Set the asset name to the provided assetFilename
    this.cloudFile.remoteAttr.asset = asset
    const stagingRemotePath = this.generateRemotePath()
    const stagingMd5 = this.cloudFile.remoteAttr.md5

    this.assetLogger.info(
      `Streaming data from URL: ${downloadUrl} -> Staging Upload to S3: https://${this.s3Config.bucketName}.s3.wasabisys.com/${stagingRemotePath}`,
    )

    try {
      // Stream the file directly from the URL to S3 using multipart upload
      // This handles chunking automatically and doesn't require buffering the entire file in memory
      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
      })

      const upload = new Upload({
        client: s3Client,
        params: {
          ACL: 'public-read',
          Body: response.data,
          Bucket: this.s3Config.bucketName,
          Key: stagingRemotePath,
        },
      })

      const s3Response = await upload.done()
      this.assetLogger.info(
        `Staged upload: ${downloadUrl} -> https://${this.s3Config.bucketName}.s3.wasabisys.com/${stagingRemotePath}`,
      )
      console.dir(s3Response)

      if (s3Response.$metadata.httpStatusCode !== 200)
        throw new Error(`Failed to upload remote file to s3: ${downloadUrl}`)

      const md5 = s3Response.ETag?.replaceAll(/"/g, '')?.toUpperCase()
      if (!md5) throw new Error(`Failed to get MD5 from S3 ETag: ${s3Response.ETag}`)

      console.dir(s3Response)
      console.log(`MD5 from S3 ETag: ${md5}`)
      this.assetLogger.info(`Changing MD5 from staging(${stagingMd5}) to final(${md5})`)

      this.cloudFile.remoteAttr.md5 = md5
      const remotePath = this.generateRemotePath()

      console.log(`Remote path: ${remotePath}`)

      // response.$metadata.httpStatusCode === 200 && response.ETag

      return this.validateRemoteMd5(s3Response)
    } catch (error) {
      if (error instanceof S3ServiceException && error.name === 'EntityTooLarge') {
        this.assetLogger.error(TransferErrorMessages.ENTITY_TOO_LARGE)
      } else if (error instanceof S3ServiceException) {
        this.assetLogger.error(
          `Error from S3 while uploading object to ${this.s3Config.bucketName}.  ${error.name}: ${error.message}`,
        )
      } else {
        this.assetLogger.error(
          `Error downloading file from ${downloadUrl}: ${error instanceof Error ? error.message : String(error)}`,
        )
        throw error
      }
    }

    return false
  }

  /**
   * Validates that the remote file's MD5 hash matches the local file
   * @param response - The S3 PutObject response
   * @returns True if MD5 hashes match and status is 200
   */
  validateRemoteMd5(response: PutObjectCommandOutput) {
    return (
      response.$metadata.httpStatusCode === 200 && response.ETag === `"${this.cloudFile.remoteAttr.md5.toLowerCase()}"`
    )
  }
}
