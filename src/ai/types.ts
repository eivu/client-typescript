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
  status: 'error' | 'success' | 'validation_error'
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
  pollIntervalMs?: number
  skillContent?: string
  skillPath?: string
  /** Max web searches per request (default 10). Set to 0 to disable web search. */
  webSearchMaxUses?: number
}

/** Options for MetadataGenerator: agent type, overwrite flag, plus AgentOptions. */
export type MetadataGeneratorOptions = AgentOptions & {
  agent?: AgentType
  overwrite?: boolean
}
