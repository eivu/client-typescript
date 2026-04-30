import {ComicProcessor} from '@eivu/ts-comic-compress/dist/processor'
import {Args, Command, Flags} from '@oclif/core'

export default class Compress extends Command {
  static override args = {
    path: Args.string({description: 'path to file or folder with files to compress'}),
  }
  static override description = 'compress files before uploading to the cloud'
  static override examples = ['<%= config.bin %> <%= command.id %>']
  static override flags = {
    outputDir: Flags.string({char: 'o', description: 'output directory for compressed files'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Compress)

    const {path} = args
    const {outputDir} = flags

    if (!path) {
      this.log('Please provide a path to a file or folder to compress.')
      return
    }
    
  }
}
