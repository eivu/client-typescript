import type {Pipeline} from '@src/ai/pipeline'

import {describe, expect, it} from '@jest/globals'
import {resolvePipeline} from '@src/ai/pipeline-resolver'
import {buildAllPipelines} from '@src/ai/pipelines/index'

// Build pipelines once at module load — `buildAllPipelines` reads fragments
// off disk and these tests don't care about override behavior.
const PIPELINES = buildAllPipelines()

describe('resolvePipeline', () => {
  it('routes .cbz / .cbr to the comics pipeline', () => {
    expect(resolvePipeline('/tmp/foo.cbz', PIPELINES)?.name).toBe('comics')
    expect(resolvePipeline('/tmp/foo.cbr', PIPELINES)?.name).toBe('comics')
  })

  it('routes .mp3 / .m4a / .flac to the audio pipeline', () => {
    expect(resolvePipeline('/tmp/foo.mp3', PIPELINES)?.name).toBe('audio')
    expect(resolvePipeline('/tmp/foo.m4a', PIPELINES)?.name).toBe('audio')
    expect(resolvePipeline('/tmp/foo.flac', PIPELINES)?.name).toBe('audio')
  })

  it('routes .mp4 / .mkv to the video pipeline', () => {
    expect(resolvePipeline('/tmp/foo.mp4', PIPELINES)?.name).toBe('video')
    expect(resolvePipeline('/tmp/foo.mkv', PIPELINES)?.name).toBe('video')
  })

  it('routes unknown extensions to the other pipeline (if available)', () => {
    // The 'other' pipeline depends on the v7.16.4 monolith being on disk.
    // In a normal repo checkout it is, so this should resolve.
    expect(resolvePipeline('/tmp/foo.txt', PIPELINES)?.name).toBe('other')
    expect(resolvePipeline('/tmp/foo.xyz', PIPELINES)?.name).toBe('other')
  })

  it('returns undefined when the corresponding pipeline is missing', () => {
    // Build a pipelines record with only comics, then route an audio file.
    const partial: Partial<Record<'audio' | 'comics' | 'other' | 'video', Pipeline>> = {
      comics: PIPELINES.comics,
    }
    expect(resolvePipeline('/tmp/foo.mp3', partial)).toBeUndefined()
    expect(resolvePipeline('/tmp/foo.cbz', partial)?.name).toBe('comics')
  })
})
