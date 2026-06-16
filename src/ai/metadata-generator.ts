import type {AgentRequest, AgentResult, AgentType, GenerationResult, MetadataGeneratorOptions, RawAgentUsage} from '@src/ai/types'

import {type BaseAgent, buildUserMessage, postProcessWithCost} from '@src/ai/base-agent'
import {ClaudeAgent} from '@src/ai/claude-agent'
import {computeCost} from '@src/ai/cost'
import {GeminiAgent} from '@src/ai/gemini-agent'
import {OpenAIAgent} from '@src/ai/openai-agent'
import {appendRunRows, type TelemetryRow} from '@src/ai/telemetry'
import {zeroUsage} from '@src/ai/types'
import {METADATA_YML_SUFFIX} from '@src/constants'
import logger from '@src/logger'
import * as fastCsv from 'fast-csv'
import {randomUUID} from 'node:crypto'
import * as fs from 'node:fs'
import {promises as fsp} from 'node:fs'
import path from 'node:path'

/**
 * Per-file accumulator used by the retry loop to track total cost across all
 * attempts (`totalCostUsd`) plus the final successful attempt's cost + usage
 * (`finalCostUsd` / `finalUsage`). `injectAiCostFields` reads these to write
 * `ai:cost`, `ai:cost_all`, `ai:tokens_in`, `ai:tokens_out` into the yml.
 */
type FileCostAccum = {
  finalCostUsd: number
  finalUsage: null | RawAgentUsage
  totalCostUsd: number
}

const MAX_VALIDATION_ATTEMPTS = 3

/**
 * Factory that creates the appropriate agent instance for the given type.
 * @param type - Agent provider ('claude' | 'gemini' | 'openai')
 * @param options - Options passed to the agent constructor
 * @returns A BaseAgent instance
 */
function createAgent(type: AgentType, options: MetadataGeneratorOptions): BaseAgent {
  switch (type) {
    case 'claude': {
      return new ClaudeAgent(options)
    }

    case 'gemini': {
      return new GeminiAgent(options)
    }

    case 'openai': {
      return new OpenAIAgent(options)
    }

    default: {
      throw new Error(`Unknown agent type: ${type as string}`)
    }
  }
}

/**
 * Generates .eivu.yml metadata files for media files using an AI agent (Claude, Gemini, or OpenAI).
 * Can process multiple files, skip existing metadata when overwrite is false, and write results in parallel.
 */
export class MetadataGenerator {
  /** When false, files that already have a .eivu.yml are skipped. */
  readonly overwrite: boolean
  private agent: BaseAgent
  /** When set, overrides the base name of the output .eivu.yml file. */
  private readonly outputBaseName: string | undefined

  /**
   * Creates a MetadataGenerator with the given options.
   * @param options - Agent type, overwrite flag, API key, model, skill content/path, etc. (default: { agent: 'claude', overwrite: false })
   */
  constructor(options: MetadataGeneratorOptions = {}) {
    const agentType = options.agent ?? 'claude'
    this.overwrite = options.overwrite ?? false
    this.outputBaseName = options.outputBaseName
    this.agent = createAgent(agentType, options)
  }

  /**
   * Static helper to generate metadata for files without instantiating a generator.
   * @param filePaths - Array of paths to media files
   * @param options - Optional MetadataGeneratorOptions (agent, overwrite, apiKey, etc.)
   * @returns Promise resolving to an array of GenerationResult (one per file)
   */
  static async generate(
    filePaths: string[],
    options?: MetadataGeneratorOptions,
  ): Promise<GenerationResult[]> {
    const generator = new MetadataGenerator(options)
    return generator.generate(filePaths)
  }

  private static filePathToCustomId(filePath: string, index: number): string {
    const basename = path
      .basename(filePath)
      .replaceAll(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50)
    return `${String(index).padStart(5, '0')}-${basename}`.slice(0, 64)
  }

