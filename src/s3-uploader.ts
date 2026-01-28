import {PutObjectCommand, type PutObjectCommandOutput, S3Client, S3ServiceException} from '@aws-sdk/client-s3'
import {Credentials} from '@aws-sdk/types'
import {CloudFile} from '@src/cloud-file'
import {type Logger} from '@src/logger'
import {md5AsFolders} from '@src/utils'
import axios from 'axios'
import {Buffer} from 'node:buffer'
import {readFile} from 'node:fs/promises'
import {Readable} from 'node:stream'
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
   * Downloads a file from a remote URL and uploads it directly to S3 cloud storage
   * Streams the file from the URL to S3, buffering in memory only if content-length is unavailable
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
    const remotePathToFile = this.generateRemotePath()

    this.assetLogger.info(
      `Streaming data from URL: ${downloadUrl} -> Staging Upload to S3: https://${this.s3Config.bucketName}.s3.wasabisys.com/${remotePathToFile}`,
    )

    try {
      // Stream the file directly from the URL to S3
      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
      })

      // Extract content-length from response headers if available
      const contentLength = response.headers['content-length']
        ? Number.parseInt(response.headers['content-length'], 10)
        : undefined

      let body: Buffer | Readable
      let finalContentLength: number | undefined = contentLength

      // If content-length is not available, buffer the stream to avoid chunked encoding issues
      // This is similar to how putLocalFile handles files - buffers support AWS SDK retry behavior
      if (contentLength === undefined) {
        const chunks: Buffer[] = []

        for await (const chunk of response.data) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }

        body = Buffer.concat(chunks)
        finalContentLength = body.length
      } else {
        body = response.data
      }

      const putObjectCommand = new PutObjectCommand({
        ACL: 'public-read',
        Body: body,
        Bucket: this.s3Config.bucketName,
        ContentLength: finalContentLength,
        Key: remotePathToFile,
      })

      const s3Response: PutObjectCommandOutput = await s3Client.send(putObjectCommand)
      this.assetLogger.info(
        `Staged upload: ${downloadUrl} -> https://${this.s3Config.bucketName}.s3.wasabisys.com/${remotePathToFile}`,
      )
      console.dir(s3Response)
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
