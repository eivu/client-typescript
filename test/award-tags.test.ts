import {describe, expect, it} from '@jest/globals'

import {deriveAwardTags, normalizeAwardTags} from '../src/ai/award-tags'

// ---------------------------------------------------------------------------
// deriveAwardTags
// ---------------------------------------------------------------------------

describe('deriveAwardTags', () => {
  describe('winner tag', () => {
    it('derives all implied tags from a correctly-cased winner tag', () => {
      const result = deriveAwardTags(new Set(['Eisner Award Winner 2020']))
      expect(result).toEqual(
        expect.arrayContaining([
          'Eisner Award Nominee 2020',
          'Eisner Award Nominee',
          'Eisner Award Winning Series',
          'Eisner Award Nominated Series',
          'Eisner Award Recognized Series',
          'Award Winning Series',
          'Award Recognized Series',
        ]),
      )
      expect(result).toHaveLength(7)
    })

    it('title-cases a lowercase award name in derived tags', () => {
      const result = deriveAwardTags(new Set(['eisner award Winner 2020']))
      expect(result).toContain('Eisner Award Nominee 2020')
      expect(result).toContain('Eisner Award Winning Series')
      expect(result).not.toContain('eisner award Nominee 2020')
      expect(result).not.toContain('eisner award Winning Series')
    })

    it('title-cases an ALL-CAPS award name in derived tags', () => {
      const result = deriveAwardTags(new Set(['EISNER AWARD Winner 2021']))
      expect(result).toContain('Eisner Award Nominee 2021')
      expect(result).toContain('Eisner Award Winning Series')
    })
  })

  describe('nominee tag', () => {
    it('derives all implied tags from a correctly-cased nominee tag', () => {
      const result = deriveAwardTags(new Set(['Harvey Award Nominee 2019']))
      expect(result).toEqual(
        expect.arrayContaining([
          'Harvey Award Nominee',
          'Harvey Award Nominated Series',
          'Harvey Award Recognized Series',
          'Award Recognized Series',
        ]),
      )
      expect(result).toHaveLength(4)
    })

    it('title-cases a lowercase award name in derived nominee tags', () => {
      const result = deriveAwardTags(new Set(['harvey award Nominee 2019']))
      expect(result).toContain('Harvey Award Nominee')
      expect(result).toContain('Harvey Award Recognized Series')
      expect(result).not.toContain('harvey award Nominee')
    })

    it('does not derive Winning Series for a nominee-only tag', () => {
      const result = deriveAwardTags(new Set(['Eisner Award Nominee 2022']))
      expect(result).not.toContain('Eisner Award Winning Series')
      expect(result).not.toContain('Award Winning Series')
    })
  })

  describe('case-sensitive duplicate prevention', () => {
    it('does not produce duplicate implied tags when the same award appears with different casings across years', () => {
      // "eisner award Winner 2020" and "Eisner Award Winner 2021" both normalize
      // to the same award name — derived tags must be deduplicated.
      const tags = new Set(['eisner award Winner 2020', 'Eisner Award Winner 2021'])
      const result = deriveAwardTags(tags)

      // Each implied award-specific tag should appear at most once
      const nomineeCount = result.filter((t) => t.toLowerCase() === 'eisner award nominee').length
      const winningSeriesCount = result.filter((t) => t.toLowerCase() === 'eisner award winning series').length
      const awardWinningSeriesCount = result.filter((t) => t.toLowerCase() === 'award winning series').length

      expect(nomineeCount).toBe(1)
      expect(winningSeriesCount).toBe(1)
      expect(awardWinningSeriesCount).toBe(1)
    })

    it('does not produce duplicate implied tags when nominee and winner tags for the same award differ in casing', () => {
      const tags = new Set(['eisner award Nominee 2020', 'EISNER AWARD Winner 2021'])
      const result = deriveAwardTags(tags)

      const recognizedCount = result.filter(
        (t) => t.toLowerCase() === 'eisner award recognized series',
      ).length
      expect(recognizedCount).toBe(1)
    })
  })

  describe('existing tag filtering', () => {
    it('does not add tags that already exist (exact match)', () => {
      const tags = new Set(['Eisner Award Nominee 2020', 'Eisner Award Winner 2020'])
      const result = deriveAwardTags(tags)
      expect(result).not.toContain('Eisner Award Nominee 2020')
    })

    it('does not add tags that already exist case-insensitively', () => {
      const tags = new Set(['eisner award nominee 2020', 'Eisner Award Winner 2020'])
      const result = deriveAwardTags(tags)
      expect(result).not.toContain('Eisner Award Nominee 2020')
    })

    it('returns empty array when all implied tags already exist', () => {
      const tags = new Set([
        'Award Recognized Series',
        'Award Winning Series',
        'Eisner Award Nominated Series',
        'Eisner Award Nominee',
        'Eisner Award Nominee 2020',
        'Eisner Award Recognized Series',
        'Eisner Award Winner 2020',
        'Eisner Award Winning Series',
      ])
      expect(deriveAwardTags(tags)).toHaveLength(0)
    })

    it('returns empty array when no award tags are present', () => {
      const tags = new Set(['DC Comics', 'Superhero', 'Trade Paperback'])
      expect(deriveAwardTags(tags)).toHaveLength(0)
    })
  })
})

