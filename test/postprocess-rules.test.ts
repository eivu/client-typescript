import {describe, expect, it} from '@jest/globals'

import {
  enforceAiEngineAfterSkillVersion,
  enforceGenreTitleCase,
  enforceMasterworkTag,
  enforceSkillVersion,
  injectAiCostFields,
} from '../src/ai/postprocess-rules'

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

    it('uses correct indent when a blank line separates block scalar body from next field', () => {
      // Regression: /^(\s*)/ matches '' (empty string) with group 1 = '', so the ??
      // fallback never fires, and indent becomes '' — inserting at column 0.
      const yaml = [
        '  - ai:rating_reasoning: |',
        '      Line one of reasoning.',
        '      Line two of reasoning.',
        '',
        '  - ai:engine: claude-opus-4-6',
      ].join('\n')

      const result = enforceSkillVersion(yaml)
      const lines = result.split('\n')
      const svIdx = findLineIndex(lines, 'ai:skill_version')
      const engineIdx = findLineIndex(lines, 'ai:engine')

      expect(svIdx).toBeGreaterThan(-1)
      // Must be placed after the block scalar body and before ai:engine
      // (a blank line may remain between the insertion and ai:engine, so we
      // only assert ordering, not exact adjacency)
      expect(svIdx).toBeLessThan(engineIdx)
      // Must carry the correct two-space sibling indent, NOT indent ''
      expect(lines[svIdx]).toBe(`  - ai:skill_version: ${CURRENT_VERSION}`)
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

    // ── Bug regression: engineIndex === 0 ─────────────────────────────────────
    // Previously, the fallback computed rawInsertAfter = engineIndex - 1 = -1,
    // which failed the >= 0 guard and silently never inserted ai:skill_version.

    it('inserts before ai:engine when ai:engine is at line 0 and ai:rating_reasoning is absent', () => {
      // ai:engine is the FIRST line — engineIndex === 0, so engineIndex - 1 was -1
      const yaml = [
        '  - ai:engine: claude-opus-4-6',
        '  - ai:rating: 3.5',
      ].join('\n')

      const result = enforceSkillVersion(yaml)
      const lines = result.split('\n')
      const svIdx = findLineIndex(lines, 'ai:skill_version')
      const engineIdx = findLineIndex(lines, 'ai:engine')

      expect(svIdx).toBeGreaterThan(-1)
      expect(svIdx).toBe(engineIdx - 1)
      expect(lines[svIdx]).toBe(`  - ai:skill_version: ${CURRENT_VERSION}`)
    })

    it('falls back to after ai:rating when both ai:rating_reasoning and ai:engine are absent', () => {
      const yaml = [
        '  - ai:rating: 3.5',
        '  - tag: Some Tag',
      ].join('\n')

      const result = enforceSkillVersion(yaml)
      const lines = result.split('\n')
      const svIdx = findLineIndex(lines, 'ai:skill_version')
      const ratingIdx = findLineIndex(lines, 'ai:rating')

      expect(svIdx).toBeGreaterThan(-1)
      expect(svIdx).toBe(ratingIdx + 1)
      expect(lines[svIdx]).toBe(`  - ai:skill_version: ${CURRENT_VERSION}`)
    })

    it('appends to end of file when no anchor fields exist at all', () => {
      const yaml = '  - tag: Some Tag'

      const result = enforceSkillVersion(yaml)
      const lines = result.split('\n')
      const svIdx = findLineIndex(lines, 'ai:skill_version')

      expect(svIdx).toBeGreaterThan(-1)
      expect(svIdx).toBe(lines.length - 1)
      expect(lines[svIdx]).toContain(`ai:skill_version: ${CURRENT_VERSION}`)
    })
  })

  describe('enforceMasterworkTag', () => {
    const TAG = "Eivu's AI Masterwork Collection"

    it('adds Masterwork tag after ai:engine when rating >= 4.0 (happy path)', () => {
      const yaml = [
        '  - ai:rating: 4.5',
        '  - ai:engine: claude-opus-4-6',
      ].join('\n')

      const result = enforceMasterworkTag(yaml)
      const lines = result.split('\n')
      const engineIdx = findLineIndex(lines, 'ai:engine')
      expect(lines[engineIdx + 1]).toBe(`  - tag: ${TAG}`)
    })

    it('does NOT add tag when rating < 4.0', () => {
      const yaml = [
        '  - ai:rating: 3.9',
        '  - ai:engine: claude-opus-4-6',
      ].join('\n')

      expect(enforceMasterworkTag(yaml)).not.toContain(TAG)
    })

    it('removes Masterwork tag when rating < 4.0 and tag is erroneously present', () => {
      const yaml = [
        '  - ai:rating: 3.0',
        `  - tag: ${TAG}`,
      ].join('\n')

      expect(enforceMasterworkTag(yaml)).not.toContain(TAG)
    })

    it('is a no-op when rating >= 4.0 and tag already present', () => {
      const yaml = [
        '  - ai:rating: 4.5',
        `  - tag: ${TAG}`,
        '  - ai:engine: claude-opus-4-6',
      ].join('\n')

      expect(enforceMasterworkTag(yaml)).toBe(yaml)
    })

    it('does NOT add a duplicate when rating >= 4.0 and tag exists with non-canonical casing', () => {
      const wrongCased = TAG.toLowerCase()
      const yaml = [
        '  - ai:rating: 4.5',
        `  - tag: ${wrongCased}`,
        '  - ai:engine: claude-opus-4-6',
      ].join('\n')

      const result = enforceMasterworkTag(yaml)
      const tagCount = result.split('\n').filter((l) => l.toLowerCase().includes('masterwork')).length
      expect(tagCount).toBe(1)
    })

    it('removes Masterwork tag when rating < 4.0 and tag has non-canonical casing', () => {
      const wrongCased = TAG.toLowerCase()
      const yaml = [
        '  - ai:rating: 3.0',
        `  - tag: ${wrongCased}`,
      ].join('\n')

      const result = enforceMasterworkTag(yaml)
      expect(result.toLowerCase()).not.toContain('masterwork')
    })

    it('returns unchanged YAML when no ai:rating is present', () => {
      const yaml = '  - ai:engine: claude-opus-4-6'
      expect(enforceMasterworkTag(yaml)).toBe(yaml)
    })

    // ── Bug regression: ai:engine absent ──────────────────────────────────────

    it('adds tag after ai:rating_reasoning when ai:engine is absent (inline scalar)', () => {
      const yaml = [
        '  - ai:rating: 4.2',
        '  - ai:rating_reasoning: Excellent work.',
      ].join('\n')

      const result = enforceMasterworkTag(yaml)
      expect(result).toContain(TAG)
      const lines = result.split('\n')
      const rrIdx = findLineIndex(lines, 'ai:rating_reasoning')
      expect(lines[rrIdx + 1]).toBe(`  - tag: ${TAG}`)
    })

    it('adds tag AFTER block scalar body of ai:rating_reasoning when ai:engine is absent', () => {
      const yaml = [
        '  - ai:rating: 4.2',
        '  - ai:rating_reasoning: |',
        '      Line one.',
        '      Line two.',
      ].join('\n')

      const result = enforceMasterworkTag(yaml)
      expect(result).toContain(TAG)
      const lines = result.split('\n')
      const tagIdx = findLineIndex(lines, `tag: ${TAG}`)
      // Should be the very last line (after the block scalar body)
      expect(tagIdx).toBe(lines.length - 1)
      // Indentation must match the field (2 spaces), NOT the block body (6 spaces)
      expect(lines[tagIdx]).toBe(`  - tag: ${TAG}`)
    })

    it('adds tag after ai:rating when both ai:engine and ai:rating_reasoning are absent', () => {
      const yaml = '  - ai:rating: 4.0'

      const result = enforceMasterworkTag(yaml)
      expect(result).toContain(TAG)
      const lines = result.split('\n')
      const ratingIdx = findLineIndex(lines, 'ai:rating')
      expect(lines[ratingIdx + 1]).toBe(`  - tag: ${TAG}`)
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

    it('title-cases a pre-quoted value containing a colon (bug: opening " was treated as first char)', () => {
      // sanitizeYamlValues wraps values containing `: ` in double-quotes.
      // Previously, smartTitleCase received `"rock: a history"`, saw `"` as
      // charAt(0), and produced `"rock: a History"` (first real letter not capitalized).
      // "a" stays lowercase because it is an article handled by LOWERCASE_WORDS.
      expect(enforceGenreTitleCase('  - genre: "rock: a history"')).toBe('  - genre: "Rock: a History"')
    })

    it('preserves outer quotes and normalises casing on a pre-quoted value', () => {
      // "A" mid-phrase is an article → lowercased to "a" by smartTitleCase.
      expect(enforceGenreTitleCase('  - genre: "Rock: A History"')).toBe('  - genre: "Rock: a History"')
    })

    it('title-cases a pre-quoted id3:genre value', () => {
      expect(enforceGenreTitleCase('  - id3:genre: "blues: the delta sound"')).toBe(
        '  - id3:genre: "Blues: the Delta Sound"',
      )
    })
  })

  describe('injectAiCostFields', () => {
    // eslint-disable-next-line unicorn/numeric-separators-style -- 5-digit fractional values match the test's expected output strings literally; separators distort that match
    const sampleCost = {cost: 0.01911, costAll: 0.01911, tokensIn: 1234, tokensOut: 5678}

  it('inserts the four fields after ai:engine when both engine and skill_version present', () => {
    // Per v7.16.4 schema ordering (rating → reasoning → skill_version → engine → cost),
    // cost fields land AFTER engine. Engine-first priority in injectAiCostFields.
    const yaml = [
      '  - ai:rating: 4.0',
      '  - ai:rating_reasoning: Great book.',
      '  - ai:skill_version: 7.16.4',
      '  - ai:engine: claude-opus-4-6',
    ].join('\n')

    const lines = injectAiCostFields(yaml, sampleCost).split('\n')
    const engineIdx = findLineIndex(lines, 'ai:engine')
    expect(lines[engineIdx + 1]).toBe('  - ai:cost: 0.01911')
    expect(lines[engineIdx + 2]).toBe('  - ai:cost_all: 0.01911')
    expect(lines[engineIdx + 3]).toBe('  - ai:tokens_in: 1234')
    expect(lines[engineIdx + 4]).toBe('  - ai:tokens_out: 5678')
  })

  it('falls back to ai:skill_version when ai:engine is absent', () => {
    const yaml = ['  - ai:rating: 4.0', '  - ai:skill_version: 7.16.4'].join('\n')
    const lines = injectAiCostFields(yaml, sampleCost).split('\n')
    const svIdx = findLineIndex(lines, 'ai:skill_version')
    expect(lines[svIdx + 1]).toBe('  - ai:cost: 0.01911')
  })

  it('falls back to ai:rating_reasoning when ai:engine/ai:skill_version absent', () => {
    const yaml = '  - ai:rating_reasoning: Great book.'
    const lines = injectAiCostFields(yaml, sampleCost).split('\n')
    const rrIdx = findLineIndex(lines, 'ai:rating_reasoning')
    expect(lines[rrIdx + 1]).toBe('  - ai:cost: 0.01911')
  })

  it('inserts AFTER block scalar body when ai:rating_reasoning uses |', () => {
    const yaml = [
      '  - ai:rating_reasoning: |',
      '      Line one of reasoning.',
      '      Line two of reasoning.',
    ].join('\n')

    const lines = injectAiCostFields(yaml, sampleCost).split('\n')
    const costIdx = findLineIndex(lines, 'ai:cost:')
    // Cost must come AFTER the block body, not inside it.
    expect(costIdx).toBe(3)
    expect(lines[costIdx]).toBe('  - ai:cost: 0.01911')
  })

  it('falls back to ai:rating when all preceding ai:* fields are absent', () => {
    const yaml = '  - ai:rating: 4.0'
    const lines = injectAiCostFields(yaml, sampleCost).split('\n')
    const ratingIdx = findLineIndex(lines, 'ai:rating:')
    expect(lines[ratingIdx + 1]).toBe('  - ai:cost: 0.01911')
  })

  it('appends to end when no ai:* anchor exists', () => {
    const yaml = ['name: foo', 'metadata_list:', '  - publisher: foo'].join('\n')
    const lines = injectAiCostFields(yaml, sampleCost).split('\n')
    expect(lines.at(-4)).toBe('  - ai:cost: 0.01911')
    expect(lines.at(-1)).toBe('  - ai:tokens_out: 5678')
  })

  it('matches indent of the anchor line (4-space example)', () => {
    const yaml = '    - ai:skill_version: 7.16.4'
    const result = injectAiCostFields(yaml, sampleCost)
    expect(result).toContain('    - ai:cost: 0.01911')
    expect(result).toContain('    - ai:tokens_in: 1234')
  })

  it('formats cost values to 5 decimal places', () => {
    const yaml = '  - ai:skill_version: 7.16.4'
    const result = injectAiCostFields(yaml, {cost: 0.123_456_789, costAll: 0.987_654_321, tokensIn: 1, tokensOut: 2})
    expect(result).toContain('  - ai:cost: 0.12346')
    expect(result).toContain('  - ai:cost_all: 0.98765')
  })

  it('formats token counts as integers (no decimal)', () => {
    const yaml = '  - ai:skill_version: 7.16.4'
    const result = injectAiCostFields(yaml, {cost: 0.01, costAll: 0.01, tokensIn: 12_345, tokensOut: 67_890})
    expect(result).toContain('  - ai:tokens_in: 12345')
    expect(result).toContain('  - ai:tokens_out: 67890')
  })

  it('emits ai:cost == ai:cost_all when no retries occurred', () => {
    const yaml = '  - ai:skill_version: 7.16.4'
    const result = injectAiCostFields(yaml, {cost: 0.02, costAll: 0.02, tokensIn: 100, tokensOut: 200})
    expect(result).toContain('  - ai:cost: 0.02000')
    expect(result).toContain('  - ai:cost_all: 0.02000')
  })

  it('emits ai:cost < ai:cost_all when retries occurred', () => {
    const yaml = '  - ai:skill_version: 7.16.4'
    const result = injectAiCostFields(yaml, {cost: 0.02, costAll: 0.05, tokensIn: 100, tokensOut: 200})
    expect(result).toContain('  - ai:cost: 0.02000')
    expect(result).toContain('  - ai:cost_all: 0.05000')
  })

  it('renders zero values as 0.00000 (not omitted)', () => {
    const yaml = '  - ai:skill_version: 7.16.4'
    const result = injectAiCostFields(yaml, {cost: 0, costAll: 0, tokensIn: 0, tokensOut: 0})
    expect(result).toContain('  - ai:cost: 0.00000')
    expect(result).toContain('  - ai:cost_all: 0.00000')
    expect(result).toContain('  - ai:tokens_in: 0')
    expect(result).toContain('  - ai:tokens_out: 0')
  })

  it('is idempotent: replaces existing fields instead of duplicating them', () => {
    const yaml = [
      '  - ai:skill_version: 7.16.4',
      '  - ai:cost: 0.99999',
      '  - ai:cost_all: 0.99999',
      '  - ai:tokens_in: 9999',
      '  - ai:tokens_out: 9999',
    ].join('\n')

    const result = injectAiCostFields(yaml, sampleCost)
    expect(result.match(/ai:cost:/g)?.length).toBe(1)
    expect(result.match(/ai:cost_all:/g)?.length).toBe(1)
    expect(result.match(/ai:tokens_in:/g)?.length).toBe(1)
    expect(result.match(/ai:tokens_out:/g)?.length).toBe(1)
    expect(result).toContain('  - ai:cost: 0.01911')
    expect(result).not.toContain('0.99999')
  })

  it('preserves full metadata_list structure when injecting into a realistic YAML', () => {
    // Realistic order from the v7.16.4 schema: skill_version → engine → (cost).
    // Engine-first priority puts cost AFTER engine.
    const yaml = [
      'name: Watchmen',
      'year: 1987',
      'metadata_list:',
      '  - publisher: DC Comics',
      '  - ai:rating: 5.0',
      '  - ai:rating_reasoning: Hugo Award winner.',
      '  - ai:skill_version: 7.16.4',
      '  - ai:engine: claude-opus-4-6',
    ].join('\n')

    const lines = injectAiCostFields(yaml, sampleCost).split('\n')
    expect(lines).toContain('name: Watchmen')
    expect(lines).toContain('year: 1987')
    expect(lines).toContain('metadata_list:')
    expect(lines).toContain('  - publisher: DC Comics')
    expect(lines).toContain('  - ai:rating: 5.0')
    const engineIdx = findLineIndex(lines, 'ai:engine')
    expect(lines[engineIdx + 1]).toBe('  - ai:cost: 0.01911')
  })
  })

  describe('enforceAiEngineAfterSkillVersion', () => {
    it('relocates ai:engine to come AFTER ai:skill_version when emitted first', () => {
      const yaml = [
        '  - ai:rating: 4.0',
        '  - ai:engine: claude-opus-4-6',
        '  - ai:skill_version: 7.16.4',
      ].join('\n')

      const result = enforceAiEngineAfterSkillVersion(yaml)
      const lines = result.split('\n')
      const skillIdx = findLineIndex(lines, 'ai:skill_version')
      const engineIdx = findLineIndex(lines, 'ai:engine')

      expect(engineIdx).toBe(skillIdx + 1)
      expect(lines[skillIdx]).toBe('  - ai:skill_version: 7.16.4')
      expect(lines[engineIdx]).toBe('  - ai:engine: claude-opus-4-6')
    })

    it('is a no-op when ai:engine already comes after ai:skill_version', () => {
      const yaml = ['  - ai:skill_version: 7.16.4', '  - ai:engine: claude-opus-4-6'].join('\n')
      expect(enforceAiEngineAfterSkillVersion(yaml)).toBe(yaml)
    })

    it('is a no-op when ai:engine is missing', () => {
      const yaml = '  - ai:skill_version: 7.16.4'
      expect(enforceAiEngineAfterSkillVersion(yaml)).toBe(yaml)
    })

    it('is a no-op when ai:skill_version is missing', () => {
      const yaml = '  - ai:engine: claude-opus-4-6'
      expect(enforceAiEngineAfterSkillVersion(yaml)).toBe(yaml)
    })

    it('preserves surrounding ai:* fields when relocating ai:engine', () => {
      const yaml = [
        '  - ai:rating: 4.0',
        '  - ai:rating_reasoning: "..."',
        '  - ai:engine: claude-opus-4-6',
        '  - ai:skill_version: 7.16.4',
      ].join('\n')

      const lines = enforceAiEngineAfterSkillVersion(yaml).split('\n')
      // Expected order: rating → reasoning → skill_version → engine
      expect(lines[0]).toBe('  - ai:rating: 4.0')
      expect(lines[1]).toBe('  - ai:rating_reasoning: "..."')
      expect(lines[2]).toBe('  - ai:skill_version: 7.16.4')
      expect(lines[3]).toBe('  - ai:engine: claude-opus-4-6')
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