  /**
   * Appends a row to `logs/failure.csv` when a file permanently fails after retries.
   *
   * Columns (no header — preserved from the original schema for backward compatibility
   * with anything that parses this file; new columns appended at the end):
   *   timestamp · filePath · error · attempts · cost_total_usd · tokens_in · tokens_out · validation_codes
   *
   * `validation_codes` (Phase 3) is a semicolon-joined list of the stable
   * `ValidationCode` strings emitted by `validateEivuYaml` for the LAST attempt
   * (the one that triggered the permanent failure). Empty for non-validation
   * errors so the column is always present.
   */
  private static async logValidationFailure(args: {
    attempts: number
    costAcc: FileCostAccum | undefined
    error: string
    filePath: string
    validationCodes: string[]
  }): Promise<void> {
    await fsp.mkdir('logs', {recursive: true})
    const totalCostUsd = args.costAcc?.totalCostUsd ?? 0
    const tokensIn = args.costAcc?.finalUsage?.inputTokens ?? 0
    const tokensOut = args.costAcc?.finalUsage?.outputTokens ?? 0
    const data = [
      new Date().toISOString(),
      args.filePath,
      args.error,
      String(args.attempts),
      totalCostUsd.toFixed(5),
      String(tokensIn),
      String(tokensOut),
      args.validationCodes.join(';'),
    ]
    const csvString = await fastCsv.writeToString([data], {headers: false})
    const logPath = 'logs/failure.csv'
    const fileExists = await fsp.stat(logPath).then((s) => s.size > 0).catch(() => false)
    await fsp.appendFile(logPath, (fileExists ? '\n' : '') + csvString.trim())
  }

