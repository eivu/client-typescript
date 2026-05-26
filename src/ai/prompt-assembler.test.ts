import {describe, expect, it} from '@jest/globals'
import {_resetFragmentCacheForTests, assemble} from '@src/ai/prompt-assembler'
import path from 'node:path'

const FRAGMENTS_ROOT = path.join(process.cwd(), 'src', 'ai', 'prompts', 'claude', 'fragments')

describe('PromptAssembler', () => {
  describe('cache determinism', () => {
    it('produces byte-identical output across calls for the same media type', () => {
      _resetFragmentCacheForTests()
      const first = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType: 'comics'})
      const second = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType: 'comics'})
      expect(second).toBe(first)
    })

    it('produces byte-identical output for audio across calls', () => {
      _resetFragmentCacheForTests()
      const first = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType: 'audio'})
      const second = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType: 'audio'})
      expect(second).toBe(first)
    })

    it('produces byte-identical output for video across calls', () => {
      _resetFragmentCacheForTests()
      const first = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType: 'video'})
      const second = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType: 'video'})
      expect(second).toBe(first)
    })
  })

  describe('per-media-type content', () => {
    it('comics output includes characters and franchises fragments', () => {
      _resetFragmentCacheForTests()
      const out = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType: 'comics'})
      expect(out).toContain('## §B — CHARACTER ENTRIES')
      expect(out).toContain('## §C — UNIVERSE FIELD VALUES')
      expect(out).toContain('## §D — AWARD TAGS')
      expect(out).toContain('## §F — FRANCHISE vs PUBLISHER')
      expect(out).toContain('### Season Mapping Tables')
    })

    it('audio output excludes comics-only sections', () => {
      _resetFragmentCacheForTests()
      const out = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType: 'audio'})
      expect(out).not.toContain('## §B — CHARACTER ENTRIES')
      expect(out).not.toContain('## §C — UNIVERSE FIELD VALUES')
      expect(out).not.toContain('## §F — FRANCHISE vs PUBLISHER')
      expect(out).not.toContain('### Season Mapping Tables')
      expect(out).toContain('### Audio Files (.m4a, .mp3, .flac, etc.)')
      expect(out).toContain('### Audio Tracks')
    })

    it('video output excludes comics-only sections and audio identification', () => {
      _resetFragmentCacheForTests()
      const out = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType: 'video'})
      expect(out).not.toContain('## §B — CHARACTER ENTRIES')
      expect(out).not.toContain('## §F — FRANCHISE vs PUBLISHER')
      expect(out).not.toContain('### Audio Tracks')
      expect(out).toContain('### Video Files (.mp4, .mkv, .avi, etc.)')
      expect(out).toContain('### Video (non-TV, non-movie)')
      // TV/Movies are duplicated in comics + video per the cache-independence decision.
      expect(out).toContain('### TV Episodes')
      expect(out).toContain('### Movies')
    })

    it('comics and audio outputs differ', () => {
      _resetFragmentCacheForTests()
      const comics = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType: 'comics'})
      const audio = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType: 'audio'})
      expect(comics).not.toBe(audio)
    })

    it('audio and video outputs differ', () => {
      _resetFragmentCacheForTests()
      const audio = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType: 'audio'})
      const video = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType: 'video'})
      expect(audio).not.toBe(video)
    })
  })

  describe('cross-cutting invariants', () => {
    // Every assembled prompt must carry the core preamble (header, routing, yaml-syntax,
    // engine-self-report) and the universal rule sets (violations-universal, rubric,
    // checklist-universal).
    it.each(['audio', 'comics', 'video'] as const)(
      '%s output contains the universal core fragments',
      (mediaType) => {
        _resetFragmentCacheForTests()
        const out = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType})
        expect(out).toContain('# EIVU Metadata Runtime v7.16.4')
        expect(out).toContain('## ROUTING NOTE')
        expect(out).toContain('### Shared Rules (All Media Types)')
        expect(out).toContain('`ai:engine` self-reporting')
        expect(out).toContain('## §E — ai:rating SCALE')
        expect(out).toContain('### YAML (All Media Types)')
        expect(out).toContain('### Awards & Ratings (All Media Types)')
      },
    )

    // Per the Phase 1 verification gate: each assembled prompt must be substantive
    // enough to be worth caching (>= 1024 chars). Anthropic's prompt cache has a
    // ~1024-token floor; chars are a rough proxy that any actual fragment-rich
    // prompt clears comfortably.
    it.each(['audio', 'comics', 'video'] as const)('%s output exceeds 1024 chars', (mediaType) => {
      _resetFragmentCacheForTests()
      const out = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType})
      expect(out.length).toBeGreaterThan(1024)
    })

    // Assembly order: violations (per-media table) must come before the rubric.
    it.each(['audio', 'comics', 'video'] as const)(
      '%s output places violations before §E rubric',
      (mediaType) => {
        _resetFragmentCacheForTests()
        const out = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType})
        const violationsIdx = out.indexOf('## VIOLATIONS')
        const rubricIdx = out.indexOf('## §E — ai:rating SCALE')
        expect(violationsIdx).toBeGreaterThan(-1)
        expect(rubricIdx).toBeGreaterThan(violationsIdx)
      },
    )
  })

  describe('error handling', () => {
    it('throws a clear error when a fragment is missing', () => {
      _resetFragmentCacheForTests()
      const bogusRoot = path.join(process.cwd(), 'src', 'ai', 'prompts', 'claude', 'fragments-does-not-exist')
      expect(() => assemble({fragmentsRoot: bogusRoot, mediaType: 'comics'})).toThrow(/not found/)
    })
  })

  describe('snapshot per media type', () => {
    it.each(['audio', 'comics', 'video'] as const)('%s assembled output matches snapshot', (mediaType) => {
      _resetFragmentCacheForTests()
      const out = assemble({fragmentsRoot: FRAGMENTS_ROOT, mediaType})
      expect(out).toMatchSnapshot()
    })
  })
})
