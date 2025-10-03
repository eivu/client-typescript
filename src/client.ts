import {CloudFile} from '@src/cloud-file'
import {S3Uploader, S3UploaderConfig} from '@src/s3-uploader'
import {cleansedAssetName} from '@src/utils'
import {promises as fs} from 'node:fs'

export class Client {
  status = {
    failure: {},
    success: {},
  }

  async upload(pathToFile: string): Promise<CloudFile> {
    if (await this.isEmptyFile(pathToFile)) {
      throw new Error(`Can not upload empty file: ${pathToFile}`)
    }

    const asset = cleansedAssetName(pathToFile)
    console.log(`Fetching/Reserving: ${asset}`)
    const cloudFile = await CloudFile.fetchOrReserveBy({pathToFile})
    await this.processTransfer({asset, cloudFile})

    //  def upload_file(pathToFile:, peepy: false, nsfw: false, override: {}, metadata_list: [])
    //     process_reservation_and_transfer(cloud_file:, pathToFile:, md5:, asset:)

    //     # Generate remote URL and raise error if file offline
    //     if Utils.online?(cloud_file.url, File.size(pathToFile)) == false
    //       cloud_file.reset # set state back to reserved
    //       raise "File #{md5}:#{asset} is offline/filesize mismatch"
    //     end

    //     if cloud_file.transfered?
    //       Eivu::Logger.info 'Completing', tags: log_tag, label: Eivu::Client
    //       cloud_file.complete!(data_profile)
    //     else
    //       Eivu::Logger.info 'Updating/Skipping', tags: log_tag, label: Eivu::Client
    //       cloud_file.update_metadata!(data_profile)
    //     end

    //     cloud_file
    //   end
    return cloudFile
  }

  private async isEmptyFile(pathToFile: string): Promise<boolean> {
    try {
      const stats = await fs.stat(pathToFile)
      return stats.size === 0
    } catch {
      return false
    }
  }

  private async processTransfer({asset, cloudFile}: {asset: string; cloudFile: CloudFile}): Promise<CloudFile> {
    if (!cloudFile.reserved()) {
      console.log(`CloudFile#processTransfer requires CloudFile to be in reserved state: ${cloudFile.remoteAttr.state}`)
      return cloudFile
    }

    if (!cloudFile.localPathToFile) {
      throw new Error("CloudFile#processTransfer requires CloudFile's localPathToFile to be set")
    }

    console.log(`Processing Transfer: ${cloudFile.localPathToFile}`)

    cloudFile.identifyContentType()
    console.log(`Determined resourceType: ${cloudFile.resourceType}`)
    const stats = await fs.stat(cloudFile.localPathToFile as string)
    const filesize = stats.size

    console.log(`filesize: ${filesize}`)
    const s3Config: S3UploaderConfig = {
      accessKeyId: process.env.EIVU_ACCESS_KEY_ID as string,
      bucketName: process.env.EIVU_BUCKET_NAME as string,
      endpoint: process.env.EIVU_ENDPOINT as string,
      region: process.env.EIVU_REGION as string,
      secretAccessKey: process.env.EIVU_SECRET_ACCESS_KEY as string,
    }

    const s3Uploader = new S3Uploader({asset, cloudFile, s3Config})
    if (!(await s3Uploader.putLocalFile())) {
      throw new Error(`Failed to upload file to S3: ${cloudFile.localPathToFile}`)
    }

    return cloudFile.transfer({asset, filesize})
  }
}
