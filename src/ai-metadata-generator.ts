import Anthropic from '@anthropic-ai/sdk'
import {METADATA_YML_SUFFIX} from '@src/constants'
import logger from '@src/logger'
import * as fs from 'node:fs'
import {promises as fsp} from 'node:fs'
import path from 'node:path'

const MAX_BATCH_SIZE = 10_000
const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_MAX_TOKENS = 8192
const DEFAULT_POLL_INTERVAL_MS = 30_000

type CachedTextBlock = {
  cache_control: {type: 'ephemeral'}
  text: string
  type: 'text'
}

type BatchRequest = {
  customId: string
  filePath: string
  outputPath: string
  userMessage: string
}

export type GenerationResult = {
  error?: string
  filePath: string
  outputPath: string
  status: 'error' | 'skipped' | 'success'
  yaml?: string
}

export type BatchProgress = {
  canceledRequests: number
  createdAt: string
  endedAt: string | null
  erroredRequests: number
  expiredRequests: number
  id: string
  processingStatus: string
  succeededRequests: number
  totalRequests: number
}

export type AiMetadataGeneratorOptions = {
  apiKey?: string
  maxTokens?: number
  model?: string
  onProgress?: (progress: BatchProgress) => void
  overwrite?: boolean
  pollIntervalMs?: number
  skillContent?: string
  skillPath?: string
}

export function buildUserMessage(filePath: string): string {
  const filename = path.basename(filePath)
  return `Using this runtime, please create an eivu file for ${filename}`
}

