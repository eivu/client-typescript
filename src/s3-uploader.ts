import {PutObjectCommand, S3Client} from '@aws-sdk/client-s3'
import {CloudFile} from '@src/cloud-file'
import {promises as fs} from 'node:fs'

interface Config {
  bucketName: string
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

  async putFile(): Promise<Boolean> {
    const s3Client = new S3Client({region: process.env.AWS_REGION || 'us-east-1'})
    const configuration: Config = {
      bucketName: 'your-bucket-name',
    }
    const remotePathToFile = this.generateRemotePath()

    const logTag = `${this.cloudFile.attr.md5.slice(0, 5)}:${this.asset}`
    console.info('Writing to S3', {tags: logTag})

    const fileStream = fs.createReadStream(this.cloudFile.localPathToFile as string)

    await s3Client.send(
      new PutObjectCommand({
        ACL: 'public-read',
        Bucket: configuration.bucketName,
        Key: remotePathToFile,
        Body: fileStream,
      }),
    )

    return this.validateRemoteMd5()
  }

  async validateRemoteMd5() {
    // async validateRemoteMd5(remotePathToFile: string, pathToFile: string, md5: string) {
    console.log('NEED TO IMPLEMENT: validateRemoteMd5')
    return true
  }
}
