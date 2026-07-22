import {describe, expect, it, jest} from '@jest/globals'

import type {Pipeline} from '../src/ai/pipeline'
import type {AgentRequest} from '../src/ai/types'

import {ClaudeAgent} from '../src/ai/claude-agent'

// A syntactically valid .eivu.yml (non-empty `name` + `metadata_list` array of mappings)
// so it clears validateEivuYaml and comes back as a `success` result.
const VALID_YAML = 'name: Test Book\nmetadata_list:\n  - ai:engine: placeholder\n'

/** Builds a fake Anthropic.Message the sync path's `.finalMessage()` resolves to. */
function fakeMessage(yaml: string): unknown {
  return {
    content: [{text: '```yaml\n' + yaml + '```', type: 'text'}],
    // eslint-disable-next-line camelcase -- Anthropic API uses snake_case
    usage: {input_tokens: 100, output_tokens: 20},
  }
}

/** Replaces the agent's Anthropic client `messages.stream` with a scripted stub. */
function stubStream(agent: ClaudeAgent, finalMessage: () => Promise<unknown>): jest.Mock {
  const stream = jest.fn(() => ({finalMessage}))
  ;(agent as unknown as {client: {messages: {stream: unknown}}}).client = {messages: {stream}}
  return stream as unknown as jest.Mock
}

function request(customId: string, filePath: string): AgentRequest {
  return {customId, filePath, userMessage: 'generate metadata'}
}

/** A minimal single-stage pipeline (no disk access) for pipeline-mode agent construction. */
function fakePipeline(name: Pipeline['name']): Pipeline {
  return {
    name,
    stages: [{buildUserMessage: () => 'msg', maxTokens: 100, model: 'claude-opus-4-6', systemPrompt: 'prompt', webSearchMaxUses: 0}],
  }
}

describe('ClaudeAgent sync mode', () => {
  it('processes requests with blocking streamed calls and returns success results', async () => {
    // Static mode (skillContent) so there is no pipeline resolution or disk access.
    const agent = new ClaudeAgent({skillContent: 'skill', sync: true})
    const stream = stubStream(agent, async () => fakeMessage(VALID_YAML))

    const results = await agent.processRequests([request('00001-a', '/tmp/a.cbz'), request('00002-b', '/tmp/b.cbz')])

    expect(stream).toHaveBeenCalledTimes(2)
    expect(results).toHaveLength(2)
    for (const r of results) {
      expect(r.status).toBe('success')
      expect(r.yaml).toContain('name: Test Book')
    }
  })

  it('captures a single request failure as an error result without aborting the others', async () => {
    const agent = new ClaudeAgent({skillContent: 'skill', sync: true})
    let call = 0
    stubStream(agent, async () => {
      call += 1
      if (call === 1) throw new Error('rate limited')
      return fakeMessage(VALID_YAML)
    })

    const results = await agent.processRequests([request('00001-a', '/tmp/a.cbz'), request('00002-b', '/tmp/b.cbz')])

    expect(results).toHaveLength(2)
    const byId = new Map(results.map((r) => [r.customId, r]))
    expect(byId.get('00001-a')?.status).toBe('error')
    expect(byId.get('00001-a')?.error).toContain('rate limited')
    expect(byId.get('00002-b')?.status).toBe('success')
  })

  it('captures a per-file pipeline-config error without aborting the batch', async () => {
    // Pipeline mode with ONLY comics configured: the .mp3 routes to the missing
    // audio pipeline, so selectStageConfig throws. That must become a per-file
    // error result, not reject the whole Promise.all and lose the .cbz success.
    const agent = new ClaudeAgent({pipelines: {comics: fakePipeline('comics')}, sync: true})
    const stream = stubStream(agent, async () => fakeMessage(VALID_YAML))

    const results = await agent.processRequests([request('00001-a', '/tmp/a.cbz'), request('00002-b', '/tmp/b.mp3')])

    // Stream only fires for the comics file; the audio file fails before any API call.
    expect(stream).toHaveBeenCalledTimes(1)
    expect(results).toHaveLength(2)
    const byId = new Map(results.map((r) => [r.customId, r]))
    expect(byId.get('00001-a')?.status).toBe('success')
    expect(byId.get('00002-b')?.status).toBe('error')
    expect(byId.get('00002-b')?.error).toContain('No pipeline configured')
  })
})
