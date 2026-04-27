import type {AgentRequest, AgentResult} from '@src/ai/types'

import {describe, expect, it} from '@jest/globals'
import {buildUserMessage, extractYamlFromResponse} from '@src/ai/base-agent'
import {ClaudeAgent} from '@src/ai/claude-agent'
import {GeminiAgent} from '@src/ai/gemini-agent'
import {MetadataGenerator} from '@src/ai/metadata-generator'
import {OpenAIAgent} from '@src/ai/openai-agent'
import {METADATA_YML_SUFFIX} from '@src/constants'
import {promises as fsp} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const MINIMAL_SKILL_CONTENT = '# EIVU Metadata Runtime v7.16.1\nMinimal test content'

/**
 * Helpers for retry-loop tests. The scripted agent returns pre-configured
 * AgentResult arrays per call so individual tests can control which customIds
 * are reported as validation_error each attempt and exercise the retry loop's
 * boundary conditions without spinning up real LLM clients.
 */
type ScriptStep = (requests: AgentRequest[]) => AgentResult[]
function installScriptedAgent(generator: MetadataGenerator, script: ScriptStep[]): {callCount: () => number} {
  let callIdx = 0
  const fakeAgent = {
    maxTokens: 0,
    model: 'mock-model',
    pollIntervalMs: 0,
    async processRequests(requests: AgentRequest[]): Promise<AgentResult[]> {
      const step = script[callIdx]
      callIdx += 1
      return step ? step(requests) : []
    },
  }
  ;(generator as unknown as {agent: typeof fakeAgent}).agent = fakeAgent
  return {callCount: () => callIdx}
}

/**
 * Sets up a clean tmpdir + chdir into it (so MetadataGenerator's relative
 * `logs/failure.csv` write lands inside the test's sandbox). Returns a cleanup
 * function that restores cwd and removes the tmpdir. Using a flat setup/cleanup
 * pair instead of a wrapper avoids exceeding the project's nested-callback limit.
 */
async function setupTmpEnv(): Promise<{
  cleanup: () => Promise<void>
  failureLog: string
  tmpDir: string
}> {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'eivu-retry-test-'))
  const prevCwd = process.cwd()
  process.chdir(tmpDir)
  async function cleanup(): Promise<void> {
    process.chdir(prevCwd)
    await fsp.rm(tmpDir, {force: true, recursive: true})
  }

  return {
    cleanup,
    failureLog: path.join(tmpDir, 'logs', 'failure.csv'),
    tmpDir,
  }
}

const alwaysValidationError: ScriptStep = (requests) =>
  requests.map((r) => ({customId: r.customId, error: 'bad yaml', status: 'validation_error'}))

function findRequestIdBySuffix(requests: AgentRequest[], suffix: string): string {
  const r = requests.find((req) => req.filePath.endsWith(suffix))
  if (!r) throw new Error(`Could not find request for ${suffix}`)
  return r.customId
}

