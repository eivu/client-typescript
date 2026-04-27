import {describe, expect, it} from '@jest/globals'

import {enforceGenreTitleCase, enforceSkillVersion} from '../src/ai/postprocess-rules'

const CURRENT_VERSION = '7.16.4'

describe('postprocess-rules', () => {
  describe('enforceSkillVersion', () => {
    it('overwrites an outdated existing ai:skill_version line', () => {
      const yaml = '  - ai:skill_version: 7.0.0'
      expect(enforceSkillVersion(yaml)).toBe(`  - ai:skill_version: ${CURRENT_VERSION}`)
    })

    it('is a no-op when ai:skill_version already current', () => {
      const yaml = `  - ai:skill_version: ${CURRENT_VERSION}`
      expect(enforceSkillVersion(yaml)).toBe(yaml)
    })

    it('inserts after ai:rating_reasoning when value is inline scalar', () => {
      const yaml = [
        '  - ai:rating_reasoning: Great book.',
        '  - ai:engine: claude-opus-4-6',
      ].join('\n')

      const result = enforceSkillVersion(yaml)
      const lines = result.split('\n')
      const svIdx = findLineIndex(lines, 'ai:skill_version')
      const rrIdx = findLineIndex(lines, 'ai:rating_reasoning')

      expect(svIdx).toBe(rrIdx + 1)
      expect(lines[svIdx]).toBe(`  - ai:skill_version: ${CURRENT_VERSION}`)
    })

    it('inserts AFTER the block scalar body, not inside it (| literal)', () => {
      const yaml = [
        '  - ai:rating_reasoning: |',
        '      Line one of reasoning.',
        '      Line two of reasoning.',
        '  - ai:engine: claude-opus-4-6',
      ].join('\n')

      const result = enforceSkillVersion(yaml)
      const lines = result.split('\n')

      const svIdx = findLineIndex(lines, 'ai:skill_version')
      const engineIdx = findLineIndex(lines, 'ai:engine')

      expect(svIdx).toBe(engineIdx - 1)
      expect(lines[svIdx]).toBe(`  - ai:skill_version: ${CURRENT_VERSION}`)
    })

    it('inserts AFTER the block scalar body (> folded)', () => {
      const yaml = [
        '  - ai:rating_reasoning: >',
        '      Folded line one.',
        '      Folded line two.',
        '  - ai:engine: claude-opus-4-6',
      ].join('\n')

      const result = enforceSkillVersion(yaml)
      const lines = result.split('\n')

      const svIdx = findLineIndex(lines, 'ai:skill_version')
      const engineIdx = findLineIndex(lines, 'ai:engine')

      expect(svIdx).toBe(engineIdx - 1)
      expect(lines[svIdx]).toBe(`  - ai:skill_version: ${CURRENT_VERSION}`)
    })

    it('does not corrupt block scalar body lines', () => {
      const yaml = [
        '  - ai:rating_reasoning: |',
        '      Line one of reasoning.',
        '      Line two of reasoning.',
        '  - ai:engine: claude-opus-4-6',
      ].join('\n')

      const result = enforceSkillVersion(yaml)

      expect(result).toContain('      Line one of reasoning.')
      expect(result).toContain('      Line two of reasoning.')
    })

    it('handles block scalar with strip modifier (|-)', () => {
      const yaml = [
        '  - ai:rating_reasoning: |-',
        '      Content here.',
        '  - ai:engine: claude-opus-4-6',
      ].join('\n')

      const result = enforceSkillVersion(yaml)
      const lines = result.split('\n')
      const svIdx = findLineIndex(lines, 'ai:skill_version')
      const engineIdx = findLineIndex(lines, 'ai:engine')

      expect(svIdx).toBe(engineIdx - 1)
    })

    it('inserts before ai:engine when no rating_reasoning exists (fallback)', () => {
      const yaml = [
        '  - ai:rating: 3.5',
        '  - ai:engine: claude-opus-4-6',
      ].join('\n')

      const result = enforceSkillVersion(yaml)
      const lines = result.split('\n')
      const svIdx = findLineIndex(lines, 'ai:skill_version')
      const engineIdx = findLineIndex(lines, 'ai:engine')

      expect(svIdx).toBe(engineIdx - 1)
      expect(lines[svIdx]).toBe(`  - ai:skill_version: ${CURRENT_VERSION}`)
    })
  })

  describe('enforceGenreTitleCase', () => {
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

    it('preserves R&B abbreviation', () => {
      expect(enforceGenreTitleCase('  - genre: r&b')).toBe('  - genre: R&B')
    })

    it('preserves RPG abbreviation', () => {
      expect(enforceGenreTitleCase('  - genre: rpg')).toBe('  - genre: RPG')
    })

    it('preserves TV abbreviation', () => {
      expect(enforceGenreTitleCase('  - genre: tv drama')).toBe('  - genre: TV Drama')
    })

    it('preserves UK abbreviation', () => {
      expect(enforceGenreTitleCase('  - genre: uk garage')).toBe('  - genre: UK Garage')
    })

    it('preserves US abbreviation', () => {
      expect(enforceGenreTitleCase('  - genre: us history')).toBe('  - genre: US History')
    })

    it('lowercases "of" mid-phrase', () => {
      expect(enforceGenreTitleCase('  - genre: science of the mind')).toBe(
        '  - genre: Science of the Mind',
      )
    })

    it('always capitalizes the first word', () => {
      expect(enforceGenreTitleCase('  - genre: the blues')).toBe('  - genre: The Blues')
    })

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

/**
 * Helper to locate the index of the first line containing a substring.
 * Pulled out of `it` blocks to avoid 5-level callback nesting which trips
 * the `max-nested-callbacks` lint rule.
 */
function findLineIndex(lines: string[], needle: string): number {
  return lines.findIndex((l) => l.includes(needle))
}
