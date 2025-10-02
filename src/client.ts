import {CloudFile} from '@src/cloud-file'
import {S3Uploader} from '@src/s3-uploader'
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
    //     raise "Can not upload empty file: #{pathToFile}" if File.empty?(pathToFile)

    //     asset         = Utils.cleansed_asset_name(pathToFile)
    //     md5           = Eivu::Client::CloudFile.generate_md5(pathToFile)&.downcase
    //     log_tag       = "#{md5.first(5)}:#{asset}"
    //     data_profile  = Utils.generate_data_profile(pathToFile:, override:, metadata_list:)

    //     Eivu::Logger.info 'Fetching/Reserving', tags: log_tag, label: Eivu::Client
    //     cloud_file = CloudFile.reserve_or_fetch_by(bucket_uuid: configuration.bucket_uuid,
    //                                                pathToFile:, peepy:, nsfw:)

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

  private md5AsFolders(md5: string): string {
    const upper = md5.toUpperCase() // Convert to uppercase
    const parts = upper.match(/.{2}|.+/g) // Match pairs of 2 characters, and if odd-length, the last leftover chunk
    return parts ? parts.join('/') : '' // Join with "/"
  }

  private async processTransfer({asset, cloudFile}: {asset: string; cloudFile: CloudFile}): Promise<CloudFile> {
    if (!cloudFile.reserved()) {
      console.log(
        `CloudFile#processTransfer requires CloudFile to be in reserved state: ${cloudFile.remoteAttr.state}`,
      )
      return cloudFile
    }

    if (!cloudFile.localPathToFile) {
      throw new Error('CloudFile#processTransfer requires CloudFile\'localPathToFile to be set')
    }

    console.log(`Processing Transfer: ${cloudFile.localPathToFile}`)

    this.md5AsFolders(cloudFile.remoteAttr.md5)
    const stats = await fs.stat(cloudFile.localPathToFile as string)
    const filesize = stats.size

    const s3Uploader = new S3Uploader({asset, cloudFile})
    await s3Uploader.putFile()
    //   def process_reservation_and_transfer(cloud_file:, pathToFile:, md5:, asset:)
    //   return unless cloud_file.reserved?

    //   filesize = File.size(pathToFile)
    //   remote_pathToFile = Eivu::Client::Utils.generate_remote_path(cloud_file, pathToFile)

    //   log_tag = "#{md5.first(5)}:#{asset}"
    //   Eivu::Logger.info 'Writing to S3', tags: log_tag, label: Eivu::Client

    //   File.open(pathToFile, 'rb') do |file|
    //     s3_client.put_object(
    //       acl: 'public-read',
    //       bucket: configuration.bucket_name,
    //       key: remote_pathToFile, body: file
    //     )
    //   end

    //   validate_remote_md5!(remote_pathToFile:, pathToFile:, md5:)

    //   Eivu::Logger.info 'Transfering', tags: log_tag, label: Eivu::Client
    //   cloud_file.transfer!(asset:, filesize:)
    // end
    await cloudFile.transfer({asset, filesize})
    return cloudFile
  }
}
