import {describe, expect, it} from '@jest/globals'

import {enforceGenreTitleCase} from '../src/ai/postprocess-rules'

describe('enforceGenreTitleCase', () => {
  describe('hyphenated genre names', () => {
    it('title-cases hip-hop → Hip-Hop', () => {
      expect(enforceGenreTitleCase('  - genre: hip-hop')).toBe('  - genre: Hip-Hop')
    })

    it('title-cases lo-fi → Lo-Fi', () => {
      expect(enforceGenreTitleCase('  - genre: lo-fi')).toBe('  - genre: Lo-Fi')
    })

    it('title-cases sci-fi → Sci-Fi', () => {
      expect(enforceGenreTitleCase('  - genre: sci-fi')).toBe('  - genre: Sci-Fi')
    })

    it('does not uppercase hip-hop to HIP-HOP (regression)', () => {
      const result = enforceGenreTitleCase('  - genre: hip-hop')
      expect(result).not.toBe('  - genre: HIP-HOP')
    })

    it('does not uppercase lo-fi to LO-FI (regression)', () => {
      const result = enforceGenreTitleCase('  - genre: lo-fi')
      expect(result).not.toBe('  - genre: LO-FI')
    })
  })

  describe('abbreviations stay uppercase', () => {
    it('preserves R&B', () => {
      expect(enforceGenreTitleCase('  - genre: r&b')).toBe('  - genre: R&B')
    })

    it('preserves RPG', () => {
      expect(enforceGenreTitleCase('  - genre: rpg')).toBe('  - genre: RPG')
    })

    it('preserves TV', () => {
      expect(enforceGenreTitleCase('  - genre: tv drama')).toBe('  - genre: TV Drama')
    })

    it('preserves UK', () => {
      expect(enforceGenreTitleCase('  - genre: uk garage')).toBe('  - genre: UK Garage')
    })

    it('preserves US', () => {
      expect(enforceGenreTitleCase('  - genre: us history')).toBe('  - genre: US History')
    })
  })

  describe('lowercase articles and prepositions', () => {
    it('lowercases "of" mid-phrase', () => {
      expect(enforceGenreTitleCase('  - genre: science of the mind')).toBe(
        '  - genre: Science of the Mind',
      )
    })

    it('always capitalizes the first word', () => {
      expect(enforceGenreTitleCase('  - genre: the blues')).toBe('  - genre: The Blues')
    })
  })

  describe('mixed cases', () => {
    it('handles id3:genre variant', () => {
      expect(enforceGenreTitleCase('  - id3:genre: hip-hop')).toBe('  - id3:genre: Hip-Hop')
    })

    it('handles multiple genre lines', () => {
      const yaml = '  - genre: hip-hop\n  - genre: lo-fi\n  - genre: r&b'
      expect(enforceGenreTitleCase(yaml)).toBe('  - genre: Hip-Hop\n  - genre: Lo-Fi\n  - genre: R&B')
    })

    it('normalises already-cased input', () => {
      expect(enforceGenreTitleCase('  - genre: Hip-Hop')).toBe('  - genre: Hip-Hop')
    })
  })
})