  /**
   * Generates .eivu.yml metadata for the given file paths.
   * Skips files that already have metadata when overwrite is false; otherwise runs the agent and writes results.
   * @param filePaths - Array of paths to media files (e.g. .cbr, .mp3, .mp4)
   * @returns Promise resolving to an array of GenerationResult (success, skipped, or error per file)
   */
  async generate(filePaths: string[]): Promise<GenerationResult[]> {
    if (filePaths.length === 0) return []

    const {requests, skippedResults} = this.buildRequests(filePaths)

    if (requests.length === 0) {
      logger.info('All files already have .eivu.yml metadata, nothing to process')
      return skippedResults
    }

    const runId = randomUUID()
    logger.info(
      {runId, skipped: skippedResults.length, toProcess: requests.length, total: filePaths.length},
      'Processing files for AI metadata generation',
    )

    const idToFilePath = new Map(requests.map((r) => [r.customId, {filePath: r.filePath, outputPath: r.outputPath}]))
    const idToRequest = new Map(requests.map((r) => [r.customId, r]))
    const failureCounts = new Map<string, number>()
    const costByCustomId = new Map<string, FileCostAccum>()
    const allWriteResults: GenerationResult[] = []
    let currentRequests = [...requests]

    // Retry loop: files that fail YAML validation are re-submitted to the AI agent
    // in a new batch. Each file gets up to MAX_VALIDATION_ATTEMPTS total tries.
    // After exhausting retries, the file is logged to logs/failure.csv.
    for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS && currentRequests.length > 0; attempt++) {
      if (attempt > 1) {
        logger.info({attempt, count: currentRequests.length, runId}, 'Retrying files that failed YAML validation')
      }

      // eslint-disable-next-line no-await-in-loop -- retry batches must be sequential
      const agentResults = await this.agent.processRequests(currentRequests)

      // Accumulate per-file cost from every attempt — `totalCostUsd` grows on
      // every call (success OR validation_error); `finalCostUsd`/`finalUsage`
      // only update on success so the final successful attempt's data wins.
      // Per-call cost uses `result.model` so pipeline-mode pricing (Sonnet for
      // audio/video, Opus for comics) is accurate; falls back to the
      // agent-level model for the rare result that doesn't carry one.
      for (const result of agentResults) {
        if (!result.usage) continue
        const acc = costByCustomId.get(result.customId) ?? {finalCostUsd: 0, finalUsage: null, totalCostUsd: 0}
        const modelForCost = result.model ?? this.agent.model
        const thisCostUsd = computeCost(modelForCost, result.usage).totalUsd
        acc.totalCostUsd += thisCostUsd
        if (result.status === 'success') {
          acc.finalCostUsd = thisCostUsd
          acc.finalUsage = result.usage
        }

        costByCustomId.set(result.customId, acc)
      }

      // Emit one telemetry row per agent result. Logged from here (not the
      // agent) so the row carries retry-loop context (`attempt`) and the
      // generator's UUID (`runId`) that groups every file from one
      // `generate()` invocation. Failures inside the telemetry layer must
      // not crash the generation run — log and continue.
      // eslint-disable-next-line no-await-in-loop -- single append per batch keeps disk traffic bounded and ordered
      await this.emitTelemetry(agentResults, idToFilePath, runId, attempt)

      // Triage results: successes/errors go to validResults for writing,
      // validation failures are tracked for retry or permanent failure
      const validResults: AgentResult[] = []
      const retryIds: string[] = []

      for (const result of agentResults) {
        if (result.status !== 'validation_error') {
          validResults.push(result)
          continue
        }

        const count = (failureCounts.get(result.customId) ?? 0) + 1
        failureCounts.set(result.customId, count)

        // Re-queue for the next batch only if the file still has retries remaining
        // AND there will actually be another loop iteration. The `attempt < MAX_VALIDATION_ATTEMPTS`
        // check is critical: without it, a file failing on the final iteration with count < MAX
        // (which can happen if count and attempt diverge — e.g. agent batch anomalies, future
        // refactors, or a tunable MAX) is added to retryIds but never retried, never logged to
        // failure.csv, and never added to allWriteResults — silently disappearing from output.
        // First three codes give actionable signal in logs without flooding when
        // the schema emits many issues for one file (e.g. a malformed metadata_list
        // can fire `non_mapping_item` per item). Full list still flows into
        // failure.csv so post-hoc analysis sees everything.
        const codes = result.validationCodes ?? []
        if (count < MAX_VALIDATION_ATTEMPTS && attempt < MAX_VALIDATION_ATTEMPTS) {
          retryIds.push(result.customId)
          logger.warn(
            {
              attempt: count,
              codes: codes.slice(0, 3),
              customId: result.customId,
              error: result.error,
              maxAttempts: MAX_VALIDATION_ATTEMPTS,
            },
            'YAML validation failed, will retry',
          )
          continue
        }

        // Either retries exhausted OR final loop iteration — log to failure CSV and record as error
        const mapping = idToFilePath.get(result.customId)
        if (mapping) {
          // eslint-disable-next-line no-await-in-loop -- must log before next iteration
          await MetadataGenerator.logValidationFailure({
            attempts: count,
            costAcc: costByCustomId.get(result.customId),
            error: result.error ?? 'Validation failed',
            filePath: mapping.filePath,
            validationCodes: codes,
          })
          allWriteResults.push({
            error: `Validation failed after ${count} attempt${count === 1 ? '' : 's'}: ${result.error}`,
            filePath: mapping.filePath,
            outputPath: mapping.outputPath,
            status: 'error',
          })
        }

        logger.error(
          {attempts: count, codes: codes.slice(0, 3), customId: result.customId, error: result.error},
          'YAML validation failed permanently, logged to logs/failure.csv',
        )
      }

      // eslint-disable-next-line no-await-in-loop -- must complete before next retry iteration
      const writeResults = await this.writeResults(validResults, idToFilePath, costByCustomId)
      allWriteResults.push(...writeResults)

      // Build the next batch from files that still have retries left
      currentRequests = retryIds
        .map((id) => idToRequest.get(id))
        .filter((r): r is AgentRequest & {outputPath: string} => r !== undefined)
    }

    const results = [...skippedResults, ...allWriteResults]
    const succeeded = results.filter((r) => r.status === 'success').length
    const errored = results.filter((r) => r.status === 'error').length
    const skipped = results.filter((r) => r.status === 'skipped').length
    logger.info({errored, runId, skipped, succeeded, total: results.length}, 'AI metadata generation complete')

