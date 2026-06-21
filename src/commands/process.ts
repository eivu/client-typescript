import {Args, Command, Flags} from '@oclif/core'
import {withNoSleep} from '@src/no-sleep'
import {type OnCompressError, ProcessOrchestrator} from '@src/process-orchestrator'

export default class Process extends Command {
  static override args = {
    path: Args.string({description: 'path to a file or folder to process (compress → metadata → upload)'}),
  }
  static override description =
    'Run a file or folder through the full pipeline: compress comics (.cbr/.cbz), generate .eivu.yml metadata, then upload.'
  static override examples = [
    '<%= config.bin %> <%= command.id %> ./comics',
    '<%= config.bin %> <%= command.id %> ./comics --no-metadata',
    '<%= config.bin %> <%= command.id %> ./book.cbz --on-compress-error skip',
  ]
  static override flags = {
    compress: Flags.boolean({allowNo: true, default: true, description: 'compress eligible .cbr/.cbz files'}),
    concurrency: Flags.integer({default: 3, description: 'max concurrent uploads'}),
    'keep-awake': Flags.boolean({
      allowNo: true,
      default: true,
      description: 'prevent the system from sleeping during the run',
    }),
    'keep-originals': Flags.boolean({
      default: false,
      description: 'leave originals in place instead of moving them to eivu_originals/',
    }),
    metadata: Flags.boolean({allowNo: true, default: true, description: 'generate .eivu.yml metadata'}),
    nsfw: Flags.boolean({char: 'n', description: 'mark uploaded files as NSFW'}),
    'on-compress-error': Flags.string({
      default: 'upload-original',
      description: 'what to do when a comic fails to compress',
      options: ['upload-original', 'skip'],
    }),
    overwrite: Flags.boolean({char: 'f', default: false, description: 'regenerate .eivu.yml even if one exists'}),
    quality: Flags.integer({char: 'q', default: 75, description: 'webp quality for compression (0-100)'}),
    'raise-exception': Flags.boolean({
      allowNo: true,
      default: true,
      description: 'treat a skipped oversized image as a compression failure',
    }),
    recursive: Flags.boolean({allowNo: true, char: 'r', default: true, description: 'recurse into subfolders'}),
    secured: Flags.boolean({char: 's', description: 'mark uploaded files as secured (implies nsfw)'}),
    'target-height': Flags.integer({
      char: 't',
      description: 'target image height for compression (maintains aspect ratio; no resize if unset)',
    }),
    upload: Flags.boolean({allowNo: true, default: true, description: 'upload the resulting files'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Process)
    const {path: inputPath} = args

    if (!inputPath) {
      this.log('Please provide a path to a file or folder to process.')
      return
    }

    // Mirror `upload`: secured implies nsfw.
    const securedValue = flags.secured ?? false
    const nsfwValue = securedValue || (flags.nsfw ?? false)

    const orchestrator = new ProcessOrchestrator({
      apiKey: process.env.ANTHROPIC_API_KEY,
      compress: flags.compress,
      concurrency: flags.concurrency,
      keepOriginals: flags['keep-originals'],
      metadata: flags.metadata,
      nsfw: nsfwValue,
      onCompressError: flags['on-compress-error'] as OnCompressError,
      overwrite: flags.overwrite,
      quality: flags.quality,
      raiseException: flags['raise-exception'],
      recursive: flags.recursive,
      secured: securedValue,
      targetHeight: flags['target-height'],
      upload: flags.upload,
    })

    const result = await withNoSleep(flags['keep-awake'], 'eivu process', () => orchestrator.run(inputPath))

    this.log(
      `Processed ${result.discovered} file(s): ${result.compressed.length} compressed, ` +
        `${result.targets.length} target(s)` +
        (result.droppedOnError.length > 0 ? `, ${result.droppedOnError.length} dropped on compress error` : '') +
        '.',
    )
  }
}
