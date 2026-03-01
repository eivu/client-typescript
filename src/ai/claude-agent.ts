import type {AgentOptions, AgentRequest, AgentResult} from '@src/ai/types'

import Anthropic from '@anthropic-ai/sdk'
import {BaseAgent, extractYamlFromResponse} from '@src/ai/base-agent'
import logger from '@src/logger'
import * as fs from 'node:fs'
import path from 'node:path'

const MAX_BATCH_SIZE = 10_000
const CLAUDE_DEFAULTS = {
  maxTokens: 8192,
  model: 'claude-sonnet-4-20250514',
  pollIntervalMs: 30_000,
} as const

const DEFAULT_SKILL_PATH = path.join('src', 'ai', 'prompts', 'claude', 'EIVU_METADATA_SKILL_v7_16_1_RUNTIME.md')

/** System prompt block with optional cache control for Anthropic API. */
type CachedTextBlock = {
  cache_control: {type: 'ephemeral'}
  text: string
  type: 'text'
}

/**
 * Agent implementation using Anthropic's Claude API (Messages Batches).
 * Loads the EIVU metadata skill from a file or skillContent and processes requests in batches.
 */
export class ClaudeAgent extends BaseAgent {
  private client: Anthropic
  private systemPromptBlocks: CachedTextBlock[]

  constructor(options: AgentOptions = {}) {
    super(options, CLAUDE_DEFAULTS)
    this.client = new Anthropic({apiKey: options.apiKey})

    let skillContent: string
    if (options.skillContent) {
      skillContent = options.skillContent
    } else {
      const skillPath = options.skillPath ?? path.join(process.cwd(), DEFAULT_SKILL_PATH)
      if (!fs.existsSync(skillPath)) {
        throw new Error(`EIVU metadata skill file not found: ${skillPath}`)
      }

      skillContent = fs.readFileSync(skillPath, 'utf8')
    }

    this.systemPromptBlocks = [
      {
        // eslint-disable-next-line camelcase -- Anthropic API uses snake_case
        cache_control: {type: 'ephemeral' as const},
        text: skillContent,
        type: 'text' as const,
      },
    ]
  }

  private static formatBatchError(result: {error?: unknown; type: string}): string {
    if (result.type === 'errored' && result.error) {
      const err = result.error as {message?: string; type?: string}
      return `API error: ${err.type ?? 'unknown'} - ${err.message ?? 'no details'}`
    }

    return `Request ${result.type}`
  }

  async processRequests(requests: AgentRequest[]): Promise<AgentResult[]> {
    if (requests.length === 0) return []

    const results: AgentResult[] = []

    for (let i = 0; i < requests.length; i += MAX_BATCH_SIZE) {
      const chunk = requests.slice(i, i + MAX_BATCH_SIZE)
      const batchNum = Math.floor(i / MAX_BATCH_SIZE) + 1
      const totalBatches = Math.ceil(requests.length / MAX_BATCH_SIZE)

      if (totalBatches > 1) {
        logger.info({batch: batchNum, of: totalBatches}, 'Processing batch chunk')
      }

      // eslint-disable-next-line no-await-in-loop -- batches must be processed sequentially
      const batchResults = await this.submitAndPollBatch(chunk)
      results.push(...batchResults)
    }

    return results
  }

  private async collectResults(batchId: string, requests: AgentRequest[]): Promise<AgentResult[]> {
    const idToCustomId = new Map(requests.map((r) => [r.customId, r]))
    const results: AgentResult[] = []

    const resultsStream = await this.client.messages.batches.results(batchId)
    for await (const entry of resultsStream) {
      if (!idToCustomId.has(entry.custom_id)) {
        logger.warn({customId: entry.custom_id}, 'Unknown custom_id in batch results')
        continue
      }

      if (entry.result.type === 'succeeded') {
        const yaml = extractYamlFromResponse(
          entry.result.message.content as Array<{text?: string; type: string}>,
        )
        results.push({customId: entry.custom_id, status: 'success', yaml})
      } else {
        const errorMsg = ClaudeAgent.formatBatchError(entry.result)
        results.push({customId: entry.custom_id, error: errorMsg, status: 'error'})
        logger.error({customId: entry.custom_id, resultType: entry.result.type}, 'Batch request failed')
      }
    }

    return results
  }

  private async pollUntilComplete(batchId: string, totalRequests: number): Promise<void> {
    let status = await this.client.messages.batches.retrieve(batchId)

    while (status.processing_status === 'in_progress') {
      // eslint-disable-next-line no-await-in-loop -- polling must be sequential
      await this.sleep(this.pollIntervalMs)
      // eslint-disable-next-line no-await-in-loop -- polling must be sequential
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
        totalRequests,
      })
    }
  }

  private async submitAndPollBatch(requests: AgentRequest[]): Promise<AgentResult[]> {
    const batchRequests = requests.map((req) => ({
      // eslint-disable-next-line camelcase -- Anthropic API uses snake_case
      custom_id: req.customId,
      params: {
        // eslint-disable-next-line camelcase -- Anthropic API uses snake_case
        max_tokens: this.maxTokens,
        messages: [{content: req.userMessage, role: 'user' as const}],
        model: this.model,
        system: this.systemPromptBlocks as Anthropic.MessageCreateParams['system'],
      },
    }))

    logger.info({count: requests.length}, 'Creating Anthropic message batch')
    const batch = await this.client.messages.batches.create({requests: batchRequests})
    logger.info({batchId: batch.id}, 'Batch created, polling for completion')

    await this.pollUntilComplete(batch.id, requests.length)

    return this.collectResults(batch.id, requests)
  }
}
