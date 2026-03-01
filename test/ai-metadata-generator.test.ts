import {describe, expect, it, jest, beforeEach, afterEach} from '@jest/globals'
import {
  AiMetadataGenerator,
  buildUserMessage,
  cleanFilenameForSearch,
  detectMediaType,
  extractYamlFromResponse,
} from '@src/ai-metadata-generator'
import {METADATA_YML_SUFFIX} from '@src/constants'
import {promises as fsp} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const MINIMAL_SKILL_CONTENT = '# EIVU Metadata Runtime v7.16.1\nMinimal test content'

describe('AiMetadataGenerator helpers', () => {
  describe('detectMediaType', () => {
    it.each([
      ['/path/to/Space_Adventures_033.cbr', 'comic'],
      ['/path/to/Batman_001.cbz', 'comic'],
      ['/path/to/handbook.pdf', 'comic'],
      ['file.CBR', 'comic'],
      ['file.CBZ', 'comic'],
    ])('detects comic files: %s → %s', (input, expected) => {
      expect(detectMediaType(input)).toBe(expected)
    })

    it.each([
      ['/path/to/track.mp3', 'audio'],
      ['/path/to/song.m4a', 'audio'],
      ['/path/to/album.flac', 'audio'],
      ['file.MP3', 'audio'],
    ])('detects audio files: %s → %s', (input, expected) => {
      expect(detectMediaType(input)).toBe(expected)
    })

    it.each([
      ['/path/to/video.mp4', 'video'],
      ['/path/to/movie.mkv', 'video'],
      ['/path/to/clip.avi', 'video'],
      ['file.MKV', 'video'],
    ])('detects video files: %s → %s', (input, expected) => {
      expect(detectMediaType(input)).toBe(expected)
    })

    it.each([
      ['/path/to/readme.txt', 'unknown'],
      ['/path/to/image.png', 'unknown'],
      ['/path/to/data.json', 'unknown'],
      ['noextension', 'unknown'],
    ])('returns unknown for unrecognized: %s → %s', (input, expected) => {
      expect(detectMediaType(input)).toBe(expected)
    })
  })

  describe('cleanFilenameForSearch', () => {
    it('removes .eivu_compressed and extension, replaces underscores', () => {
      expect(cleanFilenameForSearch('Space_Adventures_033.eivu_compressed.cbr')).toBe('Space Adventures 033')
    })

    it('handles filenames without .eivu_compressed', () => {
      expect(cleanFilenameForSearch('Batman_001.cbz')).toBe('Batman 001')
    })

    it('replaces underscores with spaces', () => {
      expect(cleanFilenameForSearch('Hello_World_Track.mp3')).toBe('Hello World Track')
    })

    it('removes file extension', () => {
      expect(cleanFilenameForSearch('simple.flac')).toBe('simple')
    })

    it('handles multiple .eivu_compressed occurrences', () => {
      expect(cleanFilenameForSearch('file.eivu_compressed.eivu_compressed.cbr')).toBe('file')
    })

    it('handles hyphens (does not replace them)', () => {
      expect(cleanFilenameForSearch('Iron-Man_001.cbr')).toBe('Iron-Man 001')
    })
  })

  describe('buildUserMessage', () => {
    it('includes filename and extension for comic files', () => {
      const msg = buildUserMessage('/Users/jinx/queue/Space_Adventures_033.eivu_compressed.cbr')
      expect(msg).toContain('**Filename:** Space_Adventures_033.eivu_compressed.cbr')
      expect(msg).toContain('**File extension:** .cbr')
      expect(msg).toContain('**Media type:** comic')
      expect(msg).toContain('**Search query:** Space Adventures 033')
    })

    it('includes comic-specific instructions for .cbr files', () => {
      const msg = buildUserMessage('/path/to/Batman_001.cbr')
      expect(msg).toContain('character disambiguation')
      expect(msg).toContain('season mapping')
      expect(msg).toContain('award tags')
    })

    it('includes audio-specific instructions for .mp3 files', () => {
      const msg = buildUserMessage('/path/to/track.mp3')
      expect(msg).toContain('**Media type:** audio')
      expect(msg).toContain('id3: prefix convention')
      expect(msg).toContain('artists/release top-level structure')
    })

    it('includes video-specific instructions for .mp4 files', () => {
      const msg = buildUserMessage('/path/to/video.mp4')
      expect(msg).toContain('**Media type:** video')
      expect(msg).toContain('artists top-level structure')
    })

    it('uses generic instructions for unknown file types', () => {
      const msg = buildUserMessage('/path/to/file.txt')
      expect(msg).toContain('**Media type:** unknown')
      expect(msg).toContain('all applicable rules')
    })

    it('instructs to output YAML only with no code fences', () => {
      const msg = buildUserMessage('/path/to/file.cbr')
      expect(msg).toContain('Output ONLY valid YAML content')
      expect(msg).toContain('Do not wrap in markdown code blocks')
    })
  })

  describe('extractYamlFromResponse', () => {
    it('extracts plain YAML text', () => {
      const content = [{type: 'text', text: 'name: Test\nyear: 2023'}]
      expect(extractYamlFromResponse(content)).toBe('name: Test\nyear: 2023')
    })

    it('strips markdown yaml code fences', () => {
      const content = [{type: 'text', text: '```yaml\nname: Test\nyear: 2023\n```'}]
      expect(extractYamlFromResponse(content)).toBe('name: Test\nyear: 2023')
    })

    it('strips markdown yml code fences', () => {
      const content = [{type: 'text', text: '```yml\nname: Test\n```'}]
      expect(extractYamlFromResponse(content)).toBe('name: Test')
    })

    it('strips bare code fences', () => {
      const content = [{type: 'text', text: '```\nname: Test\n```'}]
      expect(extractYamlFromResponse(content)).toBe('name: Test')
    })

    it('handles multiple content blocks', () => {
      const content = [
        {type: 'text', text: 'name: Test\n'},
        {type: 'text', text: 'year: 2023'},
      ]
      expect(extractYamlFromResponse(content)).toBe('name: Test\n\nyear: 2023')
    })

    it('ignores non-text blocks', () => {
      const content = [
        {type: 'tool_use', id: 'abc'},
        {type: 'text', text: 'name: Test'},
      ]
      expect(extractYamlFromResponse(content)).toBe('name: Test')
    })

    it('trims whitespace', () => {
      const content = [{type: 'text', text: '  \nname: Test\nyear: 2023\n  '}]
      expect(extractYamlFromResponse(content)).toBe('name: Test\nyear: 2023')
    })

    it('returns empty string for empty content', () => {
      expect(extractYamlFromResponse([])).toBe('')
    })
  })
})

