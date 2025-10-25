import {CloudFile} from '@src/cloud-file'
import logger from '@src/logger'
import {generateDataProfile, MetadataPair} from '@src/metadata-extraction'
import {S3Uploader, S3UploaderConfig} from '@src/s3-uploader'
import {cleansedAssetName, isOnline} from '@src/utils'
import * as fs from 'node:fs/promises'

/**
 * Client for managing file uploads to the cloud storage service
 * Handles file validation, reservation, transfer, and status tracking
 */
export class Client {
  status = {
    failure: {},
    success: {},
  }

  static async uploadFile({
    metadataList,
    pathToFile,
  }: {
    metadataList?: MetadataPair[]
    pathToFile: string
  }): Promise<CloudFile> {
    const client = new Client()
    return client.upload({metadataList, pathToFile})
  }

  /**
   * Uploads a file to cloud storage
   * Validates the file, reserves a slot, and transfers the file to S3
   * @param pathToFile - Path to the local file to upload
   * @returns The CloudFile instance representing the uploaded file
   * @throws Error if the file is empty or upload fails
   */
  async upload({metadataList, pathToFile}: {metadataList?: MetadataPair[]; pathToFile: string}): Promise<CloudFile> {
    if (await this.isEmptyFile(pathToFile)) {
      throw new Error(`Can not upload empty file: ${pathToFile}`)
    }

    const asset = cleansedAssetName(pathToFile)
    logger.info(`Fetching/Reserving: ${asset}`)
    let cloudFile = await CloudFile.fetchOrReserveBy({pathToFile})
    cloudFile.remoteAttr.asset = asset
    await this.processTransfer({asset, cloudFile})

    const dataProfile = await generateDataProfile({metadataList, pathToFile})

    if (cloudFile.transfered()) {
      logger.info('Completing')
      cloudFile = await cloudFile.complete(dataProfile)
    } else {
      logger.info('Updating/Skipping')
      cloudFile = await cloudFile.updateMetadata(dataProfile)
    }

    return cloudFile
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
   * @param params.cloudFile - The CloudFile instance to transfer
   * @returns The updated CloudFile instance after transfer
   * @throws Error if the CloudFile is not in reserved state or localPathToFile is not set
   * @private
   */
  private async processTransfer({asset, cloudFile}: {asset: string; cloudFile: CloudFile}): Promise<CloudFile> {
    if (!cloudFile.reserved()) {
      logger.info(`CloudFile#processTransfer requires CloudFile to be in reserved state: ${cloudFile.remoteAttr.state}`)
      return cloudFile
    }

    if (!cloudFile.localPathToFile) {
      throw new Error("CloudFile#processTransfer requires CloudFile's localPathToFile to be set")
    }

    logger.info(`Processing Transfer: ${cloudFile.localPathToFile}`)

    cloudFile.identifyContentType()
    logger.info(`Determined resourceType: ${cloudFile.resourceType}`)
    const stats = await fs.stat(cloudFile.localPathToFile as string)
    const filesize = stats.size

    logger.info(`filesize: ${filesize}`)
    const s3Config: S3UploaderConfig = {
      accessKeyId: process.env.EIVU_ACCESS_KEY_ID as string,
      bucketName: process.env.EIVU_BUCKET_NAME as string,
      endpoint: process.env.EIVU_ENDPOINT as string,
      region: process.env.EIVU_REGION as string,
      secretAccessKey: process.env.EIVU_SECRET_ACCESS_KEY as string,
    }

    const s3Uploader = new S3Uploader({cloudFile, s3Config})
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
