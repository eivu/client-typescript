import {Args, Command, Flags} from '@oclif/core'

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
    nsfw = nsfw ?? false
    secured = secured ?? false
    filename = filename ?? undefined

    const name = flags.name ?? 'world'
    this.log(`hello ${name} from /Users/jinx/projects/eivu/client-typescript/src/commands/upload.ts`)
    if (args.path && flags.force) {
      this.log(`you input --force and --path: ${args.path}`)
    }
  }
}
