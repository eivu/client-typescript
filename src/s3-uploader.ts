import {PutObjectCommand, type PutObjectCommandOutput, S3Client, S3ServiceException} from '@aws-sdk/client-s3'
import {Credentials} from '@aws-sdk/types'
import {CloudFile} from '@src/cloud-file'
import {md5AsFolders} from '@src/utils'
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
  asset: string
  cloudFile: CloudFile
  s3Config: S3UploaderConfig
}

/**
 * Handles uploading files to S3-compatible cloud storage
 * Manages path generation, file upload, and MD5 validation
 */
export class S3Uploader {
  asset: string
  cloudFile: CloudFile
  s3Config: S3UploaderConfig

  /**
   * Creates a new S3Uploader instance
   * @param params - Constructor parameters
   * @param params.asset - The asset name for the uploaded file
   * @param params.cloudFile - The CloudFile instance to upload
   * @param params.s3Config - S3 configuration settings
   */
  constructor({asset, cloudFile, s3Config}: S3UploaderConstructorParams) {
    this.cloudFile = cloudFile
    this.asset = asset
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

    return `${this.cloudFile.resourceType}/${md5AsFolders(this.cloudFile.remoteAttr.md5)}/${this.asset}`
  }

  /**
   * Uploads a local file to S3 cloud storage
   * @returns True if upload successful and MD5 validation passes, false otherwise
   */
  async putLocalFile(): Promise<boolean> {
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

    console.log(
      `Uploading to S3: ${this.cloudFile.localPathToFile} -> https://${this.s3Config.bucketName}.s3.wasabisys.com/${remotePathToFile}`,
    )
    const putObjectCommand = new PutObjectCommand({
      ACL: 'public-read',
      Body: await readFile(this.cloudFile.localPathToFile as string),
      Bucket: this.s3Config.bucketName,
      Key: remotePathToFile,
    })

    try {
      const response: PutObjectCommandOutput = await s3Client.send(putObjectCommand)
      console.log(
        `Completed upload: ${this.cloudFile.localPathToFile} -> https://${this.s3Config.bucketName}.s3.wasabisys.com/${remotePathToFile}`,
      )
      return this.validateRemoteMd5(response)
    } catch (error) {
      if (error instanceof S3ServiceException && error.name === 'EntityTooLarge') {
        console.error(TransferErrorMessages.ENTITY_TOO_LARGE)
      } else if (error instanceof S3ServiceException) {
        console.error(
          `Error from S3 while uploading object to ${this.s3Config.bucketName}.  ${error.name}: ${error.message}`,
        )
      } else {
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
    // return true
  }
}
