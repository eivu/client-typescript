import {Args, Command, Flags} from '@oclif/core'
import {MetadataGenerator} from '@src/ai/metadata-generator'
import * as fs from 'node:fs'

export default class GenerateMetadataAi extends Command {
  static override aliases = ['gm:ai']
  static override args = {
    path: Args.string({description: 'path to file or folder or url to generate metadata for'}),
  }
  // static override description = 'describe the command here'
  // static override examples = ['<%= config.bin %> <%= command.id %>']
  static override flags = {
    // flag with no value (-f, --force)
    force: Flags.boolean({char: 'f'}),
    // flag with a value (-n, --name=VALUE)
    name: Flags.string({char: 'n', description: 'name to print'}),
  }

  public async run(): Promise<void> {
    // const {args, flags} = await this.parse(GenerateMetadataAi)
    const {args} = await this.parse(GenerateMetadataAi)
    const {path} = args
    let pathsArray: string[]

    // const name = flags.name ?? 'world'
    // this.log(`hello ${name} from /Users/jinx/projects/eivu/client-typescript/src/commands/generate-metadata/ai.ts`)
    // if (args.file && flags.force) {
    //   this.log(`you input --force and --file: ${args.file}`)
    // }

    if (!path) {
      this.log('Please provide a path to a file or folder to generate metadata for.')
      return
    }

    if (fs.existsSync(path)) {
      const stats = fs.statSync(path)
      if (stats.isFile()) {
        pathsArray = [path]
      } else if (stats.isDirectory()) {
        this.log('folders not supported yet, please provide a path to a file')
        return
      } else {
        this.log('Path is neither a file nor a directory.')
        return
      }
    } else {
      this.log('Path does not exist, please provide a path to a file or folder to generate metadata for.')
      return
    }

    const results = await MetadataGenerator.generate(pathsArray, {
      agent: 'claude',
      apiKey: process.env.ANTHROPIC_API_KEY,
      overwrite: false,
    })
  }
}
