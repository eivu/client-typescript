import {describe, expect, it} from '@jest/globals'
import {renderPipelineShow} from '@src/commands/generate-metadata/pipeline-show'

describe('gm:pipeline-show (renderPipelineShow)', () => {
  it('renders a tree view for the comics pipeline with model + web-search budget', () => {
    const result = renderPipelineShow('comics')
    expect(result).not.toBeNull()
    const {output} = result!
    expect(output).toMatch(/^comics$/m)
    expect(output).toContain('Stage 0')
    expect(output).toContain('claude-opus-4-6')
    expect(output).toContain('webSearchMaxUses: 10')
    expect(output).toContain('maxTokens:        16384')
  })

  it('lists the comics fragments in the assembled order', () => {
    const {output} = renderPipelineShow('comics')!
    // The first and last fragments should be present, in order.
    expect(output).toMatch(/Fragments: core\/header\.md.*core\/checklist-universal\.md \(12 total\)/)
    // Comics-only fragments only appear in the comics pipeline.
    expect(output).toContain('media/comics/characters.md')
    expect(output).toContain('media/comics/franchises.md')
  })

  it('returns the assembled system prompt as a separate field (used by --prompt)', () => {
    const {systemPrompt} = renderPipelineShow('audio')!
    expect(systemPrompt).toContain('### Audio Tracks')
    expect(systemPrompt).not.toContain('## §B — CHARACTER ENTRIES')
  })

  it('shows audio on Sonnet 4.6 in the tree view', () => {
    const {output} = renderPipelineShow('audio')!
    expect(output).toContain('claude-sonnet-4-6')
  })

  it('shows video on Sonnet 4.6 in the tree view', () => {
    const {output} = renderPipelineShow('video')!
    expect(output).toContain('claude-sonnet-4-6')
  })

  it('uses a single-line fragment note for the other pipeline (monolith)', () => {
    const result = renderPipelineShow('other')
    if (!result) return // 'other' pipeline only present when the v7.16.4 monolith exists; skip gracefully if absent
    expect(result.output).toContain('the v7.16.4 monolith')
    expect(result.output).not.toContain('media/audio/identification.md')
  })
})
