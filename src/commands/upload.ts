import {Args, Command, Flags} from '@oclif/core'
import {Client} from '@src/client'
import {isOnline, IsOnlineResult} from '@src/utils'
import * as fs from 'node:fs'

export default class Upload extends Command {
  static override args = {
    path: Args.string({description: 'path to file or folder or url to upload to the cloud'}),
  }
  static override description = 'describe the command here'
  static override examples = ['<%= config.bin %> <%= command.id %>']
  static override flags = {
    filename: Flags.string({char: 'f', description: 'filename to use when uploading remote files'}),
    nsfw: Flags.boolean({char: 'n', description: 'whether to mark the uploaded file as NSFW'}),
    secured: Flags.boolean({char: 's', description: 'whether to secure the uploaded file'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Upload)
    const {nsfw, secured, filename} = flags
    const {path} = args
    const securedValue = secured ?? false
    const nsfwValue = secured ?? nsfw ?? false
    const filenameValue = filename ?? undefined

    if (!path) {
      this.log('Please provide a path to a file, folder, or URL to upload.')
      return
    }

    const defaultArguments = {
      nsfw: nsfwValue,
      secured: securedValue,
    }

    if (fs.existsSync(path)) {
      const stats = fs.statSync(path)
      if (stats.isFile()) {
        Client.uploadFile({
          pathToFile: path,
          ...defaultArguments,
        })
      } else if (stats.isDirectory()) {
        Client.uploadFolder({
          pathToFolder: path,
          ...defaultArguments,
        })
      }
    } else {
      let onlineCheck: IsOnlineResult
      try {
        onlineCheck = await isOnline(path)
      } catch {
        onlineCheck = {isOnline: false, remoteFilesize: null}
      }

      if (onlineCheck.isOnline) {
        Client.uploadRemoteFile({
          assetFilename: filenameValue,
          downloadUrl: path,
          ...defaultArguments,
        })
      } else {
        this.log(`A valid resource could not be found: ${path}`)
      }
    }

    // this.log('Upload command executed successfully.')
  }
}
