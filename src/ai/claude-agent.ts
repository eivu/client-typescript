import type {AgentOptions, AgentRequest, AgentResult, RawAgentResult, RawAgentUsage} from '@src/ai/types'

import Anthropic from '@anthropic-ai/sdk'
import {BaseAgent, extractYamlFromResponse} from '@src/ai/base-agent'
import {METADATA_YML_SUFFIX} from '@src/constants'
import logger from '@src/logger'
import * as fs from 'node:fs'
import {promises as fsp} from 'node:fs'
import path from 'node:path'

const MAX_BATCH_SIZE = 10_000
const CLAUDE_DEFAULTS = {
  maxTokens: 16_384,
  model: 'claude-opus-4-6',
  pollIntervalMs: 30_000,
} as const

const DEFAULT_SKILL_PATH = path.join('src', 'ai', 'prompts', 'claude', 'EIVU_METADATA_SKILL_v7_16_4_RUNTIME.md')

/**
 * Anthropic web search tool definition.
 * Uses the stable tool type; max_uses caps the number of searches per request.
 */
type WebSearchTool = {
  max_uses?: number
  name: 'web_search'
  type: 'web_search_20250305'
}

/** System prompt block with optional cache control for Anthropic API. */
type CachedTextBlock = {
  cache_control: {type: 'ephemeral'}
  text: string
  type: 'text'
}

/**
 * Agent implementation using Anthropic's Claude API (Messages Batches).
 * Loads the EIVU metadata skill from a file or skillContent and processes requests in batches.
 * Enables web search by default so the model can verify book identity, creative teams,
 * character appearances, and critical reception before generating metadata.
 */
export class ClaudeAgent extends BaseAgent {
  private client: Anthropic
  private systemPromptBlocks: CachedTextBlock[]
  private temperature?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- spike variants pass arbitrary Anthropic Tool shapes
  private toolChoice?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- spike variants pass arbitrary Anthropic Tool shapes
  private tools: any[]

