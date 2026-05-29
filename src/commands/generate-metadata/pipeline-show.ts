import type {PipelineName} from '@src/ai/pipeline'

import {Args, Command, Flags} from '@oclif/core'
import {buildAllPipelines} from '@src/ai/pipelines/index'
import {type AssemblerMediaType, fragmentsFor} from '@src/ai/prompt-assembler'

const PREVIEW_CHARS = 200
const APPROX_CHARS_PER_TOKEN = 4

/**
 * Renders the tree view for one pipeline. Returns `{output, systemPrompt}` —
 * `output` is the tree (always shown); `systemPrompt` is only used when the
 * `--prompt` flag is set. `null` when the named pipeline isn't available.
 */
export function renderPipelineShow(name: PipelineName): null | {output: string; systemPrompt: string} {
  const pipelines = buildAllPipelines()
  const pipeline = pipelines[name]
  if (!pipeline) return null

  const stage = pipeline.stages[0]
  const fragmentsList = name === 'other' ? null : fragmentsFor(name as AssemblerMediaType)

  const preview = stage.systemPrompt
    .slice(0, PREVIEW_CHARS)
    .replaceAll('\n', ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()

  const approxTokens = Math.round(stage.systemPrompt.length / APPROX_CHARS_PER_TOKEN)

  const lines = [
    name,
    `└── Stage 0`,
    `    ├── model:            ${stage.model}`,
    `    ├── maxTokens:        ${stage.maxTokens}`,
    `    ├── webSearchMaxUses: ${stage.webSearchMaxUses}`,
    `    ├── systemPrompt:     [${stage.systemPrompt.length} chars, ~${approxTokens} tokens]`,
    `    │   ├── First ${PREVIEW_CHARS} chars: ${preview}`,
  ]

  if (fragmentsList) {
    lines.push(`    │   └── Fragments: ${fragmentsList.join(', ')} (${fragmentsList.length} total)`)
  } else {
    lines.push(`    │   └── Fragments: (the v7.16.4 monolith — single file, not assembled)`)
  }

  lines.push(`    └── buildUserMessage: (function from base-agent.ts)`)
  return {output: lines.join('\n'), systemPrompt: stage.systemPrompt}
}

export default class GenerateMetadataPipelineShow extends Command {
  static override aliases = ['gm:pipeline-show']
  static override args = {
    name: Args.string({
      description: 'pipeline name (comics, audio, video, other)',
      options: ['audio', 'comics', 'other', 'video'],
      required: true,
    }),
  }
  static override description = 'Print a pipeline\'s stage configuration and (optionally) the assembled system prompt'
  static override examples = [
    '<%= config.bin %> <%= command.id %> comics',
    '<%= config.bin %> <%= command.id %> audio --prompt',
  ]
  static override flags = {
    prompt: Flags.boolean({
      default: false,
      description: 'dump the full assembled system prompt to stdout (useful for cache-miss debugging)',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(GenerateMetadataPipelineShow)
    const name = args.name as PipelineName

    const rendered = renderPipelineShow(name)
    if (!rendered) {
      this.error(
        `Pipeline "${name}" is not available. ` +
          (name === 'other'
            ? 'The "other" pipeline requires the v7.16.4 monolith at src/ai/prompts/claude/EIVU_METADATA_SKILL_v7_16_4_RUNTIME.md.'
            : 'Run `eivu gm:pipeline-list` to see available pipelines.'),
      )
    }

    this.log(rendered.output)
    if (flags.prompt) {
      this.log('')
      this.log('--- Assembled system prompt ---')
      this.log(rendered.systemPrompt)
    }
  }
}