// ---------------------------------------------------------------------------
// normalizeAwardTags
// ---------------------------------------------------------------------------

describe('normalizeAwardTags', () => {
  it('inserts implied tags after the last award tag', () => {
    const yaml = [
      'tags:',
      '  - tag: Eisner Award Winner 2020',
      '  - tag: Superhero',
    ].join('\n')

    const result = normalizeAwardTags(yaml)
    const lines = result.split('\n')

    expect(lines).toContain('  - tag: Eisner Award Nominee 2020')
    expect(lines).toContain('  - tag: Eisner Award Winning Series')
    expect(lines).toContain('  - tag: Award Winning Series')
  })

  it('title-cases a lowercase award name in inserted tags but leaves the source tag line as-is', () => {
    const yaml = [
      'tags:',
      '  - tag: eisner award Winner 2020',
    ].join('\n')

    const result = normalizeAwardTags(yaml)

    // Derived tags use correctly-cased award name
    expect(result).toContain('  - tag: Eisner Award Nominee 2020')
    expect(result).toContain('  - tag: Eisner Award Winning Series')

    // No derived tag has a lowercase award name prefix
    expect(result).not.toContain('  - tag: eisner award Nominee 2020')
    expect(result).not.toContain('  - tag: eisner award Winning Series')

    // The original source tag is preserved (only its keyword is normalized: winner → Winner)
    expect(result).toContain('  - tag: eisner award Winner 2020')
  })

  it('does not insert duplicates when the same award appears with different casings', () => {
    const yaml = [
      'tags:',
      '  - tag: eisner award Winner 2020',
      '  - tag: Eisner Award Winner 2021',
    ].join('\n')

    const result = normalizeAwardTags(yaml)
    const lines = result.split('\n')

    const nomineeLines = lines.filter((l) => /eisner award nominee$/i.test(l.trim().replace(/^- tag:\s*/i, '')))
    expect(nomineeLines.length).toBe(1)

    const winningSeriesLines = lines.filter((l) =>
      /eisner award winning series$/i.test(l.trim().replace(/^- tag:\s*/i, '')),
    )
    expect(winningSeriesLines.length).toBe(1)
  })

  it('is a no-op when no award tags are present', () => {
    const yaml = ['tags:', '  - tag: Superhero', '  - tag: DC Comics'].join('\n')
    expect(normalizeAwardTags(yaml)).toBe(yaml)
  })

  it('is a no-op when all implied tags already exist', () => {
    const yaml = [
      'tags:',
      '  - tag: Eisner Award Winner 2020',
      '  - tag: Eisner Award Nominee 2020',
      '  - tag: Eisner Award Nominee',
      '  - tag: Eisner Award Winning Series',
      '  - tag: Eisner Award Nominated Series',
      '  - tag: Eisner Award Recognized Series',
      '  - tag: Award Winning Series',
      '  - tag: Award Recognized Series',
    ].join('\n')
    expect(normalizeAwardTags(yaml)).toBe(yaml)
  })

  it('normalizes keyword casing in existing tags (winner → Winner)', () => {
    const yaml = ['tags:', '  - tag: Eisner Award winner 2020'].join('\n')
    const result = normalizeAwardTags(yaml)
    expect(result).toContain('  - tag: Eisner Award Winner 2020')
    expect(result).not.toContain('winner 2020')
  })

  it('normalizes keyword casing in existing series tags', () => {
    const yaml = ['tags:', '  - tag: award recognized series'].join('\n')
    const result = normalizeAwardTags(yaml)
    expect(result).toContain('  - tag: Award Recognized Series')
    expect(result).not.toContain('  - tag: award recognized series')
  })
})
