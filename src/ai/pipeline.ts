import type {AssemblerMediaType} from '@src/ai/prompt-assembler'

/**
 * Internal pipeline name. Maps 1:1 to media categories:
 *   - `comics` / `audio` / `video` correspond to the three known media types
 *     served by `PromptAssembler` (matching the fragment directory layout).
 *   - `other` covers non-media files (anything `getMediaCategory()` returns
 *     `'other'` for). The v7.16.4 monolith is used as its system prompt.
 *
 * Note the plural `comics` vs the singular `'comic'` returned by
 * `getMediaCategory()`. `resolvePipeline()` performs that mapping once.
 */
export type PipelineName = 'other' | AssemblerMediaType

/**
 * One stage of a pipeline = one Anthropic API call. Carries everything needed
 * to build that call: model, system prompt, user-message builder, tool budget.
 *
 * Phase 2 primary uses single-stage pipelines. Multi-stage support is in the
 * type so a future Phase 2+ sub-experiment can reactivate two-stage (research
 * then score & format) without a type change, but `ClaudeAgent` only consumes
 * `stages[0]` today.
 */
export type Stage = {
  /** Build the per-request user message from the file path. */
  buildUserMessage: (filePath: string) => string
  /** Max output tokens for the model on this stage. */
  maxTokens: number
  /** Anthropic model identifier, e.g. `claude-opus-4-6`. */
  model: string
  /**
   * Pre-assembled system prompt for this stage. The pipeline factories call
   * `PromptAssembler.assemble()` (or read the monolith) once when the
   * pipeline is built so the string is byte-stable across every request
   * targeting this stage — that's what keeps the Anthropic prompt cache hot.
   *
   * MUST be byte-deterministic per `(pipelineName, stageIndex)`. Run-time
   * substitution (file path, timestamps, etc.) would defeat caching.
   */
  systemPrompt: string
  /**
   * Max web searches per call. 0 disables web search entirely. Default
   * production budget is 10 (matching the v7.16.4 monolith era).
   */
  webSearchMaxUses: number
}

/**
 * A complete pipeline for one media category. Ordered `stages` run
 * sequentially in a multi-stage future; for Phase 2 primary the array always
 * has length 1.
 */
export type Pipeline = {
  /** Media-category name this pipeline serves. */
  name: PipelineName
  /** Ordered stages. Single-stage Phase 2 primary has length 1. */
  stages: Stage[]
}