export function extractYamlFromResponse(content: Array<{text?: string; type: string}>): string {
  const text = content
    .filter((block): block is {text: string; type: 'text'} => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')

  const fenced = text.match(/```(?:ya?ml)?\n?([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()

  return text.trim()
}

export class AiMetadataGenerator {
  readonly maxTokens: number
  readonly model: string
  readonly overwrite: boolean
  readonly pollIntervalMs: number

  private client: Anthropic
  private onProgress?: (progress: BatchProgress) => void
  private systemPromptBlocks: CachedTextBlock[]

  constructor(options: AiMetadataGeneratorOptions = {}) {
    this.client = new Anthropic({apiKey: options.apiKey})
    this.model = options.model ?? DEFAULT_MODEL
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS
    this.overwrite = options.overwrite ?? false
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
    this.onProgress = options.onProgress

    let skillContent: string
    if (options.skillContent) {
      skillContent = options.skillContent
    } else {
      const skillPath = options.skillPath ?? path.join(process.cwd(), 'EIVU_METADATA_SKILL_v7_16_1_RUNTIME.md')
      if (!fs.existsSync(skillPath)) {
        throw new Error(`EIVU metadata skill file not found: ${skillPath}`)
      }

      skillContent = fs.readFileSync(skillPath, 'utf-8')
    }

    this.systemPromptBlocks = [
      {
        cache_control: {type: 'ephemeral' as const},
        text: skillContent,
        type: 'text' as const,
      },
    ]
  }

  /**
   * Convenience static method matching the project's Client pattern.
   * Creates an instance and delegates to the instance generate method.
   */
  static async generate(filePaths: string[], options?: AiMetadataGeneratorOptions): Promise<GenerationResult[]> {
    const generator = new AiMetadataGenerator(options)
    return generator.generate(filePaths)
  }

  /**
   * Generates .eivu.yml metadata files for every file path using the Anthropic Batch API.
   * Files that already have .eivu.yml are skipped unless `overwrite` is set.
   * Returns a result for every input path indicating success, skip, or error.
   */
  async generate(filePaths: string[]): Promise<GenerationResult[]> {
    if (filePaths.length === 0) return []

    const {requests, skippedResults} = this.buildRequests(filePaths)

    if (requests.length === 0) {
      logger.info('All files already have .eivu.yml metadata, nothing to process')
      return skippedResults
    }

    logger.info(
      {skipped: skippedResults.length, toProcess: requests.length, total: filePaths.length},
      'Processing files for AI metadata generation',
    )

    const results: GenerationResult[] = [...skippedResults]

    for (let i = 0; i < requests.length; i += MAX_BATCH_SIZE) {
      const chunk = requests.slice(i, i + MAX_BATCH_SIZE)
      const batchNum = Math.floor(i / MAX_BATCH_SIZE) + 1
      const totalBatches = Math.ceil(requests.length / MAX_BATCH_SIZE)

      if (totalBatches > 1) {
        logger.info({batch: batchNum, of: totalBatches}, 'Processing batch chunk')
      }

      const batchResults = await this.processBatch(chunk)
      results.push(...batchResults)
    }

    const succeeded = results.filter((r) => r.status === 'success').length
    const errored = results.filter((r) => r.status === 'error').length
    const skipped = results.filter((r) => r.status === 'skipped').length
    logger.info({errored, skipped, succeeded, total: results.length}, 'AI metadata generation complete')

    return results
  }

  private buildRequests(filePaths: string[]): {
    requests: BatchRequest[]
    skippedResults: GenerationResult[]
  } {
    const requests: BatchRequest[] = []
    const skippedResults: GenerationResult[] = []

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i]
      const outputPath = `${filePath}${METADATA_YML_SUFFIX}`

      if (!this.overwrite && fs.existsSync(outputPath)) {
        skippedResults.push({filePath, outputPath, status: 'skipped'})
        continue
      }

      const customId = AiMetadataGenerator.filePathToCustomId(filePath, i)
      const userMessage = buildUserMessage(filePath)
      requests.push({customId, filePath, outputPath, userMessage})
    }

    return {requests, skippedResults}
  }

  private async processBatch(requests: BatchRequest[]): Promise<GenerationResult[]> {
    const idToRequest = new Map(requests.map((r) => [r.customId, r]))

    const batchRequests = requests.map((req) => ({
      custom_id: req.customId,
      params: {
        max_tokens: this.maxTokens,
        messages: [{role: 'user' as const, content: req.userMessage}],
        model: this.model,
        system: this.systemPromptBlocks as Anthropic.MessageCreateParams['system'],
      },
    }))

    logger.info({count: requests.length}, 'Creating Anthropic message batch')
    const batch = await this.client.messages.batches.create({requests: batchRequests})
    logger.info({batchId: batch.id}, 'Batch created, polling for completion')

    await this.pollUntilComplete(batch.id, requests.length)

    return this.collectResults(batch.id, idToRequest)
  }

  private async pollUntilComplete(batchId: string, totalRequests: number): Promise<void> {
    let status = await this.client.messages.batches.retrieve(batchId)

    while (status.processing_status === 'in_progress') {
      await this.sleep(this.pollIntervalMs)
      status = await this.client.messages.batches.retrieve(batchId)

      const counts = status.request_counts
      logger.info(
        {
          batchId,
          canceled: counts.canceled,
          errored: counts.errored,
          processing: counts.processing,
          status: status.processing_status,
          succeeded: counts.succeeded,
        },
        'Batch progress',
      )

      this.onProgress?.({
        canceledRequests: counts.canceled,
        createdAt: status.created_at,
        endedAt: status.ended_at,
        erroredRequests: counts.errored,
        expiredRequests: counts.expired,
        id: status.id,
        processingStatus: status.processing_status,
        succeededRequests: counts.succeeded,
        totalRequests: totalRequests,
      })
    }
  }

  private async collectResults(
    batchId: string,
    idToRequest: Map<string, BatchRequest>,
  ): Promise<GenerationResult[]> {
    const results: GenerationResult[] = []

    const resultsStream = await this.client.messages.batches.results(batchId)
    for await (const entry of resultsStream) {
      const req = idToRequest.get(entry.custom_id)
      if (!req) {
        logger.warn({customId: entry.custom_id}, 'Unknown custom_id in batch results')
        continue
      }

      if (entry.result.type === 'succeeded') {
        const yaml = extractYamlFromResponse(
          entry.result.message.content as Array<{text?: string; type: string}>,
        )

        try {
          await fsp.writeFile(req.outputPath, yaml + '\n', 'utf-8')
          results.push({filePath: req.filePath, outputPath: req.outputPath, status: 'success', yaml})
          logger.info({outputPath: req.outputPath}, 'Wrote .eivu.yml file')
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          results.push({
            error: `Failed to write file: ${message}`,
            filePath: req.filePath,
            outputPath: req.outputPath,
            status: 'error',
          })
          logger.error({error: message, outputPath: req.outputPath}, 'Failed to write .eivu.yml file')
        }
      } else {
        const errorMsg = AiMetadataGenerator.formatBatchError(entry.result)
        results.push({error: errorMsg, filePath: req.filePath, outputPath: req.outputPath, status: 'error'})
        logger.error({customId: entry.custom_id, resultType: entry.result.type}, 'Batch request failed')
      }
    }

    return results
  }

  private static formatBatchError(result: {error?: unknown; type: string}): string {
    if (result.type === 'errored' && result.error) {
      const err = result.error as {message?: string; type?: string}
      return `API error: ${err.type ?? 'unknown'} - ${err.message ?? 'no details'}`
    }

    return `Request ${result.type}`
  }

  private static filePathToCustomId(filePath: string, index: number): string {
    const basename = path
      .basename(filePath)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50)
    return `${String(index).padStart(5, '0')}-${basename}`.slice(0, 64)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
