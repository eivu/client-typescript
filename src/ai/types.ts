import type {Pipeline, PipelineName} from '@src/ai/pipeline'

/** Supported AI agent providers for metadata generation. */
export type AgentType = 'claude' | 'gemini' | 'openai'

/** A single request sent to an agent (one file, one user message). */
export type AgentRequest = {
  customId: string
  filePath: string
  userMessage: string
}

/** Result from an agent for one request (success with YAML, validation error, or error). */
export type AgentResult = {
  customId: string
  error?: string
  /**
   * Model that actually executed this request. In pipeline mode that's
   * `pipeline.stages[0].model`; in static (spike) mode it's the agent-level
   * model. Optional only because legacy error paths may not have it set;
   * MetadataGenerator treats it as the truth for cost + ai:engine.
   */
  model?: string
  /**
   * Pipeline name that handled this request (`comics`, `audio`, `video`,
   * `other`, or `static` for spike runs). Used by telemetry to attribute
   * cost + tokens to the right pipeline.
   */
  pipeline?: string
  /** Preserved for validation_error results so callers can save/log the raw AI output for debugging. */
  rawYaml?: string
  status: 'error' | 'success' | 'validation_error'
  /**
   * Token + web-search usage from the underlying API call. Optional because legacy
   * error paths may not have a usage record. Used by MetadataGenerator to inject
   * ai:cost / ai:tokens_in / ai:tokens_out fields into the final YAML.
   */
  usage?: RawAgentUsage
  /**
   * Phase 3 — populated on `validation_error` results so MetadataGenerator can
   * forward stable codes (`rating_off_step`, `missing_reasoning`, etc.) into
   * telemetry + failure.csv. Empty/undefined on success and on non-validation
   * errors. The retry loop uses this to decide whether to re-prompt; once
   * deterministic-fix routing exists, codes with `retriable: false` will be
   * handed to postprocess instead.
   */
  validationCodes?: string[]
  yaml?: string
}

/** Result of generating metadata for one file (success, skipped, or error with path info). */
export type GenerationResult = {
  error?: string
  filePath: string
  outputPath: string
  status: 'error' | 'skipped' | 'success'
  yaml?: string
}

/** Progress payload for batch processing (counts and batch id). */
export type BatchProgress = {
  canceledRequests: number
  createdAt: string
  endedAt: null | string
  erroredRequests: number
  expiredRequests: number
  id: string
  processingStatus: string
  succeededRequests: number
  totalRequests: number
}

/** Options passed to agent constructors (API key, model, tokens, skill, progress callback). */
export type AgentOptions = {
  apiKey?: string
  maxTokens?: number
  model?: string
  onProgress?: (progress: BatchProgress) => void
  /**
   * Pre-built pipelines to use verbatim, bypassing the default
   * `buildAllPipelines()` construction in `ClaudeAgent`. Provided by spike
   * variants that need per-pipeline overrides (e.g. Sonnet for audio/video
   * while comics stays on Opus). When set, `model` / `maxTokens` /
   * `webSearchMaxUses` are NOT propagated to pipelines — the caller owns the
   * full pipeline shape. Static-mode options (`skillContent`/`skillPath`)
   * take precedence over this if both are set.
   */
  pipelines?: Partial<Record<PipelineName, Pipeline>>
  pollIntervalMs?: number
  skillContent?: string
  skillPath?: string
  /**
   * When true, ClaudeAgent uses blocking, streamed per-file Messages API calls
   * instead of the async Batches API. Faster wall-clock (seconds vs. a queued
   * batch), but bills at full rate — no 50% batch discount. Defaults to false
   * (batch) inside ClaudeAgent so direct/library callers and the spike keep their
   * current behavior; the `process` and `gm:ai` commands default their flag to true.
   */
  sync?: boolean
  /**
   * Sampling temperature (Anthropic default if omitted). Used by the spike's multi-sample
   * variant to draw varied scores from the same prompt; production code leaves this unset.
   */
  temperature?: number
  /**
   * Tool-choice forcing rule. Used by the spike's structured-output variant to require
   * the model emit a specific tool call. Forwarded verbatim to the Anthropic API.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- caller owns the Anthropic ToolChoice shape
  toolChoice?: any
  /**
   * Custom tool list. When provided, replaces the auto-built `web_search` tool derived
   * from `webSearchMaxUses`. Used by the Phase 0 spike's structured-output variant.
   * Caller owns the full tool schema (e.g. an Anthropic tool with input_schema).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- caller owns the Anthropic Tool shape
  tools?: any[]
  /** Max web searches per request (default 10). Set to 0 to disable web search. */
  webSearchMaxUses?: number
}

/**
 * Per-call usage and latency captured by `ClaudeAgent.processRequestsRaw`.
 * Used by the Phase 0 measurement spike to compute per-variant cost and timing.
 */
export type RawAgentUsage = {
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  inputTokens: number
  latencyMs: number
  outputTokens: number
  webSearchRequests: number
}

/**
 * A `RawAgentUsage` with all token/web-search counts zeroed. The single source
 * for the "no usage recorded" record used by error paths, telemetry fallbacks,
 * and the spike harness. `latencyMs` is the one field a caller may want to set
 * (e.g. `ClaudeAgent` reports elapsed time even when a request produced no tokens).
 */
export function zeroUsage(latencyMs = 0): RawAgentUsage {
  return {
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    inputTokens: 0,
    latencyMs,
    outputTokens: 0,
    webSearchRequests: 0,
  }
}

/**
 * Result of one raw (un-validated, un-post-processed) batch request.
 * Returned only by `ClaudeAgent.processRequestsRaw` — production code uses `AgentResult`.
 * `rawText` is the concatenated text-block content; `toolUseInput` is the parsed input of
 * the FIRST tool_use block in the response (used by the structured-output variant).
 */
export type RawAgentResult = {
  customId: string
  error?: string
  rawText: string
  status: 'error' | 'success'
  toolUseInput?: Record<string, unknown>
  toolUseName?: string
  usage: RawAgentUsage
}

/** Options for MetadataGenerator: agent type, overwrite flag, plus AgentOptions. */
export type MetadataGeneratorOptions = AgentOptions & {
  agent?: AgentType
  outputBaseName?: string
  overwrite?: boolean
}
