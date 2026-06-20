import type {GenerationResult} from '@src/ai/types'

import {MetadataGenerator} from '@src/ai/metadata-generator'
import {Client} from '@src/client'
import {isComicArchivePath} from '@src/comic-archive-path'
import {COMPRESSED_INFIX, SKIPPABLE_EXTENSIONS, SKIPPABLE_FOLDERS} from '@src/constants'
import logger from '@src/logger'
import {isEivuYmlFile} from '@src/utils'
import fsExtra from 'fs-extra'
import {existsSync, readdirSync, statSync} from 'node:fs'
import path from 'node:path'

/** What to do with a comic that fails the compression stage. */
export type OnCompressError = 'skip' | 'upload-original'

/** Options controlling a `ProcessOrchestrator` run. */
export type ProcessOptions = {
  /** Anthropic API key for the metadata stage (read from env by the command). */
  apiKey?: string
  /** Run the compress stage (default true). When false, every file uses its original as the target. */
  compress?: boolean
  /** Max concurrent uploads in the upload stage (default 3). */
  concurrency?: number
  /** Skip moving the original into `eivu_originals/` after a successful compress (default false). */
  keepOriginals?: boolean
  /** Run the metadata stage (default true). */
  metadata?: boolean
  /** Mark uploaded files NSFW (default false). */
  nsfw?: boolean
  /** Behavior when a comic fails to compress (default 'upload-original'). */
  onCompressError?: OnCompressError
  /** Regenerate `.eivu.yml` even when one already exists (default false). */
  overwrite?: boolean
  /** Quality (0-100) passed to the compressor (default 75). */
  quality?: number
  /** Throw/treat-as-failure when the compressor skips an oversized image (default true). */
  raiseException?: boolean
  /** Recurse into subfolders when the input is a folder (default true). */
  recursive?: boolean
  /** Mark uploaded files secured — implies NSFW (default false). */
  secured?: boolean
  /** Optional target image height passed to the compressor (no resize when unset). */
  targetHeight?: number
  /** Run the upload stage (default true). */
  upload?: boolean
}

/** Summary returned by `ProcessOrchestrator.run`. */
export type ProcessResult = {
  /** Files successfully compressed this run (their compressed output is the target). */
  compressed: string[]
  /** Total files discovered for processing. */
  discovered: number
  /** Files dropped because they failed to compress and `onCompressError` is 'skip'. */
  droppedOnError: string[]
  /** Per-file metadata results (only when the metadata stage ran). */
  metadataResults?: GenerationResult[]
  /** The curated list of files handed to the metadata + upload stages. */
  targets: string[]
  /** Per-file upload status messages (only when the upload stage ran). */
  uploadMessages?: string[]
}

/** Directory names always skipped during discovery, in addition to {@link SKIPPABLE_FOLDERS}. */
const JUNK_DIR_NAMES = new Set(['.bzr', '.DS_Store', '.git', '.hg', '.idea', '.svn', '.vscode'])

/**
 * Computes the compressed output path `@eivu/ts-comic-compress` produces for a `.cbr`/`.cbz` when run
 * non-recursively with `outputDir = dirname(file)` — i.e. `<dir>/<name>.eivu_compressed<ext>`. Mirrors
 * the library's `ComicProcessor.getOutputPath` naming via the shared {@link COMPRESSED_INFIX} constant.
 */
export function compressedOutputPath(file: string): string {
  const ext = path.extname(file)
  const base = path.basename(file, ext)
  return path.join(path.dirname(file), `${base}${COMPRESSED_INFIX}${ext}`)
}

/** True for a comic archive that was already produced by the compressor (`*.eivu_compressed.cbz/.cbr`). */
export function isAlreadyCompressed(file: string): boolean {
  const lower = file.toLowerCase()
  return lower.endsWith(`${COMPRESSED_INFIX}.cbz`) || lower.endsWith(`${COMPRESSED_INFIX}.cbr`)
}

/**
 * Orchestrates the three subsystems (compress → generate-metadata → upload) for a file or folder.
 *
 * Stage-by-stage: every file is first resolved to a single upload **target** (the compressed output
 * when a `.cbr`/`.cbz` compressed successfully, otherwise the original); then one batched metadata
 * call writes a sibling `.eivu.yml` per target; then the curated target list is uploaded. Because the
 * target list is explicit, an original that was compressed is never uploaded — no double-upload.
 */
export class ProcessOrchestrator {
  private readonly opts: Pick<ProcessOptions, 'apiKey' | 'targetHeight'> &
    Required<Omit<ProcessOptions, 'apiKey' | 'targetHeight'>>

  constructor(options: ProcessOptions = {}) {
    this.opts = {
      apiKey: options.apiKey,
      compress: options.compress ?? true,
      concurrency: options.concurrency ?? 3,
      keepOriginals: options.keepOriginals ?? false,
      metadata: options.metadata ?? true,
      nsfw: options.nsfw ?? false,
      onCompressError: options.onCompressError ?? 'upload-original',
      overwrite: options.overwrite ?? false,
      quality: options.quality ?? 75,
      raiseException: options.raiseException ?? true,
      recursive: options.recursive ?? true,
      secured: options.secured ?? false,
      targetHeight: options.targetHeight,
      upload: options.upload ?? true,
    }
  }

