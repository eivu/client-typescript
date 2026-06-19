import type {Pipeline, PipelineName} from '@src/ai/pipeline'
import type {AgentOptions, AgentRequest, AgentResult, RawAgentResult, RawAgentUsage} from '@src/ai/types'

import Anthropic from '@anthropic-ai/sdk'
import {BaseAgent, extractYamlFromResponse} from '@src/ai/base-agent'
import {resolvePipeline} from '@src/ai/pipeline-resolver'
import {buildAllPipelines} from '@src/ai/pipelines/index'
import {zeroUsage} from '@src/ai/types'
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
 * Resolved per-request stage configuration consumed by `buildBatchParams`.
 * In static (spike) mode all fields come from instance-level options; in
 * pipeline mode they come from the pipeline's `stages[0]`.
 */
type StageConfig = {
  maxTokens: number
  model: string
  /**
   * Pipeline name used for telemetry attribution (`comics` / `audio` /
   * `video` / `other`). `'static'` when the agent is in spike/skillContent mode
   * and every request shares the same instance-level config.
   */
  pipeline: string
  systemBlocks: CachedTextBlock[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Anthropic Tool shape is broad
  tools: any[]
}

/**
 * Agent implementation using Anthropic's Claude API (Messages Batches).
 *
 * Two construction modes:
 *
 * 1. **Pipeline mode (Phase 2 production default).** When neither `skillContent`
 *    nor `skillPath` is provided, the constructor builds one Pipeline per media
 *    category (`comics` / `audio` / `video` / `other`) from `src/ai/pipelines/`.
 *    `buildBatchParams(req)` resolves the file's media category and uses the
 *    matching pipeline's `stages[0]` for model, system prompt, max tokens, and
 *    web-search budget.
 *
 * 2. **Static mode (spike + tests).** When `skillContent` or `skillPath` is
 *    provided, a single `CachedTextBlock` is reused for every request, and the
 *    agent's instance-level `model` / `maxTokens` / `tools` / `toolChoice`
 *    drive every call. This is what the Phase 0 spike variants use to compare
 *    alternative prompts and tool shapes against the production pipeline.
 *
 * Web search is critical for accurate metadata — the model must verify what a
 * book collects, its full creative team, character appearances, and critical
 * reception before generating YAML. Default budget is 10 uses per call.
 */
export class ClaudeAgent extends BaseAgent {
  private client: Anthropic
  /**
   * Pipeline-mode: one production pipeline per media category. Populated when
   * neither `skillContent` nor `skillPath` is provided. The `'other'` key is
   * present only when the v7.16.4 monolith exists on disk — `selectStageConfig`
   * raises a clear error if a file routes to a missing pipeline.
   */
  private pipelinesByMedia?: Partial<Record<PipelineName, Pipeline>>
  /**
   * Static-mode: a single cached block reused across every batch request. Set
   * when caller passes `skillContent` or `skillPath`. Spike variants and unit
   * tests take this path.
   */
  private staticSystemBlocks?: CachedTextBlock[]
  private temperature?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- spike variants pass arbitrary Anthropic Tool shapes
  private toolChoice?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- spike variants pass arbitrary Anthropic Tool shapes
  private tools: any[]

  constructor(options: AgentOptions = {}) {
    super(options, CLAUDE_DEFAULTS)
    this.client = new Anthropic({apiKey: options.apiKey})

    // Static-mode tool config: callers can pass `tools` verbatim (spike's
    // structured-output variant) or set `webSearchMaxUses` to tune the budget.
    // Pipeline-mode ignores these — each pipeline's `stages[0].webSearchMaxUses`
    // is the source of truth, set per-media-type at pipeline construction.
    if (options.tools === undefined) {
      const webSearchMaxUses = options.webSearchMaxUses ?? 10
      this.tools = webSearchMaxUses > 0 ? [ClaudeAgent.makeWebSearchTool(webSearchMaxUses)] : []
    } else {
      this.tools = options.tools
    }

    this.toolChoice = options.toolChoice
    this.temperature = options.temperature

    const staticContent = ClaudeAgent.resolveStaticContent(options)
    if (staticContent !== undefined) {
      this.staticSystemBlocks = [ClaudeAgent.makeBlock(staticContent)]
    } else if (options.pipelines) {
      // Per-pipeline custom mode. Caller owns the full pipeline shape (typically
      // a spike variant that needs different models per media type). Agent-level
      // overrides (`model`, `maxTokens`, `webSearchMaxUses`) are NOT propagated
      // because the caller already baked them into each pipeline.
      this.pipelinesByMedia = options.pipelines
    } else {
      // Default pipeline mode. Agent-level options act as overrides on pipeline
      // defaults so spike variants (e.g. `phase1-fragments` at `maxTokens=8192`)
      // and tests can pin behavior without bypassing the pipeline abstraction.
      this.pipelinesByMedia = buildAllPipelines({
        ...(options.maxTokens === undefined ? {} : {maxTokens: options.maxTokens}),
        ...(options.model === undefined ? {} : {model: options.model}),
        ...(options.webSearchMaxUses === undefined ? {} : {webSearchMaxUses: options.webSearchMaxUses}),
      })
    }
  }

  private static emptyUsage(startedAt: number): RawAgentUsage {
    return zeroUsage(Date.now() - startedAt)
  }

  private static formatBatchError(result: {error?: unknown; type: string}): string {
    if (result.type === 'errored' && result.error) {
      const err = result.error as {message?: string; type?: string}
      return `API error: ${err.type ?? 'unknown'} - ${err.message ?? 'no details'}`
    }

    return `Request ${result.type}`
  }

  private static makeBlock(text: string): CachedTextBlock {
    return {
      // eslint-disable-next-line camelcase -- Anthropic API uses snake_case
      cache_control: {type: 'ephemeral' as const},
      text,
      type: 'text' as const,
    }
  }

  private static makeWebSearchTool(maxUses: number): WebSearchTool {
    return {
      // eslint-disable-next-line camelcase -- Anthropic API uses snake_case
      max_uses: maxUses,
      name: 'web_search' as const,
      type: 'web_search_20250305' as const,
    }
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

    return {
      customId,
      rawText,
      status: 'success' as const,
      ...(firstToolUse ? {toolUseInput: firstToolUse.input ?? {}, toolUseName: firstToolUse.name} : {}),
      usage: ClaudeAgent.parseUsage(message, startedAt),
    }
  }

  /**
   * Parses the token + web-search usage record from a succeeded Anthropic message.
   * Single source for usage extraction — consumed by both the production
   * `collectResults` path and the raw `parseRawSuccess` path.
   */
  private static parseUsage(message: Anthropic.Message, startedAt: number): RawAgentUsage {
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

  /**
   * Returns the static skill text when the caller supplied one (spike harness +
   * existing tests use `skillContent`/`skillPath`); returns undefined when the
   * agent should fall through to assembler mode.
   */
  private static resolveStaticContent(options: AgentOptions): string | undefined {
    if (options.skillContent !== undefined) return options.skillContent
    if (options.skillPath === undefined) return undefined

    if (!fs.existsSync(options.skillPath)) {
      throw new Error(`EIVU metadata skill file not found: ${options.skillPath}`)
    }

    return fs.readFileSync(options.skillPath, 'utf8')
  }

  async processRequests(requests: AgentRequest[]): Promise<AgentResult[]> {
    return this.runBatch(requests, (batchId, chunk) => this.collectResults(batchId, chunk))
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
    return this.runBatch(requests, (batchId, chunk) => this.collectRawResults(batchId, chunk))
  }

  private buildBatchParams(req: AgentRequest): Anthropic.MessageCreateParamsNonStreaming {
    const config = this.selectStageConfig(req.filePath)
    return {
      // eslint-disable-next-line camelcase -- Anthropic API uses snake_case
      max_tokens: config.maxTokens,
      messages: [{content: req.userMessage, role: 'user' as const}],
      model: config.model,
      system: config.systemBlocks as Anthropic.MessageCreateParamsNonStreaming['system'],
      ...(this.temperature === undefined ? {} : {temperature: this.temperature}),
      ...(config.tools.length > 0
        ? {tools: config.tools as unknown as Anthropic.MessageCreateParamsNonStreaming['tools']}
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
    const rawItems: Array<{customId: string; model: string; pipeline: string; rawYaml: string; usage: RawAgentUsage}> = []
    const errorResults: AgentResult[] = []
    const startedAt = Date.now()

    const resultsStream = await this.client.messages.batches.results(batchId)
    for await (const entry of resultsStream) {
      const request = idToRequest.get(entry.custom_id)
      if (!request) {
        logger.warn({customId: entry.custom_id}, 'Unknown custom_id in batch results')
        continue
      }

      // selectStageConfig is deterministic from filePath — re-resolving here
      // lets us attach the per-call model + pipeline name to every result for
      // accurate ai:engine, cost computation, and telemetry attribution.
      const stageConfig = this.selectStageConfig(request.filePath)

      if (entry.result.type === 'succeeded') {
        const rawYaml = extractYamlFromResponse(entry.result.message.content as Array<{text?: string; type: string}>)
        const usage = ClaudeAgent.parseUsage(entry.result.message, startedAt)
        rawItems.push({
          customId: entry.custom_id,
          model: stageConfig.model,
          pipeline: stageConfig.pipeline,
          rawYaml,
          usage,
        })
      } else {
        const errorMsg = ClaudeAgent.formatBatchError(entry.result)
        errorResults.push({
          customId: entry.custom_id,
          error: errorMsg,
          model: stageConfig.model,
          pipeline: stageConfig.pipeline,
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

  /**
   * Shared batch driver for both the production and raw paths. Chunks requests by
   * MAX_BATCH_SIZE, creates + polls one Anthropic batch per chunk, then hands the
   * completed batch to the caller-supplied `collect` function — the single point
   * where the production (`collectResults`) and raw (`collectRawResults`) paths
   * diverge. Everything before collection (chunking, submit, poll) is identical.
   */
  private async runBatch<T>(
    requests: AgentRequest[],
    collect: (batchId: string, chunk: AgentRequest[]) => Promise<T[]>,
  ): Promise<T[]> {
    if (requests.length === 0) return []

    const results: T[] = []
    const totalBatches = Math.ceil(requests.length / MAX_BATCH_SIZE)

    for (let i = 0; i < requests.length; i += MAX_BATCH_SIZE) {
      const chunk = requests.slice(i, i + MAX_BATCH_SIZE)

      if (totalBatches > 1) {
        logger.info({batch: Math.floor(i / MAX_BATCH_SIZE) + 1, of: totalBatches}, 'Processing batch chunk')
      }

      const batchRequests = chunk.map((req) => ({
        // eslint-disable-next-line camelcase -- Anthropic API uses snake_case
        custom_id: req.customId,
        params: this.buildBatchParams(req),
      }))

      logger.info({count: chunk.length}, 'Creating Anthropic message batch')
      // eslint-disable-next-line no-await-in-loop -- batches must be processed sequentially
      const batch = await this.client.messages.batches.create({requests: batchRequests})
      logger.info({batchId: batch.id}, 'Batch created, polling for completion')

      // eslint-disable-next-line no-await-in-loop -- batches must be processed sequentially
      await this.pollUntilComplete(batch.id, chunk.length)
      // eslint-disable-next-line no-await-in-loop -- batches must be processed sequentially
      const chunkResults = await collect(batch.id, chunk)
      results.push(...chunkResults)
    }

    return results
  }

  /**
   * Resolves the per-request stage configuration that drives `buildBatchParams`.
   *
   * In static mode (spike + tests, when `skillContent`/`skillPath` was set),
   * returns instance-level fields: `this.model`, `this.maxTokens`,
   * `this.staticSystemBlocks`, `this.tools`. Every request gets the same
   * config, matching the pre-Phase-2 single-prompt behavior.
   *
   * In pipeline mode (Phase 2 production default), looks up the pipeline for
   * the file's media category via `resolvePipeline()` and returns a config
   * derived from its `stages[0]`. The agent's instance-level `model` etc. are
   * overrides applied at pipeline-build time (in the constructor) — so by the
   * time this method runs, the pipeline already reflects any agent options.
   *
   * Throws if pipeline mode is active but the file's category has no
   * configured pipeline (typically `'other'` when the v7.16.4 monolith is
   * missing). Silent fallback to the wrong pipeline would produce bad output,
   * so we surface the error instead.
   */
  private selectStageConfig(filePath: string): StageConfig {
    if (this.staticSystemBlocks) {
      return {
        maxTokens: this.maxTokens,
        model: this.model,
        pipeline: 'static',
        systemBlocks: this.staticSystemBlocks,
        tools: this.tools,
      }
    }

    if (!this.pipelinesByMedia) {
      throw new Error('ClaudeAgent has no system prompt configured')
    }

    const pipeline = resolvePipeline(filePath, this.pipelinesByMedia)
    if (!pipeline) {
      throw new Error(
        `No pipeline configured for '${filePath}'. The 'other' pipeline requires the v7.16.4 monolith at src/ai/prompts/claude/EIVU_METADATA_SKILL_v7_16_4_RUNTIME.md — restore it or route this file to a known media category.`,
      )
    }

    const stage = pipeline.stages[0]
    const tools = stage.webSearchMaxUses > 0
      ? [ClaudeAgent.makeWebSearchTool(stage.webSearchMaxUses)]
      : []

    return {
      maxTokens: stage.maxTokens,
      model: stage.model,
      pipeline: pipeline.name,
      systemBlocks: [ClaudeAgent.makeBlock(stage.systemPrompt)],
      tools,
    }
  }

}
