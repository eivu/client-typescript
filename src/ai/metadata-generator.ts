import type {AgentRequest, AgentType, GenerationResult, MetadataGeneratorOptions} from '@src/ai/types'

import {type BaseAgent, buildUserMessage} from '@src/ai/base-agent'
import {ClaudeAgent} from '@src/ai/claude-agent'
import {GeminiAgent} from '@src/ai/gemini-agent'
import {OpenAIAgent} from '@src/ai/openai-agent'
import {METADATA_YML_SUFFIX} from '@src/constants'
import logger from '@src/logger'
import * as fs from 'node:fs'
import {promises as fsp} from 'node:fs'
import path from 'node:path'

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

  /**
   * Creates a MetadataGenerator with the given options.
   * @param options - Agent type, overwrite flag, API key, model, skill content/path, etc. (default: { agent: 'claude', overwrite: false })
   */
  constructor(options: MetadataGeneratorOptions = {}) {
    const agentType = options.agent ?? 'claude'
    this.overwrite = options.overwrite ?? false
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

    logger.info(
      {skipped: skippedResults.length, toProcess: requests.length, total: filePaths.length},
      'Processing files for AI metadata generation',
    )

    const agentResults = await this.agent.processRequests(requests)

    const idToFilePath = new Map(requests.map((r) => [r.customId, {filePath: r.filePath, outputPath: r.outputPath}]))
    const writeResults = await this.writeResults(agentResults, idToFilePath)

    const results = [...skippedResults, ...writeResults]
    const succeeded = results.filter((r) => r.status === 'success').length
    const errored = results.filter((r) => r.status === 'error').length
    const skipped = results.filter((r) => r.status === 'skipped').length
    logger.info({errored, skipped, succeeded, total: results.length}, 'AI metadata generation complete')

    return results
  }

  private buildRequests(filePaths: string[]): {
    requests: Array<AgentRequest & {outputPath: string}>
    skippedResults: GenerationResult[]
  } {
    const requests: Array<AgentRequest & {outputPath: string}> = []
    const skippedResults: GenerationResult[] = []

    for (const [i, filePath] of filePaths.entries()) {
      const outputPath = `${filePath}${METADATA_YML_SUFFIX}`

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

  private async writeResults(
    agentResults: Array<{customId: string; error?: string; status: string; yaml?: string}>,
    idToFilePath: Map<string, {filePath: string; outputPath: string}>,
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
        resultPromises.push(
          (async (): Promise<GenerationResult> => {
            try {
              await fsp.writeFile(outputPath, result.yaml + '\n', 'utf8')
              logger.info({outputPath}, 'Wrote .eivu.yml file')
              return {filePath, outputPath, status: 'success', yaml: result.yaml}
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