  /**
   * Runs the full pipeline for a single file or a folder.
   * @param inputPath - Local path to a media file or a folder of media files.
   * @returns A {@link ProcessResult} summary.
   */
  async run(inputPath: string): Promise<ProcessResult> {
    const resolved = path.resolve(inputPath)
    if (!existsSync(resolved)) {
      throw new Error(`Input path does not exist: ${inputPath}`)
    }

    const files = this.discover(resolved)
    logger.info(
      {compress: this.opts.compress, count: files.length, metadata: this.opts.metadata, upload: this.opts.upload},
      'process: discovered files',
    )

    const {compressed, droppedOnError, targets} = await this.compressStage(files)

    let metadataResults: GenerationResult[] | undefined
    if (this.opts.metadata && targets.length > 0) {
      logger.info({count: targets.length}, 'process: generating metadata')
      metadataResults = await MetadataGenerator.generate(targets, {
        agent: 'claude',
        apiKey: this.opts.apiKey,
        overwrite: this.opts.overwrite,
      })
    } else if (!this.opts.metadata) {
      logger.info('process: metadata stage skipped (--no-metadata)')
    }

    let uploadMessages: string[] | undefined
    if (this.opts.upload && targets.length > 0) {
      logger.info({count: targets.length}, 'process: uploading')
      uploadMessages = await Client.uploadFiles({
        concurrency: this.opts.concurrency,
        filePaths: targets,
        nsfw: this.opts.nsfw,
        secured: this.opts.secured,
      })
    } else if (!this.opts.upload) {
      logger.info('process: upload stage skipped (--no-upload)')
    }

    logger.info(
      {compressed: compressed.length, discovered: files.length, dropped: droppedOnError.length, targets: targets.length},
      'process: complete',
    )

    return {compressed, discovered: files.length, droppedOnError, metadataResults, targets, uploadMessages}
  }

  /**
   * Compresses one comic in place via `@eivu/ts-comic-compress`, writing
   * `<dir>/<name>.eivu_compressed<ext>`. Extracted as a `protected` seam so tests can simulate
   * compression success/failure without driving real (slow) image conversion.
   */
  protected async runCompressor(file: string): Promise<void> {
    // Lazy import keeps the heavy compressor dependency graph (sharp, unrar, chalk) out of the
    // module load path unless compression actually runs — tests override this method entirely.
    const {ComicProcessor} = await import('@eivu/ts-comic-compress/processor')
    const processor = new ComicProcessor({
      moveOriginal: false, // the orchestrator does its own move into eivu_originals/
      outputDir: path.dirname(file),
      parallel: false,
      quality: this.opts.quality,
      raiseException: this.opts.raiseException,
      recursive: false,
      renameOriginal: false,
      skipExisting: false,
      targetHeight: this.opts.targetHeight,
    })
    await processor.processFile(file)
  }

  /** Moves a successfully-compressed original into a sibling `eivu_originals/` folder. */
  private async archiveOriginal(file: string): Promise<void> {
    const archiveDir = path.join(path.dirname(file), 'eivu_originals')
    const dest = path.join(archiveDir, path.basename(file))
    await fsExtra.ensureDir(archiveDir)
    await fsExtra.move(file, dest, {overwrite: true})
    logger.info({dest, file}, 'process: archived original')
  }

  /**
   * The compress stage. Resolves every discovered file to a single upload target, compressing
   * eligible comics in place and archiving their originals. Runs sequentially because compression
   * is CPU-bound.
   */
  private async compressStage(files: string[]): Promise<{
    compressed: string[]
    droppedOnError: string[]
    targets: string[]
  }> {
    const targets: string[] = []
    const compressed: string[] = []
    const droppedOnError: string[] = []

    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop -- compression is CPU-bound; keep it sequential
      const outcome = await this.resolveTarget(file)
      if (outcome.target === undefined) {
        droppedOnError.push(file)
        continue
      }

      targets.push(outcome.target)
      if (outcome.compressed) compressed.push(file)
    }

    return {compressed, droppedOnError, targets}
  }

  /** Recursively collects processable files, skipping yml, junk dirs/extensions, and skip-folders. */
  private discover(resolved: string): string[] {
    if (statSync(resolved).isFile()) {
      return [resolved]
    }

    const out: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, {withFileTypes: true})) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (!this.opts.recursive) continue
          if (JUNK_DIR_NAMES.has(entry.name) || SKIPPABLE_FOLDERS.includes(entry.name)) continue
          walk(fullPath)
        } else if (entry.isFile()) {
          if (isEivuYmlFile(entry.name)) continue
          const lower = entry.name.toLowerCase()
          if (SKIPPABLE_EXTENSIONS.some((ext) => lower.endsWith(`.${ext}`))) continue
          out.push(fullPath)
        }
      }
    }

    walk(resolved)
    return out
  }

  /**
   * Resolves a single file to its upload target.
   * @returns `{target}` to upload that path; `{target, compressed: true}` when it was just compressed;
   *          `{target: undefined}` when the file was dropped (compress failed + `onCompressError: 'skip'`).
   */
  private async resolveTarget(file: string): Promise<{compressed?: boolean; target: string | undefined}> {
    // Not a compressible comic → the original is the target.
    if (!this.opts.compress || !isComicArchivePath(file) || isAlreadyCompressed(file)) {
      return {target: file}
    }

    const outputPath = compressedOutputPath(file)
    let threw = false
    try {
      await this.runCompressor(file)
    } catch (error) {
      threw = true
      logger.warn({error: error instanceof Error ? error.message : String(error), file}, 'process: compression threw')
    }

    const succeeded = !threw && existsSync(outputPath)
    if (succeeded) {
      if (!this.opts.keepOriginals) {
        await this.archiveOriginal(file)
      }

      return {compressed: true, target: outputPath}
    }

    // Compression failed — apply the on-error policy.
    if (this.opts.onCompressError === 'skip') {
      logger.warn({file}, 'process: compression failed, dropping file (--on-compress-error=skip)')
      return {target: undefined}
    }

    logger.warn({file}, 'process: compression failed, uploading original (--on-compress-error=upload-original)')
    return {target: file}
  }
}
