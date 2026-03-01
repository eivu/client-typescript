import type {AgentOptions, AgentRequest, AgentResult} from '@src/ai/types'

import {BaseAgent} from '@src/ai/base-agent'

const GEMINI_DEFAULTS = {
  maxTokens: 8192,
  model: 'gemini-2.0-flash',
  pollIntervalMs: 30_000,
} as const

export class GeminiAgent extends BaseAgent {
  constructor(options: AgentOptions = {}) {
    super(options, GEMINI_DEFAULTS)
  }

  async processRequests(_requests: AgentRequest[]): Promise<AgentResult[]> {
    throw new Error(
      'Gemini agent is not yet implemented. Install the @google/generative-ai package and implement the batch API integration.',
    )
  }
}