  constructor(options: AgentOptions = {}) {
    super(options, CLAUDE_DEFAULTS)
    this.client = new Anthropic({apiKey: options.apiKey})

    // Web search is critical for accurate metadata — the model must verify
    // what a book collects, its full creative team, character appearances,
    // and critical reception before generating YAML. The spike's structured-output
    // variant overrides this by passing a custom `tools` list.
    if (options.tools === undefined) {
      const webSearchMaxUses = options.webSearchMaxUses ?? 10
      const webSearchTool: WebSearchTool = {
        // eslint-disable-next-line camelcase -- Anthropic API uses snake_case
        max_uses: webSearchMaxUses,
        name: 'web_search' as const,
        type: 'web_search_20250305' as const,
      }
      this.tools = webSearchMaxUses > 0 ? [webSearchTool] : []
    } else {
      this.tools = options.tools
    }

    this.toolChoice = options.toolChoice
    this.temperature = options.temperature

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

  private static emptyUsage(startedAt: number): RawAgentUsage {
    return {
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      inputTokens: 0,
      latencyMs: Date.now() - startedAt,
      outputTokens: 0,
      webSearchRequests: 0,
    }
  }

  /**
   * Extracts the usage record from a succeeded message in the same shape as
   * `parseRawSuccess` does, but returned standalone so the production
   * `collectResults` path can attach usage to each `AgentResult`.
   */
  private static extractUsage(message: Anthropic.Message, startedAt: number): RawAgentUsage {
    const usage = message.usage as {
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
      input_tokens: number
      output_tokens: number
      server_tool_use?: {web_search_requests?: number}
    }
    return {
      cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
      inputTokens: usage.input_tokens,
      latencyMs: Date.now() - startedAt,
      outputTokens: usage.output_tokens,
      webSearchRequests: usage.server_tool_use?.web_search_requests ?? 0,
    }
  }

  private static formatBatchError(result: {error?: unknown; type: string}): string {
    if (result.type === 'errored' && result.error) {
      const err = result.error as {message?: string; type?: string}
      return `API error: ${err.type ?? 'unknown'} - ${err.message ?? 'no details'}`
    }

    return `Request ${result.type}`
  }

  private static parseRawSuccess(
    customId: string,
    message: Anthropic.Message,
    startedAt: number,
  ): RawAgentResult {
    // Concatenate all text blocks for rawText; capture the first tool_use input for variant 5.
    const blocks = message.content as Array<{
      input?: Record<string, unknown>
      name?: string
      text?: string
      type: string
    }>

    const rawText = blocks
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('\n')

    const firstToolUse = blocks.find((b) => b.type === 'tool_use')

    // Anthropic exposes web search counts under usage.server_tool_use.web_search_requests
    // when the web_search tool is enabled. Default to 0 if absent.
    const usage = message.usage as {
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
      input_tokens: number
      output_tokens: number
      server_tool_use?: {web_search_requests?: number}
    }

    return {
      customId,
      rawText,
      status: 'success' as const,
      ...(firstToolUse ? {toolUseInput: firstToolUse.input ?? {}, toolUseName: firstToolUse.name} : {}),
      usage: {
        cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
        cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
        inputTokens: usage.input_tokens,
        latencyMs: Date.now() - startedAt,
        outputTokens: usage.output_tokens,
        webSearchRequests: usage.server_tool_use?.web_search_requests ?? 0,
      },
    }
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

  /**
   * Submits a batch and returns RAW results (no YAML validation, no post-processing).
   *
   * Used only by the Phase 0 measurement spike — production callers should use
   * `processRequests`. Returns per-request `{rawText, toolUseInput, usage}` so the
   * spike harness can compute consistency, cost, and timing across variants.
   *
   * The raw text is the concatenated content of all text blocks in the response;
   * `toolUseInput` is the parsed `input` of the FIRST tool_use block (variant 5
   * uses this to read its forced structured-output tool call).
   */
  async processRequestsRaw(requests: AgentRequest[]): Promise<RawAgentResult[]> {
    if (requests.length === 0) return []

    const results: RawAgentResult[] = []

    for (let i = 0; i < requests.length; i += MAX_BATCH_SIZE) {
      const chunk = requests.slice(i, i + MAX_BATCH_SIZE)
      // eslint-disable-next-line no-await-in-loop -- batches must be processed sequentially
      const chunkResults = await this.submitAndPollBatchRaw(chunk)
      results.push(...chunkResults)
    }

    return results
  }

  private buildBatchParams(req: AgentRequest): Anthropic.MessageCreateParamsNonStreaming {
    return {
      // eslint-disable-next-line camelcase -- Anthropic API uses snake_case
      max_tokens: this.maxTokens,
      messages: [{content: req.userMessage, role: 'user' as const}],
      model: this.model,
      system: this.systemPromptBlocks as Anthropic.MessageCreateParamsNonStreaming['system'],
      ...(this.temperature === undefined ? {} : {temperature: this.temperature}),
      ...(this.tools.length > 0
        ? {tools: this.tools as unknown as Anthropic.MessageCreateParamsNonStreaming['tools']}
        : {}),
       
      ...(this.toolChoice === undefined
        ? {}
        : // eslint-disable-next-line camelcase -- Anthropic API uses snake_case
          {tool_choice: this.toolChoice as Anthropic.MessageCreateParamsNonStreaming['tool_choice']}),
    }
  }

  private async collectRawResults(batchId: string, requests: AgentRequest[]): Promise<RawAgentResult[]> {
    const idToRequest = new Map(requests.map((r) => [r.customId, r]))
    const results: RawAgentResult[] = []
    const startedAt = Date.now()

    const resultsStream = await this.client.messages.batches.results(batchId)
    for await (const entry of resultsStream) {
      if (!idToRequest.has(entry.custom_id)) {
        logger.warn({customId: entry.custom_id}, 'Unknown custom_id in batch results')
        continue
      }

      if (entry.result.type === 'succeeded') {
        results.push(ClaudeAgent.parseRawSuccess(entry.custom_id, entry.result.message, startedAt))
      } else {
        results.push({
          customId: entry.custom_id,
          error: ClaudeAgent.formatBatchError(entry.result),
          rawText: '',
          status: 'error' as const,
          usage: ClaudeAgent.emptyUsage(startedAt),
        })
      }
    }

    return results
  }

  /**
   * Collects and processes results from a completed Anthropic batch.
   *
   * Raw YAML is extracted from each succeeded entry and passed to the shared
   * BaseAgent.validateAndPostProcess pipeline. For validation failures, the raw
   * AI output is saved to `tmp/{timestamp}-{batchId}/` for debugging — one shared
   * timestamp per batch so related failures are grouped together. Failed results are
   * returned as `validation_error` so MetadataGenerator can retry them.
   */
  private async collectResults(batchId: string, requests: AgentRequest[]): Promise<AgentResult[]> {
    const idToRequest = new Map(requests.map((r) => [r.customId, r]))
    const rawItems: Array<{customId: string; rawYaml: string; usage: RawAgentUsage}> = []
    const errorResults: AgentResult[] = []
    const startedAt = Date.now()

    const resultsStream = await this.client.messages.batches.results(batchId)
    for await (const entry of resultsStream) {
      if (!idToRequest.has(entry.custom_id)) {
        logger.warn({customId: entry.custom_id}, 'Unknown custom_id in batch results')
        continue
      }

      if (entry.result.type === 'succeeded') {
        const rawYaml = extractYamlFromResponse(entry.result.message.content as Array<{text?: string; type: string}>)
        const usage = ClaudeAgent.extractUsage(entry.result.message, startedAt)
        rawItems.push({customId: entry.custom_id, rawYaml, usage})
      } else {
        const errorMsg = ClaudeAgent.formatBatchError(entry.result)
        errorResults.push({
          customId: entry.custom_id,
          error: errorMsg,
          status: 'error',
          usage: ClaudeAgent.emptyUsage(startedAt),
        })
        logger.error({customId: entry.custom_id, resultType: entry.result.type}, 'Batch request failed')
      }
    }

    // Shared validation + post-processing (owned by BaseAgent so all agents use it)
    const processedResults = this.validateAndPostProcess(rawItems)

    // Save failed YAML to tmp for debugging — directory is only created on the first
    // failure to avoid empty directories. Shared timestamp keeps batch failures together.
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-')
    const failureDir = path.join('tmp', `${timestamp}-${batchId}`)
    let failureDirCreated = false

    for (const result of processedResults) {
      if (result.status === 'validation_error') {
        logger.warn({customId: result.customId, error: result.error}, 'YAML validation failed')

        const request = idToRequest.get(result.customId)
        if (request) {
          if (!failureDirCreated) {
            // eslint-disable-next-line no-await-in-loop -- lazy directory creation
            await fsp.mkdir(failureDir, {recursive: true})
            failureDirCreated = true
          }

          const filename = `${path.basename(request.filePath)}${METADATA_YML_SUFFIX}`
          // eslint-disable-next-line no-await-in-loop -- sequential saves within same batch
          await fsp.writeFile(path.join(failureDir, filename), result.rawYaml ?? '', 'utf8')
          logger.info({batchId, filePath: path.join(failureDir, filename)}, 'Saved failed YAML to tmp')
        }
      }
    }

    return [...errorResults, ...processedResults]
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
      params: this.buildBatchParams(req),
    }))

    logger.info({count: requests.length}, 'Creating Anthropic message batch')
    const batch = await this.client.messages.batches.create({requests: batchRequests})
    logger.info({batchId: batch.id}, 'Batch created, polling for completion')

    await this.pollUntilComplete(batch.id, requests.length)

    return this.collectResults(batch.id, requests)
  }

  private async submitAndPollBatchRaw(requests: AgentRequest[]): Promise<RawAgentResult[]> {
    const batchRequests = requests.map((req) => ({
      // eslint-disable-next-line camelcase -- Anthropic API uses snake_case
      custom_id: req.customId,
      params: this.buildBatchParams(req),
    }))

    logger.info({count: requests.length}, 'Creating Anthropic message batch (raw mode)')
    const batch = await this.client.messages.batches.create({requests: batchRequests})
    logger.info({batchId: batch.id}, 'Raw batch created, polling for completion')

    await this.pollUntilComplete(batch.id, requests.length)

    return this.collectRawResults(batch.id, requests)
  }
}
