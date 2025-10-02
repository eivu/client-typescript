import {PutObjectCommand, S3Client, S3ServiceException} from '@aws-sdk/client-s3'
import {Credentials} from '@aws-sdk/types'
import {CloudFile} from '@src/cloud-file'
import {readFile} from 'node:fs/promises'

interface Config {
  bucketName: string
}

enum TransferErrorMessages {
  ENTITY_TOO_LARGE = 'Error from S3 while uploading object. The object was too large. To upload objects larger than 5GB, use the S3 console (160GB max) or the multipart upload API (5TB max).',
}

export type S3UploaderConfig = {
  accessKeyId: string
  bucketName: string
  endpoint: string
  region: string
  secretAccessKey: string
}

type S3UploaderConstructorParams = {
  asset: string
  cloudFile: CloudFile
  s3Config: S3UploaderConfig
}

export class S3Uploader {
  asset: string
  cloudFile: CloudFile
  s3Config: S3UploaderConfig

  constructor({asset, cloudFile, s3Config}: S3UploaderConstructorParams) {
    this.cloudFile = cloudFile
    this.asset = asset
    this.s3Config = s3Config
  }

  generateRemotePath(): string {
    if (!this.cloudFile.resourceType) {
      throw new Error('S3Uploader#generateRemotePath requires CloudFile.resourceType to be set')
    }

    return `${this.cloudFile.resourceType}/${this.md5AsFolders(this.cloudFile.remoteAttr.md5)}/${this.asset}`
  }

  md5AsFolders(md5: string): string {
    const upper = md5.toUpperCase() // Convert to uppercase
    const parts = upper.match(/.{2}|.+/g) // Match pairs of 2 characters, and if odd-length, the last leftover chunk
    return parts ? parts.join('/') : '' // Join with "/"
  }

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

    console.log(`Uploading to S3: ${this.cloudFile.localPathToFile} -> ${remotePathToFile}`)
    const putObjectCommand = new PutObjectCommand({
      ACL: 'public-read',
      Body: await readFile(this.cloudFile.localPathToFile as string),
      Bucket: this.s3Config.bucketName,
      Key: remotePathToFile,
    })

    try {
      const response = await s3Client.send(putObjectCommand)
      console.log(response)
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

    return this.validateRemoteMd5()
  }

  async validateRemoteMd5() {
    // async validateRemoteMd5(remotePathToFile: string, pathToFile: string, md5: string) {
    console.log('NEED TO IMPLEMENT: validateRemoteMd5')
    return true
  }
}
