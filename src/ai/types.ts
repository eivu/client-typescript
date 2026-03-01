export type AgentType = 'claude' | 'gemini' | 'openai'

export type AgentRequest = {
  customId: string
  filePath: string
  userMessage: string
}

export type AgentResult = {
  customId: string
  error?: string
  status: 'error' | 'success'
  yaml?: string
}

export type GenerationResult = {
  error?: string
  filePath: string
  outputPath: string
  status: 'error' | 'skipped' | 'success'
  yaml?: string
}

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

export type AgentOptions = {
  apiKey?: string
  maxTokens?: number
  model?: string
  onProgress?: (progress: BatchProgress) => void
  pollIntervalMs?: number
  skillContent?: string
  skillPath?: string
}

export type MetadataGeneratorOptions = AgentOptions & {
  agent?: AgentType
  overwrite?: boolean
}
