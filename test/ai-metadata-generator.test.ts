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

    it('works for audio files', () => {
      const msg = buildUserMessage('/path/to/song.mp3')
      expect(msg).toContain('song.mp3')
    })

    it('works for video files', () => {
      const msg = buildUserMessage('/path/to/clip.mp4')
      expect(msg).toContain('clip.mp4')
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
    expect(agent.model).toBe('claude-sonnet-4-20250514')
    expect(agent.maxTokens).toBe(8192)
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
