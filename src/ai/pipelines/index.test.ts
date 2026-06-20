import {describe, expect, it} from '@jest/globals'
import {
  buildAllPipelines,
  buildAudioPipeline,
  buildComicsPipeline,
  buildOtherPipeline,
  buildVideoPipeline,
} from '@src/ai/pipelines/index'

describe('pipelines', () => {
  describe('buildComicsPipeline', () => {
    it('returns a single-stage Opus pipeline with web search enabled', () => {
      const p = buildComicsPipeline()
      expect(p.name).toBe('comics')
      expect(p.stages).toHaveLength(1)
      expect(p.stages[0].model).toBe('claude-opus-4-6')
      expect(p.stages[0].webSearchMaxUses).toBe(10)
      expect(p.stages[0].maxTokens).toBe(16_384)
    })

    it('embeds the assembled comics system prompt', () => {
      const p = buildComicsPipeline()
      expect(p.stages[0].systemPrompt).toContain('## §B — CHARACTER ENTRIES')
      expect(p.stages[0].systemPrompt).toContain('## §C — UNIVERSE FIELD VALUES')
      expect(p.stages[0].systemPrompt).not.toContain('### Audio Tracks')
    })

    it('respects per-pipeline overrides', () => {
      const p = buildComicsPipeline({maxTokens: 4096, model: 'claude-haiku-4-5-20251001', webSearchMaxUses: 3})
      expect(p.stages[0].model).toBe('claude-haiku-4-5-20251001')
      expect(p.stages[0].maxTokens).toBe(4096)
      expect(p.stages[0].webSearchMaxUses).toBe(3)
    })
  })

  describe('buildAudioPipeline', () => {
    it('builds an audio-only system prompt on Sonnet 4.6', () => {
      const p = buildAudioPipeline()
      expect(p.name).toBe('audio')
      expect(p.stages[0].model).toBe('claude-sonnet-4-6')
      expect(p.stages[0].systemPrompt).toContain('### Audio Tracks')
      expect(p.stages[0].systemPrompt).not.toContain('## §B — CHARACTER ENTRIES')
    })
  })

  describe('buildVideoPipeline', () => {
    it('builds a video-only system prompt on Sonnet 4.6', () => {
      const p = buildVideoPipeline()
      expect(p.name).toBe('video')
      expect(p.stages[0].model).toBe('claude-sonnet-4-6')
      expect(p.stages[0].systemPrompt).toContain('### Video Files (.mp4, .mkv, .avi, etc.)')
      expect(p.stages[0].systemPrompt).not.toContain('## §B — CHARACTER ENTRIES')
    })
  })

  describe('buildOtherPipeline', () => {
    it('returns a pipeline that wraps the v7.16.4 monolith', () => {
      const p = buildOtherPipeline()
      expect(p).toBeDefined()
      expect(p!.name).toBe('other')
      // The monolith carries every media type's rules, so it includes both
      // comics-only and audio-only sections.
      expect(p!.stages[0].systemPrompt).toContain('# EIVU Metadata Runtime v7.16.4')
      expect(p!.stages[0].systemPrompt).toContain('## §B — CHARACTER ENTRIES')
      expect(p!.stages[0].systemPrompt).toContain('### Audio Tracks')
    })
  })

  describe('buildAllPipelines', () => {
    it('builds all four production pipelines', () => {
      const pipelines = buildAllPipelines()
      expect(Object.keys(pipelines).sort()).toEqual(['audio', 'comics', 'other', 'video'])
    })

    it('forwards overrides to every pipeline', () => {
      const pipelines = buildAllPipelines({maxTokens: 1024, model: 'claude-sonnet-4-6'})
      for (const name of ['audio', 'comics', 'video'] as const) {
        const p = pipelines[name]
        expect(p?.stages[0].model).toBe('claude-sonnet-4-6')
        expect(p?.stages[0].maxTokens).toBe(1024)
      }
    })

    it('produces deterministic system prompts across rebuilds', () => {
      // Cache determinism is the whole point of pre-assembling per-media prompts.
      // If buildAllPipelines() produced different strings on each call, the
      // Anthropic prompt cache would miss on every batch.
      const first = buildAllPipelines()
      const second = buildAllPipelines()
      for (const name of ['audio', 'comics', 'video'] as const) {
        expect(second[name]?.stages[0].systemPrompt).toBe(first[name]?.stages[0].systemPrompt)
      }
    })
  })
})
