import {type BaseAgent, buildUserMessage} from '@src/ai/base-agent'
import {ClaudeAgent} from '@src/ai/claude-agent'
import {GeminiAgent} from '@src/ai/gemini-agent'
import {OpenAIAgent} from '@src/ai/openai-agent'
import type {AgentRequest, AgentType, GenerationResult, MetadataGeneratorOptions} from '@src/ai/types'
import {METADATA_YML_SUFFIX} from '@src/constants'
import logger from '@src/logger'
import * as fs from 'node:fs'
import {promises as fsp} from 'node:fs'
import path from 'node:path'

function createAgent(type: AgentType, options: MetadataGeneratorOptions): BaseAgent {
  switch (type) {
    case 'claude': {
      return new ClaudeAgent(options)
    }

    case 'openai': {
      return new OpenAIAgent(options)
    }

    case 'gemini': {
      return new GeminiAgent(options)
    }

    default: {
      throw new Error(`Unknown agent type: ${type as string}`)
    }
  }
}

export class MetadataGenerator {
  readonly overwrite: boolean

  private agent: BaseAgent

  constructor(options: MetadataGeneratorOptions = {}) {
    const agentType = options.agent ?? 'claude'
    this.overwrite = options.overwrite ?? false
    this.agent = createAgent(agentType, options)
  }

  static async generate(
    filePaths: string[],
    options?: MetadataGeneratorOptions,
  ): Promise<GenerationResult[]> {
    const generator = new MetadataGenerator(options)
    return generator.generate(filePaths)
  }

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

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i]
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
    const results: GenerationResult[] = []

    for (const result of agentResults) {
      const mapping = idToFilePath.get(result.customId)
      if (!mapping) {
        logger.warn({customId: result.customId}, 'Unknown customId in agent results')
        continue
      }

      const {filePath, outputPath} = mapping

      if (result.status === 'success' && result.yaml) {
        try {
          await fsp.writeFile(outputPath, result.yaml + '\n', 'utf-8')
          results.push({filePath, outputPath, status: 'success', yaml: result.yaml})
          logger.info({outputPath}, 'Wrote .eivu.yml file')
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          results.push({error: `Failed to write file: ${message}`, filePath, outputPath, status: 'error'})
          logger.error({error: message, outputPath}, 'Failed to write .eivu.yml file')
        }
      } else {
        results.push({error: result.error ?? 'Unknown error', filePath, outputPath, status: 'error'})
      }
    }

    return results
  }

  private static filePathToCustomId(filePath: string, index: number): string {
    const basename = path
      .basename(filePath)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50)
    return `${String(index).padStart(5, '0')}-${basename}`.slice(0, 64)
  }
}