    return results
  }

  private buildRequests(filePaths: string[]): {
    requests: Array<AgentRequest & {outputPath: string}>
    skippedResults: GenerationResult[]
  } {
    const requests: Array<AgentRequest & {outputPath: string}> = []
    const skippedResults: GenerationResult[] = []

    for (const [i, filePath] of filePaths.entries()) {
      const baseName = this.outputBaseName ?? path.basename(filePath)
      const outputPath = path.join(path.dirname(filePath), `${baseName}${METADATA_YML_SUFFIX}`)

      if (!this.overwrite && fs.existsSync(outputPath)) {
        skippedResults.push({filePath, outputPath, status: 'skipped'})
        continue
      }

      const customId = MetadataGenerator.filePathToCustomId(filePath, i)
      const userMessage = buildUserMessage(filePath)
      requests.push({customId, filePath, outputPath, userMessage})
    }

    return {requests, skippedResults}
  }

  /**
   * Writes one telemetry row per agent result for the current batch attempt.
   * Each row carries the file path, pipeline name, model, full token + latency
   * breakdown, status, attempt number, and calibrated cost. Rows for skipped
   * files are NOT emitted — telemetry is per API call, not per generation
   * request. Errors here are logged and swallowed so a telemetry failure
   * can never abort an otherwise-successful run.
   */
  private async emitTelemetry(
    agentResults: AgentResult[],
    idToFilePath: Map<string, {filePath: string; outputPath: string}>,
    runId: string,
    attempt: number,
  ): Promise<void> {
    const rows: TelemetryRow[] = []
    const timestamp = new Date().toISOString()

    for (const result of agentResults) {
      const mapping = idToFilePath.get(result.customId)
      const usage: RawAgentUsage = result.usage ?? zeroUsage()
      const model = result.model ?? this.agent.model
      const costUsd = result.usage ? computeCost(model, result.usage).totalUsd : 0

      rows.push({
        attempt,
        cachedInputTokens: usage.cacheReadInputTokens,
        cacheWriteTokens: usage.cacheCreationInputTokens,
        costUsd,
        file: mapping?.filePath ?? result.customId,
        latencyMs: usage.latencyMs,
        model,
        pipeline: result.pipeline ?? 'unknown',
        runId,
        stage: 0,
        status: result.status,
        timestamp,
        tokensIn: usage.inputTokens,
        tokensOut: usage.outputTokens,
        validationCodes: (result.validationCodes ?? []).join(';'),
        webSearches: usage.webSearchRequests,
      })
    }

    try {
      await appendRunRows(rows)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn({error: message, runId}, 'Failed to append telemetry rows to logs/metadata-runs.csv')
    }
  }

  private async writeResults(
    agentResults: AgentResult[],
    idToFilePath: Map<string, {filePath: string; outputPath: string}>,
    costByCustomId: Map<string, FileCostAccum>,
  ): Promise<GenerationResult[]> {
    const resultPromises: Promise<GenerationResult>[] = []

    for (const result of agentResults) {
      const mapping = idToFilePath.get(result.customId)
      if (!mapping) {
        logger.warn({customId: result.customId}, 'Unknown customId in agent results')
        continue
      }

      const {filePath, outputPath} = mapping

      if (result.status === 'success' && result.yaml) {
        // Inject the ai:cost / ai:cost_all / ai:tokens_in / ai:tokens_out fields
        // using the accumulated retry-aware cost record. If no cost record exists
        // (e.g. usage was unavailable from the agent), skip injection rather than
        // writing zeros that would be indistinguishable from a $0 generation.
        const acc = costByCustomId.get(result.customId)
        const yamlToWrite = acc?.finalUsage
          ? postProcessWithCost(result.yaml, this.agent.model, {
              cost: acc.finalCostUsd,
              costAll: acc.totalCostUsd,
              tokensIn: acc.finalUsage.inputTokens,
              tokensOut: acc.finalUsage.outputTokens,
            })
          : result.yaml

        resultPromises.push(
          (async (): Promise<GenerationResult> => {
            try {
              await fsp.writeFile(outputPath, yamlToWrite + '\n', 'utf8')
              logger.info({outputPath}, 'Wrote .eivu.yml file')
              return {filePath, outputPath, status: 'success', yaml: yamlToWrite}
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              logger.error({error: message, outputPath}, 'Failed to write .eivu.yml file')
              return {error: `Failed to write file: ${message}`, filePath, outputPath, status: 'error'}
            }
          })(),
        )
      } else {
        resultPromises.push(
          Promise.resolve({error: result.error ?? 'Unknown error', filePath, outputPath, status: 'error'}),
        )
      }
    }

    return Promise.all(resultPromises)
  }
}
