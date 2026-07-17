import type {GenerationResult} from '@src/ai/types'

import {MetadataGenerator} from '@src/ai/metadata-generator'
import {Client} from '@src/client'
import {isComicArchivePath} from '@src/comic-archive-path'
import {COMPRESSED_INFIX, SKIPPABLE_EXTENSIONS, SKIPPABLE_FILENAMES, SKIPPABLE_FOLDERS} from '@src/constants'
import logger from '@src/logger'
import {generateMd5, isEivuYmlFile, validateFilePath} from '@src/utils'
import fsExtra from 'fs-extra'
import {existsSync, readdirSync, statSync} from 'node:fs'
import path from 'node:path'
import pLimit from 'p-limit'

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
  /** De-duplicate by content md5 so identical files are compressed/metadata'd/uploaded once (default true). */
  dedup?: boolean
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
  /**
   * Query Claude synchronously (blocking, faster) instead of the async Batches
   * API during the metadata stage (default true). `false` uses the ~50% cheaper
   * but delayed batch path.
   */
  sync?: boolean
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
  /** Byte-identical duplicate copies archived (to their dir's `eivu_originals/`) by the md5 dedup. */
  duplicatesArchived: string[]
  /** Per-file metadata results (only when the metadata stage ran). */
  metadataResults?: GenerationResult[]
  /** Comics whose already-existing compressed sibling was reused instead of recompressing. */
  reused: string[]
  /**
   * The curated (de-duplicated) list of files handed to the metadata stage. The upload stage
   * receives this list minus any target whose metadata generation ended in error (see
   * {@link ProcessResult.metadataResults}).
   */
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
      dedup: options.dedup ?? true,
      keepOriginals: options.keepOriginals ?? false,
      metadata: options.metadata ?? true,
      nsfw: options.nsfw ?? false,
      onCompressError: options.onCompressError ?? 'upload-original',
      overwrite: options.overwrite ?? false,
      quality: options.quality ?? 75,
      raiseException: options.raiseException ?? true,
      recursive: options.recursive ?? true,
      secured: options.secured ?? false,
      sync: options.sync ?? true,
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
    // Enforce the same path-safety perimeter as `eivu upload`: reject `..` traversal and paths that
    // escape the working directory before anything is discovered/compressed/archived/uploaded.
    // `allowDirectories` because the input may be a single file or a folder; existence is checked here too.
    const validated = validateFilePath(inputPath, {allowDirectories: true})
    const resolved = path.resolve(validated)

    const files = this.discover(resolved)
    logger.info(
      {compress: this.opts.compress, count: files.length, metadata: this.opts.metadata, upload: this.opts.upload},
      'process: discovered files',
    )

    const duplicatesArchived: string[] = []
    // md5 cache shared between Level A (discovered files) and Level B (targets), so passthrough targets
    // that were already hashed in Level A are not re-hashed.
    const md5ByPath = new Map<string, string>()

    // Level A — dedup byte-identical source files before compression (archive the redundant copies).
    let workset = files
    if (this.opts.dedup && files.length > 1) {
      const {duplicates, unique} = await this.dedupByMd5(files, md5ByPath)
      await Promise.all(duplicates.map((dup) => this.archiveOriginal(dup)))
      duplicatesArchived.push(...duplicates)
      workset = unique
    }

    const {compressed, droppedOnError, reused, targets} = await this.compressStage(workset)

    // Level B — dedup targets by md5 (unifies cross-dir original↔compressed twins, whose compressed
    // content shares an md5). Guarantees one metadata call + one upload per unique uploaded artifact.
    let uniqueTargets = targets
    if (this.opts.dedup && targets.length > 1) {
      const {duplicates, unique} = await this.dedupByMd5(targets, md5ByPath)
      await Promise.all(duplicates.map((dup) => this.archiveOriginal(dup)))
      duplicatesArchived.push(...duplicates)
      uniqueTargets = unique
    }

    let metadataResults: GenerationResult[] | undefined
    if (this.opts.metadata && uniqueTargets.length > 0) {
      logger.info({count: uniqueTargets.length}, 'process: generating metadata')
      metadataResults = await MetadataGenerator.generate(uniqueTargets, {
        agent: 'claude',
        apiKey: this.opts.apiKey,
        overwrite: this.opts.overwrite,
        sync: this.opts.sync,
      })
    } else if (!this.opts.metadata) {
      logger.info('process: metadata stage skipped (--no-metadata)')
    }

    // Hold back any target whose metadata generation ended in error before uploading. An errored
    // target has no freshly-written .eivu.yml (and, under --overwrite, may still have a stale one
    // on disk); uploading it would ship the asset as if metadata had succeeded. Targets that
    // succeeded, or were skipped because an existing .eivu.yml was left untouched, still upload.
    const uploadTargets = this.selectUploadTargets(uniqueTargets, metadataResults)

    let uploadMessages: string[] | undefined
    if (this.opts.upload && uploadTargets.length > 0) {
      logger.info({count: uploadTargets.length}, 'process: uploading')
      uploadMessages = await Client.uploadFiles({
        concurrency: this.opts.concurrency,
        filePaths: uploadTargets,
        nsfw: this.opts.nsfw,
        secured: this.opts.secured,
      })
    } else if (!this.opts.upload) {
      logger.info('process: upload stage skipped (--no-upload)')
    }

    logger.info(
      {
        compressed: compressed.length,
        discovered: files.length,
        dropped: droppedOnError.length,
        duplicates: duplicatesArchived.length,
        reused: reused.length,
        targets: uniqueTargets.length,
        uploaded: uploadTargets.length,
      },
      'process: complete',
    )

    return {
      compressed,
      discovered: files.length,
      droppedOnError,
      duplicatesArchived,
      metadataResults,
      reused,
      targets: uniqueTargets,
      uploadMessages,
    }
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
    reused: string[]
    targets: string[]
  }> {
    const targets: string[] = []
    const compressed: string[] = []
    const reused: string[] = []
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
      if (outcome.reused) reused.push(file)
    }

    // Dedup targets by path (preserving first occurrence). Two inputs can resolve to the SAME target —
    // e.g. an uncompressed comic reusing its existing compressed sibling, plus that sibling itself —
    // and the artifact must only be metadata-generated and uploaded once.
    const dedupedTargets = [...new Set(targets)]

    return {compressed, droppedOnError, reused, targets: dedupedTargets}
  }

  /**
   * De-duplicates a list of paths by **content md5**, preserving the first occurrence (over a sorted
   * order, so "first wins" is deterministic across runs). Hashing is bounded by `p-limit` and reuses
   * `md5Cache` (populated in place) so a path is never hashed twice. A path whose md5 can't be computed
   * (e.g. unreadable) is treated as unique — never silently dropped.
   * @returns `unique` (canonical paths, in sorted order) and `duplicates` (redundant byte-identical copies).
   */
  private async dedupByMd5(
    paths: string[],
    md5Cache: Map<string, string>,
  ): Promise<{duplicates: string[]; unique: string[]}> {
    const sorted = [...paths].sort()
    const limit = pLimit(this.opts.concurrency)
    await Promise.all(
      sorted.map((p) =>
        limit(async () => {
          if (md5Cache.has(p)) return
          try {
            md5Cache.set(p, await generateMd5(p))
          } catch (error) {
            logger.warn(
              {error: error instanceof Error ? error.message : String(error), file: p},
              'process: md5 hashing failed, treating file as unique',
            )
          }
        }),
      ),
    )

    const seen = new Map<string, string>() // md5 → first path
    const unique: string[] = []
    const duplicates: string[] = []
    for (const p of sorted) {
      const md5 = md5Cache.get(p)
      if (md5 === undefined) {
        unique.push(p) // hash failed → keep it rather than risk dropping a distinct file
        continue
      }

      if (seen.has(md5)) {
        logger.info({canonical: seen.get(md5), duplicate: p, md5}, 'process: duplicate content, archiving copy')
        duplicates.push(p)
      } else {
        seen.set(md5, p)
        unique.push(p)
      }
    }

    return {duplicates, unique}
  }

  /** Recursively collects processable files, skipping yml, junk dirs/extensions, and skip-folders. */
  private discover(resolved: string): string[] {
    if (statSync(resolved).isFile()) {
      // A directly-supplied file gets the same file-level skips as a folder-walk entry, so a
      // metadata YAML or junk sidecar can't slip past compression/metadata/upload just because it
      // was named explicitly (folder walks and gm:ai already reject these).
      if (this.isSkippableFile(path.basename(resolved))) {
        logger.warn(
          {file: resolved},
          'process: input file is not processable (.eivu.yml or skippable extension); nothing to do',
        )
        return []
      }

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
          if (this.isSkippableFile(entry.name)) continue
          out.push(fullPath)
        }
      }
    }

    walk(resolved)
    return out
  }

  /**
   * True when a file should be excluded from processing — an `.eivu.yml` sidecar, a dotenv/junk
   * basename ({@link SKIPPABLE_FILENAMES}), or a junk extension ({@link SKIPPABLE_EXTENSIONS}).
   * Skipping the `.env` family here mirrors `gm:ai` and stops secrets from being treated as an
   * upload target. Matched on the basename so the same rule applies
   * identically to an explicit single-file input and to each entry of a folder walk.
   */
  private isSkippableFile(name: string): boolean {
    if (isEivuYmlFile(name)) return true
    const lower = name.toLowerCase()
    if (SKIPPABLE_FILENAMES.some((fn) => fn.toLowerCase() === lower)) return true
    return SKIPPABLE_EXTENSIONS.some((ext) => lower.endsWith(`.${ext}`))
  }

  /**
   * Resolves a single file to its upload target.
   * @returns `{target}` to upload that path; `{target, compressed: true}` when it was just compressed;
   *          `{target: undefined}` when the file was dropped (compress failed + `onCompressError: 'skip'`).
   */
  private async resolveTarget(
    file: string,
  ): Promise<{compressed?: boolean; reused?: boolean; target: string | undefined}> {
    // Not a comic (or already a compressed artifact) → the original is the target.
    if (!isComicArchivePath(file) || isAlreadyCompressed(file)) {
      return {target: file}
    }

    const outputPath = compressedOutputPath(file)

    // The compressed sibling already exists (e.g. the folder holds both Foo.cbr and
    // Foo.eivu_compressed.cbr, or this is a re-run) → reuse it instead of recompressing. This avoids
    // clobbering an existing compressed file and wasting CPU, and keeps re-runs idempotent. It runs
    // even under --no-compress: without it, discovery would surface both the original and its
    // compressed twin as separate targets and the pipeline would upload the same work twice (the two
    // are not byte-identical, so md5 dedup can't collapse them). The redundant original is still
    // archived (unless --keep-originals).
    if (existsSync(outputPath)) {
      logger.info({file, outputPath}, 'process: compressed output already exists, reusing it (skipping compression)')
      if (!this.opts.keepOriginals) {
        await this.archiveOriginal(file)
      }

      return {reused: true, target: outputPath}
    }

    // Compression disabled and no existing compressed sibling → upload the original as-is.
    if (!this.opts.compress) {
      return {target: file}
    }

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

  /**
   * Narrows the curated target list to those safe to upload: every target except those whose
   * metadata generation ended in `error`. An errored target has no freshly-written `.eivu.yml`
   * (and, under `--overwrite`, may still carry a stale one), so uploading it would ship the asset
   * as if metadata had succeeded. Targets are matched by path against the per-file
   * {@link GenerationResult}s (whose `filePath` is the target path passed to the metadata stage).
   * When the metadata stage didn't run (`metadataResults` undefined) every target is kept, and a
   * target with no matching result is kept too (fail-open — only a proven error excludes it).
   * @returns the retained targets in their original order.
   */
  private selectUploadTargets(targets: string[], metadataResults: GenerationResult[] | undefined): string[] {
    if (!metadataResults) return targets

    const failed = new Set(metadataResults.filter((r) => r.status === 'error').map((r) => r.filePath))
    if (failed.size === 0) return targets

    logger.warn(
      {count: failed.size, files: [...failed]},
      'process: skipping upload for files whose metadata generation failed',
    )
    return targets.filter((t) => !failed.has(t))
  }
}
