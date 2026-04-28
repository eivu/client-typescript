import {Args, Command, Flags} from '@oclif/core'
import {postProcess} from '@src/ai/base-agent'
import * as fs from 'node:fs'

export default class GenerateMetadataPostProcess extends Command {
  static override aliases = ['gm:post-process', 'gm:pp']
  static override args = {
    file: Args.string({description: 'path to an .eivu.yml file to post-process', required: true}),
  }
  static override description = 'Run an AI-generated .eivu.yml file through the post-process pipeline and print the result'
  static override examples = [
    '<%= config.bin %> <%= command.id %> path/to/file.eivu.yml',
    '<%= config.bin %> <%= command.id %> path/to/file.eivu.yml --model claude-opus-4-6',
  ]
  static override flags = {
    model: Flags.string({
      char: 'm',
      description: 'override the ai:engine model value (defaults to the value already in the YAML)',
    }),
  }

  private static extractModel(yaml: string): string | undefined {
    const match = yaml.match(/^\s*- ai:engine:\s*(.+)$/m)
    return match?.[1].trim()
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(GenerateMetadataPostProcess)
    const {file} = args

    if (!fs.existsSync(file)) {
      this.error(`File not found: ${file}`)
    }

    const yaml = fs.readFileSync(file, 'utf8')

    const model = flags.model ?? GenerateMetadataPostProcess.extractModel(yaml) ?? 'unknown'
    const result = postProcess(yaml, model)

    this.log(result)
  }
}
