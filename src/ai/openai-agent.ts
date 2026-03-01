import type {AgentOptions, AgentRequest, AgentResult} from '@src/ai/types'

import {BaseAgent} from '@src/ai/base-agent'

const OPENAI_DEFAULTS = {
  maxTokens: 8192,
  model: 'gpt-4o',
  pollIntervalMs: 30_000,
} as const

export class OpenAIAgent extends BaseAgent {
  constructor(options: AgentOptions = {}) {
    super(options, OPENAI_DEFAULTS)
  }

  async processRequests(_requests: AgentRequest[]): Promise<AgentResult[]> {
    throw new Error(
      'OpenAI agent is not yet implemented. Install the openai package and implement the batch API integration.',
    )
  }
}
