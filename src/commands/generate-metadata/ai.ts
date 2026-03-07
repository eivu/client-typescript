import {Args, Command, Flags} from '@oclif/core'
import {MetadataGenerator} from '@src/ai/metadata-generator'
import * as fs from 'node:fs'
import path from 'node:path'

function collectFilesInDir(
  dirPath: string,
  recursive: boolean,
  pathsToSkip: Set<string>,
  out: string[],
): void {
  const entries = fs.readdirSync(dirPath, {withFileTypes: true})
  for (const ent of entries) {
    if (pathsToSkip.has(ent.name)) continue
    const fullPath = path.join(dirPath, ent.name)
    if (ent.isFile()) {
      out.push(fullPath)
    } else if (ent.isDirectory() && recursive) {
      collectFilesInDir(fullPath, recursive, pathsToSkip, out)
    }
  }
}

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
    recursive: Flags.boolean({char: 'r', description: 'when path is a folder, include files in all subdirectories'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(GenerateMetadataAi)
    const {path} = args
    const recursive = flags.recursive ?? false
    let pathsArray: string[]
    const overwrite = false
    const pathsToSkip = new Set<string>([
      '.bzr', '.DS_Store', '.env', '.env.development.local', '.env.local',
      '.env.production.local', '.env.test.local', '.git', '.hg', '.idea', '.svn', '.vscode',
    ])

    if (!path) {
      this.log('Please provide a path to a file or folder to generate metadata for.')
      return
    }

    if (fs.existsSync(path)) {
      const stats = fs.statSync(path)
      if (stats.isFile()) {
        pathsArray = [path]
      } else if (stats.isDirectory()) {
        pathsArray = []
        collectFilesInDir(path, recursive, pathsToSkip, pathsArray)
        if (pathsArray.length === 0) {
          this.log('No files found in folder.')
          return
        }
      } else {
        this.log('Path is neither a file nor a directory.')
        return
      }
    } else {
      this.log('Path does not exist, please provide a path to a file or folder to generate metadata for.')
      return
    }

    await MetadataGenerator.generate(pathsArray, {
      agent: 'claude',
      apiKey: process.env.ANTHROPIC_API_KEY,
      overwrite,
    })
  }
}
