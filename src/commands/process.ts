import {Args, Command, Flags} from '@oclif/core'
import {withNoSleep} from '@src/no-sleep'
import {
  type OnCompressError,
  type ProcessOptions,
  ProcessOrchestrator,
  type ProcessResult,
} from '@src/process-orchestrator'

/** The subset of parsed `process` flags consumed by {@link buildProcessOptions}. */
export type ProcessFlags = {
  compress: boolean
  concurrency: number
  dedup: boolean
  'keep-awake': boolean
  'keep-originals': boolean
  metadata: boolean
  nsfw?: boolean
  'on-compress-error': string
  overwrite: boolean
  quality: number
  'raise-exception': boolean
  recursive: boolean
  secured?: boolean
  sync: boolean
  'target-height'?: number
  upload: boolean
}

/**
 * Maps parsed CLI flags onto {@link ProcessOptions}, renaming the hyphenated flag
 * names to their camelCase option names and applying the `secured → nsfw` implication
 * (mirrors `eivu upload`). Pure + exported so it can be unit-tested without oclif.
 */
export function buildProcessOptions(flags: ProcessFlags, apiKey?: string): ProcessOptions {
  const secured = flags.secured ?? false
  const nsfw = secured || (flags.nsfw ?? false)
  return {
    apiKey,
    compress: flags.compress,
    concurrency: flags.concurrency,
    dedup: flags.dedup,
    keepOriginals: flags['keep-originals'],
    metadata: flags.metadata,
    nsfw,
    onCompressError: flags['on-compress-error'] as OnCompressError,
    overwrite: flags.overwrite,
    quality: flags.quality,
    raiseException: flags['raise-exception'],
    recursive: flags.recursive,
    secured,
    sync: flags.sync,
    targetHeight: flags['target-height'],
    upload: flags.upload,
  }
}

/**
 * Renders the one-line run summary, including the `reused`, `duplicate(s) archived`,
 * `dropped on compress error`, and `metadata failed` clauses only when those counts are
 * non-zero. The `metadata failed` count is the number of targets held back from upload
 * because their `.eivu.yml` generation errored. Pure + exported for unit testing.
 */
export function formatProcessSummary(result: ProcessResult): string {
  const metadataFailed = result.metadataResults?.filter((r) => r.status === 'error').length ?? 0
  return (
    `Processed ${result.discovered} file(s): ${result.compressed.length} compressed, ` +
    (result.reused.length > 0 ? `${result.reused.length} reused, ` : '') +
    `${result.targets.length} target(s)` +
    (result.duplicatesArchived.length > 0 ? `, ${result.duplicatesArchived.length} duplicate(s) archived` : '') +
    (result.droppedOnError.length > 0 ? `, ${result.droppedOnError.length} dropped on compress error` : '') +
    (metadataFailed > 0 ? `, ${metadataFailed} metadata failed (not uploaded)` : '') +
    '.'
  )
}

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
    dedup: Flags.boolean({
      allowNo: true,
      default: true,
      description: 'de-duplicate identical files by content md5 (compress/metadata/upload each once)',
    }),
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
    sync: Flags.boolean({
      allowNo: true,
      default: true,
      description:
        'query Claude synchronously (blocking, faster) for metadata; --no-sync uses the cheaper delayed Batches API',
    }),
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

    const orchestrator = new ProcessOrchestrator(buildProcessOptions(flags, process.env.ANTHROPIC_API_KEY))

    const result = await withNoSleep(flags['keep-awake'], 'eivu process', () => orchestrator.run(inputPath))

    this.log(formatProcessSummary(result))
  }
}