describe('AiMetadataGenerator', () => {
  describe('constructor', () => {
    it('accepts skillContent directly', () => {
      const generator = new AiMetadataGenerator({
        apiKey: 'test-key',
        skillContent: MINIMAL_SKILL_CONTENT,
      })
      expect(generator.model).toBe('claude-sonnet-4-20250514')
      expect(generator.maxTokens).toBe(8192)
      expect(generator.overwrite).toBe(false)
      expect(generator.pollIntervalMs).toBe(30_000)
    })

    it('accepts custom options', () => {
      const generator = new AiMetadataGenerator({
        apiKey: 'test-key',
        maxTokens: 4096,
        model: 'claude-haiku-3-20240307',
        overwrite: true,
        pollIntervalMs: 5000,
        skillContent: MINIMAL_SKILL_CONTENT,
      })
      expect(generator.model).toBe('claude-haiku-3-20240307')
      expect(generator.maxTokens).toBe(4096)
      expect(generator.overwrite).toBe(true)
      expect(generator.pollIntervalMs).toBe(5000)
    })

    it('throws when skill file is not found', () => {
      expect(
        () =>
          new AiMetadataGenerator({
            apiKey: 'test-key',
            skillPath: '/nonexistent/path/EIVU_METADATA_SKILL.md',
          }),
      ).toThrow('EIVU metadata skill file not found')
    })
  })

  describe('generate', () => {
    it('returns empty array for empty input', async () => {
      const generator = new AiMetadataGenerator({
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

        const generator = new AiMetadataGenerator({
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
        await fsp.rm(tmpDir, {recursive: true, force: true})
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
