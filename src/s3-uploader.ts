import {PutObjectCommand, S3Client, S3ServiceException} from '@aws-sdk/client-s3'
import {CloudFile} from '@src/cloud-file'
import {readFile} from 'node:fs/promises'

interface Config {
  bucketName: string
}

enum TransferErrorMessages {
  ENTITY_TOO_LARGE = 'Error from S3 while uploading object. The object was too large. To upload objects larger than 5GB, use the S3 console (160GB max) or the multipart upload API (5TB max).',
}
export class S3Uploader {
  asset: string
  cloudFile: CloudFile

  constructor({asset, cloudFile}: {asset: string; cloudFile: CloudFile}) {
    this.cloudFile = cloudFile
    this.asset = asset
  }

  generateRemotePath(): string {
    return `${this.cloudFile.resourceType}/${this.md5AsFolders(this.cloudFile.attr.md5)}/${this.asset}`
  }

  md5AsFolders(md5: string): string {
    return `${md5.slice(0, 2)}/${md5.slice(2, 4)}/${md5.slice(4, 6)}/${md5.slice(6)}`
  }

  async putLocalFile(): Promise<boolean> {
    if (!process.env.AWS_REGION) {
      throw new Error('AWS_REGION environment variable is not set')
    }

    if (!process.env.AWS_S3_BUCKET_NAME) {
      throw new Error('AWS_S3_BUCKET_NAME environment variable is not set')
    }

    const s3Client = new S3Client({region: process.env.AWS_REGION as string})
    const remotePathToFile = this.generateRemotePath()
    const bucketName = process.env.AWS_S3_BUCKET_NAME as string

    const putObjectCommand = new PutObjectCommand({
      ACL: 'public-read',
      Body: await readFile(this.cloudFile.localPathToFile as string),
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: remotePathToFile,
    })

    try {
      const response = await s3Client.send(putObjectCommand)
      console.log(response)
    } catch (error) {
      if (error instanceof S3ServiceException && error.name === 'EntityTooLarge') {
        console.error(TransferErrorMessages.ENTITY_TOO_LARGE)
      } else if (error instanceof S3ServiceException) {
        console.error(`Error from S3 while uploading object to ${bucketName}.  ${error.name}: ${error.message}`)
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
