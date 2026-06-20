import {Command} from '@oclif/core'
import {buildAllPipelines} from '@src/ai/pipelines/index'

/**
 * Renders the pipeline-list table as a plain-text string. Exported for tests
 * so they can call this directly without going through oclif's command-loading
 * machinery (which expects built `dist/` output).
 */
export function renderPipelineList(): string {
  const pipelines = buildAllPipelines()
  const headers = ['name', 'model', 'webSearch', 'maxTokens', 'promptChars']
  const dataRows = (['comics', 'audio', 'video', 'other'] as const)
    .filter((name) => pipelines[name])
    .map((name) => {
      const stage = pipelines[name]!.stages[0]
      return [name, stage.model, String(stage.webSearchMaxUses), String(stage.maxTokens), String(stage.systemPrompt.length)]
    })

  if (dataRows.length === 0) {
    return 'No production pipelines are available — check src/ai/pipelines/ and the v7.16.4 monolith presence.'
  }

  const widths = headers.map((h, i) => Math.max(h.length, ...dataRows.map((r) => r[i].length)))
  const sep = '  '
  const formatRow = (cells: string[]): string => cells.map((cell, i) => cell.padEnd(widths[i])).join(sep)
  return [formatRow(headers), ...dataRows.map((r) => formatRow(r))].join('\n')
}

export default class GenerateMetadataPipelineList extends Command {
  static override aliases = ['gm:pipeline-list']
  static override description = 'List all production AI metadata pipelines and their per-stage configuration'
  static override examples = ['<%= config.bin %> <%= command.id %>']

  public async run(): Promise<void> {
    this.log(renderPipelineList())
  }
}
