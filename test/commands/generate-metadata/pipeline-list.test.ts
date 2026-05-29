import {describe, expect, it} from '@jest/globals'
import {renderPipelineList} from '@src/commands/generate-metadata/pipeline-list'

describe('gm:pipeline-list (renderPipelineList)', () => {
  it('lists all four production pipelines with model + web-search budget', () => {
    const out = renderPipelineList()
    expect(out).toContain('comics')
    expect(out).toContain('audio')
    expect(out).toContain('video')
    expect(out).toContain('other')
    expect(out).toContain('claude-opus-4-6')
    expect(out).toContain('claude-sonnet-4-6')
  })

  it('shows headers and per-pipeline values', () => {
    const out = renderPipelineList()
    expect(out).toContain('webSearch')
    expect(out).toContain('maxTokens')
    expect(out).toContain('promptChars')
    // Each pipeline currently uses webSearch=10 and maxTokens=16384.
    expect(out).toMatch(/10\s+16384/)
  })

  it('places comics first so the visual order matches the priority of production-cost spend', () => {
    const out = renderPipelineList()
    const lines = out.split('\n').slice(1) // skip header line
    expect(lines[0].startsWith('comics')).toBe(true)
  })
})
