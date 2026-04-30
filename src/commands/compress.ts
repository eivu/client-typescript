import {ComicProcessor} from '@eivu/ts-comic-compress/dist/processor'
import {Args, Command, Flags} from '@oclif/core'
import * as fs from 'fs-extra'
import {statSync} from 'node:fs'
import {dirname, join} from 'node:path'
import * as path from 'path'

export default class Compress extends Command {
  static override args = {
    pathArg: Args.string({description: 'path to file or folder with files to compress'}),
  }
  static override description = 'compress files before uploading to the cloud'
  static override examples = ['<%= config.bin %> <%= command.id %>']
  static override flags = {
    moveOriginal: Flags.boolean({
      char: 'm',
      default: false,
      description: 'move original files to a "done" subdirectory after successful compression',
    }),
    outputDir: Flags.string({char: 'o', description: 'output directory for compressed files'}),
    parallel: Flags.boolean({
      char: 'p',
      default: false,
      description: 'run in parallel, utilizing all computing resources',
    }),
    quality: Flags.integer({char: 'q', default: 75, description: 'quality to use for the webp files (0-100)'}),
    recursive: Flags.boolean({
      char: 'r',
      default: false,
      description: 'recursively traverse the input folder (include all subfolders)',
    }),
    renameOriginal: Flags.boolean({
      char: 'n',
      default: false,
      description: 'rename original files to *_original instead of copying',
    }),
    skipExisting: Flags.boolean({
      char: 's',
      default: false,
      description: 'skip processing file if it already exists in the output folder',
    }),
    targetHeight: Flags.integer({
      char: 'h',
      description: 'target height for images (maintains aspect ratio). If not specified, images are not resized',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Compress)

    const {pathArg} = args
    const {
      moveOriginal,
      outputDir: outputDirFlag,
      parallel,
      quality,
      recursive,
      renameOriginal,
      skipExisting,
      targetHeight,
    } = flags

    if (!pathArg) {
      this.log('Please provide a path to a file or folder to compress.')
      return
    }

    // if no output directory is specified, default to a "converted" subfolder
    // alongside the input — using the file's parent dir if path is a file, or
    // the path itself if it's a directory (e.g. path/to/File/xyz.cbr → path/to/File/converted)
    let outputDir: string
    if (outputDirFlag) {
      outputDir = outputDirFlag
    } else {
      const baseDir = statSync(pathArg).isFile() ? dirname(pathArg) : pathArg
      outputDir = join(baseDir, 'converted')
    }

    try {
      const inputPath = path.resolve(pathArg)

      const processor = new ComicProcessor({
        moveOriginal,
        outputDir,
        parallel,
        quality,
        recursive,
        renameOriginal,
        skipExisting,
        targetHeight,
      })

      if (!(await fs.pathExists(inputPath))) {
        logger.error(`Input path does not exist: ${inputPath}`)
        process.exit(1)
      }

      const stats = await fs.stat(inputPath)

      if (stats.isFile()) {
        await processor.processFile(inputPath)
      } else if (stats.isDirectory()) {
        await processor.processDirectory(inputPath)
      } else {
        // logger.error(`Input path is neither a file nor a directory: ${inputPath}`)
      }

      processor.printSummary()
    } catch (error) {
      // logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      // if (error instanceof Error && error.stack) {
      //   logger.error(error.stack);
      // }
      return
    }
  }
}