describe('AI metadata', () => {
  describe('shared helpers', () => {
  describe('buildUserMessage', () => {
    it('includes the basename of the file path', () => {
      const msg = buildUserMessage('/Users/jinx/queue/Space_Adventures_033.eivu_compressed.cbr')
      expect(msg).toContain('Space_Adventures_033.eivu_compressed.cbr')
    })

    it('strips the directory, only includes the filename', () => {
      const msg = buildUserMessage('/Users/jinx/queue/deep/nested/Batman_001.cbz')
      expect(msg).not.toContain('/Users/jinx/queue/deep/nested/')
      expect(msg).toContain('Batman_001.cbz')
    })

    it('comic files get comic-specific research workflow', () => {
      const msg = buildUserMessage('/path/to/Batman_Vol1.cbr')
      expect(msg).toContain('Batman_Vol1.cbr')
      // Comic-specific sources and terminology
      expect(msg).toMatch(/trade paperback|omnibus|single issue/i)
      expect(msg).toMatch(/dc\.com|marvel\.com|comics\.org|Grand Comics Database/i)
      expect(msg).toMatch(/penciller|inker|colorist|letterer/i)
    })

    it('audio files get audio-specific research workflow', () => {
      const msg = buildUserMessage('/path/to/song.mp3')
      expect(msg).toContain('song.mp3')
      // Audio-specific sources
      expect(msg).toMatch(/AllMusic|Discogs|Pitchfork|Metacritic/i)
      // Must NOT contain comic-specific terms
      expect(msg).not.toMatch(/trade paperback|omnibus|dc\.com|marvel\.com|Grand Comics Database/i)
      expect(msg).not.toMatch(/penciller|inker|colorist|letterer/i)
    })

    it('video files get video-specific research workflow', () => {
      const msg = buildUserMessage('/path/to/clip.mp4')
      expect(msg).toContain('clip.mp4')
      // Video-specific sources
      expect(msg).toMatch(/IMDb|Rotten Tomatoes|Metacritic/i)
      // Must NOT contain comic-specific terms
      expect(msg).not.toMatch(/trade paperback|omnibus|dc\.com|marvel\.com|Grand Comics Database/i)
      expect(msg).not.toMatch(/penciller|inker|colorist|letterer/i)
    })

    it('asks to create an eivu file using the runtime', () => {
      const msg = buildUserMessage('/path/to/file.cbr')
      expect(msg.toLowerCase()).toContain('eivu')
      expect(msg.toLowerCase()).toContain('runtime')
    })
  })

  describe('extractYamlFromResponse', () => {
    it('extracts plain YAML text', () => {
      const content = [{text: 'name: Test\nyear: 2023', type: 'text'}]
      expect(extractYamlFromResponse(content)).toBe('name: Test\nyear: 2023')
    })

    it('strips markdown yaml code fences', () => {
      const content = [{text: '```yaml\nname: Test\nyear: 2023\n```', type: 'text'}]
      expect(extractYamlFromResponse(content)).toBe('name: Test\nyear: 2023')
    })

    it('strips markdown yml code fences', () => {
      const content = [{text: '```yml\nname: Test\n```', type: 'text'}]
      expect(extractYamlFromResponse(content)).toBe('name: Test')
    })

    it('strips bare code fences', () => {
      const content = [{text: '```\nname: Test\n```', type: 'text'}]
      expect(extractYamlFromResponse(content)).toBe('name: Test')
    })

    it('handles multiple content blocks', () => {
      const content = [
        {text: 'name: Test\n', type: 'text'},
        {text: 'year: 2023', type: 'text'},
      ]
      expect(extractYamlFromResponse(content)).toBe('name: Test\n\nyear: 2023')
    })

    it('ignores non-text blocks', () => {
      const content = [
        {id: 'abc', type: 'tool_use'},
        {text: 'name: Test', type: 'text'},
      ]
      expect(extractYamlFromResponse(content)).toBe('name: Test')
    })

    it('trims whitespace', () => {
      const content = [{text: '  \nname: Test\nyear: 2023\n  ', type: 'text'}]
      expect(extractYamlFromResponse(content)).toBe('name: Test\nyear: 2023')
    })

    it('returns empty string for empty content', () => {
      expect(extractYamlFromResponse([])).toBe('')
    })
  })
  })

  describe('MetadataGenerator', () => {
  describe('constructor', () => {
    it('defaults to claude agent', () => {
      const generator = new MetadataGenerator({
        apiKey: 'test-key',
        skillContent: MINIMAL_SKILL_CONTENT,
      })
      expect(generator).toBeInstanceOf(MetadataGenerator)
    })

    it('accepts agent type option', () => {
      const generator = new MetadataGenerator({
        agent: 'claude',
        apiKey: 'test-key',
        skillContent: MINIMAL_SKILL_CONTENT,
      })
      expect(generator).toBeInstanceOf(MetadataGenerator)
    })

    it('accepts overwrite option', () => {
      const generator = new MetadataGenerator({
        apiKey: 'test-key',
        overwrite: true,
        skillContent: MINIMAL_SKILL_CONTENT,
      })
      expect(generator.overwrite).toBe(true)
    })
  })

  describe('generate', () => {
    it('returns empty array for empty input', async () => {
      const generator = new MetadataGenerator({
        apiKey: 'test-key',
        skillContent: MINIMAL_SKILL_CONTENT,
      })
      const results = await generator.generate([])
      expect(results).toEqual([])
    })

    it('skips files that already have .eivu.yml when overwrite is false', async () => {
      const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'eivu-test-'))
      const file1 = path.join(tmpDir, 'file1.cbr')
      const file2 = path.join(tmpDir, 'file2.cbr')
      const yml1 = `${file1}${METADATA_YML_SUFFIX}`
      const yml2 = `${file2}${METADATA_YML_SUFFIX}`

      try {
        await fsp.writeFile(file1, '')
        await fsp.writeFile(file2, '')
        await fsp.writeFile(yml1, 'name: existing1')
        await fsp.writeFile(yml2, 'name: existing2')

        const generator = new MetadataGenerator({
          apiKey: 'test-key',
          overwrite: false,
          skillContent: MINIMAL_SKILL_CONTENT,
        })

        const results = await generator.generate([file1, file2])

        expect(results).toHaveLength(2)
        expect(results[0].status).toBe('skipped')
        expect(results[0].filePath).toBe(file1)
        expect(results[0].outputPath).toBe(yml1)
        expect(results[1].status).toBe('skipped')
        expect(results[1].filePath).toBe(file2)
      } finally {
        await fsp.rm(tmpDir, {force: true, recursive: true})
      }
    })

    it('logs and records permanent failure when a file fails validation on every attempt', async () => {
      const {cleanup, failureLog, tmpDir} = await setupTmpEnv()
      try {
        const file = path.join(tmpDir, 'always-fails.cbr')
        await fsp.writeFile(file, '')

        const generator = new MetadataGenerator({
          apiKey: 'test-key',
          overwrite: true,
          skillContent: MINIMAL_SKILL_CONTENT,
        })

        const tracker = installScriptedAgent(generator, [
          alwaysValidationError,
          alwaysValidationError,
          alwaysValidationError,
        ])

        const results = await generator.generate([file])

        expect(tracker.callCount()).toBe(3)
        expect(results).toHaveLength(1)
        expect(results[0].status).toBe('error')
        expect(results[0].error).toContain('Validation failed')
        expect(results[0].filePath).toBe(file)

        const csv = await fsp.readFile(failureLog, 'utf8')
        expect(csv).toContain(file)
        expect(csv).toContain('bad yaml')
      } finally {
        await cleanup()
      }
    })

    it('does not silently drop files when count < MAX_VALIDATION_ATTEMPTS on the final iteration', async () => {
      // This regression test exposes a structural bug in the retry loop: previously, if a file's
      // failureCount was < MAX_VALIDATION_ATTEMPTS on the final attempt, it was queued into
      // retryIds (and a "will retry" warning was logged), but the loop exited immediately after,
      // so the file was never retried, never logged to failure.csv, and never added to results —
      // it silently disappeared.
      //
      // We construct the divergence between attempt and count by having the scripted agent return
      // results for a customId that was NOT in the current batch (file B), simulating an agent
      // that re-emits a prior file's customId. By the time we reach attempt 3, fileB's count is
      // only 2 (incremented in attempts 2 and 3 — never in attempt 1, where the agent dropped it),
      // so under the old condition `count < MAX_VALIDATION_ATTEMPTS`, fileB would silently disappear.
      const {cleanup, failureLog, tmpDir} = await setupTmpEnv()
      try {
        const fileA = path.join(tmpDir, 'file-a.cbr')
        const fileB = path.join(tmpDir, 'file-b.cbr')
        await fsp.writeFile(fileA, '')
        await fsp.writeFile(fileB, '')

        const generator = new MetadataGenerator({
          apiKey: 'test-key',
          overwrite: true,
          skillContent: MINIMAL_SKILL_CONTENT,
        })

        // Captured ids let later steps reference customIds that aren't in their own batch.
        let idA = ''
        let idB = ''

        const script: ScriptStep[] = [
          // Attempt 1: agent processes [A, B] but only emits a result for A.
          //   - A: count 0→1, queued for retry.
          //   - B: silently dropped from agentResults (no count increment, not in retryIds).
          // currentRequests for attempt 2 is just [A].
          (requests) => {
            idA = findRequestIdBySuffix(requests, 'file-a.cbr')
            idB = findRequestIdBySuffix(requests, 'file-b.cbr')
            return [{customId: idA, error: 'bad yaml A', status: 'validation_error'}]
          },
          // Attempt 2: agent receives [A] but emits results for BOTH A and B (using B's
          // original customId from the initial batch, which is still in idToFilePath/idToRequest).
          //   - A: count 1→2, queued for retry.
          //   - B: count 0→1, queued for retry.
          // currentRequests for attempt 3 contains both A and B.
          () => [
            {customId: idA, error: 'bad yaml A', status: 'validation_error'},
            {customId: idB, error: 'bad yaml B', status: 'validation_error'},
          ],
          // Attempt 3 (final): both fail again.
          //   - A: count 2→3 → retries exhausted → logged. (Both old and new code agree.)
          //   - B: count 1→2 → with OLD code, 2 < 3 so queued for retry, but loop exits → DISAPPEARS.
          //                  → with NEW code, attempt(3) < 3 is false → logged. ✓
          (requests) =>
            requests.map((r) => ({customId: r.customId, error: `bad yaml ${r.filePath}`, status: 'validation_error'})),
        ]

        installScriptedAgent(generator, script)

        const results = await generator.generate([fileA, fileB])

        // The whole point: BOTH files must be represented in results — not just A.
        expect(results).toHaveLength(2)
        const resultByPath = Object.fromEntries(results.map((r) => [r.filePath, r]))

        expect(resultByPath[fileA].status).toBe('error')
        expect(resultByPath[fileA].error).toContain('Validation failed')

        // This is the assertion that fails on the buggy code — fileB would be missing.
        expect(resultByPath[fileB]).toBeDefined()
        expect(resultByPath[fileB].status).toBe('error')
        expect(resultByPath[fileB].error).toContain('Validation failed')

        // And both files must be logged to failure.csv.
        const csv = await fsp.readFile(failureLog, 'utf8')
        expect(csv).toContain(fileA)
        expect(csv).toContain(fileB)
      } finally {
        await cleanup()
      }
    })
  })

  describe('output path convention', () => {
    it('appends .eivu.yml to original file path', () => {
      const filePath = '/Users/jinx/queue/Space_Adventures_033.eivu_compressed.cbr'
      const expectedOutput = `${filePath}${METADATA_YML_SUFFIX}`
      expect(expectedOutput).toBe('/Users/jinx/queue/Space_Adventures_033.eivu_compressed.cbr.eivu.yml')
    })

    it('works for audio files', () => {
      const filePath = '/Users/jinx/queue/track.mp3'
      const expectedOutput = `${filePath}${METADATA_YML_SUFFIX}`
      expect(expectedOutput).toBe('/Users/jinx/queue/track.mp3.eivu.yml')
    })

    it('works for video files', () => {
      const filePath = '/Users/jinx/queue/video.mp4'
      const expectedOutput = `${filePath}${METADATA_YML_SUFFIX}`
      expect(expectedOutput).toBe('/Users/jinx/queue/video.mp4.eivu.yml')
    })
  })
  })

  describe('ClaudeAgent', () => {
  it('accepts skillContent directly', () => {
    const agent = new ClaudeAgent({
      apiKey: 'test-key',
      skillContent: MINIMAL_SKILL_CONTENT,
    })
    expect(agent.model).toBe('claude-opus-4-6')
    expect(agent.maxTokens).toBe(16_384)
    expect(agent.pollIntervalMs).toBe(30_000)
  })

  it('accepts custom model and options', () => {
    const agent = new ClaudeAgent({
      apiKey: 'test-key',
      maxTokens: 4096,
      model: 'claude-haiku-3-20240307',
      pollIntervalMs: 5000,
      skillContent: MINIMAL_SKILL_CONTENT,
    })
    expect(agent.model).toBe('claude-haiku-3-20240307')
    expect(agent.maxTokens).toBe(4096)
    expect(agent.pollIntervalMs).toBe(5000)
  })

  it('throws when skill file is not found', () => {
    expect(
      () =>
        new ClaudeAgent({
          apiKey: 'test-key',
          skillPath: '/nonexistent/path/EIVU_METADATA_SKILL.md',
        }),
    ).toThrow('EIVU metadata skill file not found')
  })
  })

  describe('OpenAIAgent', () => {
  it('constructs with default model', () => {
    const agent = new OpenAIAgent({apiKey: 'test-key'})
    expect(agent.model).toBe('gpt-4o')
  })

  it('throws not implemented on processRequests', async () => {
    const agent = new OpenAIAgent({apiKey: 'test-key'})
    await expect(agent.processRequests([])).rejects.toThrow('not yet implemented')
  })
  })

  describe('GeminiAgent', () => {
  it('constructs with default model', () => {
    const agent = new GeminiAgent({apiKey: 'test-key'})
    expect(agent.model).toBe('gemini-2.0-flash')
  })

  it('throws not implemented on processRequests', async () => {
    const agent = new GeminiAgent({apiKey: 'test-key'})
    await expect(agent.processRequests([])).rejects.toThrow('not yet implemented')
  })
  })
})
