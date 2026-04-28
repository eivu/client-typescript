import {describe, expect, it} from '@jest/globals'

import {deriveAwardTags, normalizeAwardTags} from '../src/ai/award-tags'

describe('award-tags', () => {
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

  describe('deriveAwardTags – case-sensitive duplicate prevention', () => {
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

      const recognizedCount = result.filter((t) => t.toLowerCase() === 'eisner award recognized series').length
      expect(recognizedCount).toBe(1)
    })
  })

  // ---------------------------------------------------------------------------
  // normalizeAwardTags
  // ---------------------------------------------------------------------------

  describe('normalizeAwardTags', () => {
    it('inserts implied tags after the last award tag', () => {
      const yaml = ['tags:', '  - tag: Eisner Award Winner 2020', '  - tag: Superhero'].join('\n')

      const result = normalizeAwardTags(yaml)
      const lines = result.split('\n')

      expect(lines).toContain('  - tag: Eisner Award Nominee 2020')
      expect(lines).toContain('  - tag: Eisner Award Winning Series')
      expect(lines).toContain('  - tag: Award Winning Series')
    })

    it('title-cases the award-name prefix on the source tag AND in inserted tags', () => {
      const yaml = ['tags:', '  - tag: eisner award Winner 2020'].join('\n')

      const result = normalizeAwardTags(yaml)

      // Derived tags use correctly-cased award name
      expect(result).toContain('  - tag: Eisner Award Nominee 2020')
      expect(result).toContain('  - tag: Eisner Award Winning Series')

      // No tag (source or derived) has a lowercase award-name prefix
      expect(result).not.toContain('  - tag: eisner award Winner 2020')
      expect(result).not.toContain('  - tag: eisner award Nominee 2020')
      expect(result).not.toContain('  - tag: eisner award Winning Series')

      // The source tag is normalized to canonical Title Case (prefix + keyword)
      expect(result).toContain('  - tag: Eisner Award Winner 2020')
    })

    it('does not insert duplicates when the same award appears with different casings', () => {
      const yaml = ['tags:', '  - tag: eisner award Winner 2020', '  - tag: Eisner Award Winner 2021'].join('\n')

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

    // Regression: the suffix-only series patterns must use \s+ (not a literal single
    // space) between the keyword and `series` so that AI-emitted variants with
    // extra whitespace (e.g. "Eisner Award winning  series") still get normalized.
    // Mirrors the \s+ used in the cross-award generic patterns above them.
    describe('whitespace tolerance in suffix-only series patterns', () => {
      it.each([
        ['winning', 'Winning'],
        ['nominated', 'Nominated'],
        ['recognized', 'Recognized'],
      ])('normalizes "%s" with extra whitespace before `series`', (lower, title) => {
        const yaml = ['tags:', `  - tag: Eisner Award ${lower}  series`].join('\n')
        const result = normalizeAwardTags(yaml)
        expect(result).toContain(`  - tag: Eisner Award ${title} Series`)
        expect(result).not.toContain(`  - tag: Eisner Award ${lower}  series`)
      })

      it.each([
        ['winning', 'Winning'],
        ['nominated', 'Nominated'],
        ['recognized', 'Recognized'],
      ])('normalizes "%s" with a tab before `series`', (lower, title) => {
        const yaml = ['tags:', `  - tag: Eisner Award ${lower}\tseries`].join('\n')
        const result = normalizeAwardTags(yaml)
        expect(result).toContain(`  - tag: Eisner Award ${title} Series`)
      })
    })
  })

  // Regression: the year-suffixed and series-suffix casing fixes used to capture
  // the YAML prefix and award-name prefix together in `$1`, so backreference-based
  // replacements (e.g. `$1 Winner $2`) only normalized the keyword and left the
  // award-name prefix in its original (often lowercase) casing. This produced
  // inconsistent casing between source and derived tags, and the case-insensitive
  // dedup filter in deriveAwardTags would block the correctly-cased derived form
  // from being added — leaving only the badly-cased source tag in the output.
  describe('normalizeAwardTags – award-name prefix Title Case normalization', () => {
    describe('year-suffixed forms', () => {
      it.each([
        ['eisner award winner 2020', 'Eisner Award Winner 2020'],
        ['EISNER AWARD WINNER 2020', 'Eisner Award Winner 2020'],
        ['harvey award nominee 2019', 'Harvey Award Nominee 2019'],
        ['hugo award Winner 2018', 'Hugo Award Winner 2018'],
        ['pulitzer prize winner 2015', 'Pulitzer Prize Winner 2015'],
      ])('normalizes "%s" → "%s"', (input, expected) => {
        const yaml = ['tags:', `  - tag: ${input}`].join('\n')
        const result = normalizeAwardTags(yaml)
        expect(result).toContain(`  - tag: ${expected}`)
        expect(result).not.toContain(`  - tag: ${input}`)
      })
    })

    describe('series-suffix forms', () => {
      it.each([
        ['eisner award winning series', 'Eisner Award Winning Series'],
        ['HARVEY AWARD NOMINATED SERIES', 'Harvey Award Nominated Series'],
        ['hugo award recognized series', 'Hugo Award Recognized Series'],
        ['ringo award Nominated Series', 'Ringo Award Nominated Series'],
        ['ignatz award winning series', 'Ignatz Award Winning Series'],
      ])('normalizes "%s" → "%s"', (input, expected) => {
        const yaml = ['tags:', `  - tag: ${input}`].join('\n')
        const result = normalizeAwardTags(yaml)
        expect(result).toContain(`  - tag: ${expected}`)
        expect(result).not.toContain(`  - tag: ${input}`)
      })
    })

    it('does not leave a badly-cased source tag when the implied derived tag would otherwise be blocked by dedup', () => {
      // Before the fix: source tag stayed as "eisner award Winning Series" and
      // the derived "Eisner Award Winning Series" was blocked by the dedup
      // filter, leaving only the badly-cased copy in the output.
      const yaml = [
        'tags:',
        '  - tag: Eisner Award Winner 2020',
        '  - tag: eisner award winning series',
      ].join('\n')

      const result = normalizeAwardTags(yaml)
      const lines = result.split('\n')

      const eisnerWinningSeriesLines = lines.filter((l) => /eisner award winning\s+series$/i.test(l))
      expect(eisnerWinningSeriesLines).toHaveLength(1)
      expect(eisnerWinningSeriesLines[0]).toBe('  - tag: Eisner Award Winning Series')
      expect(result).not.toContain('  - tag: eisner award winning series')
    })

    it('produces a fully-canonical output when the entire input is lowercase', () => {
      // End-to-end check that prefix + keyword + derived tags are all canonical.
      const yaml = [
        'tags:',
        '  - tag: eisner award winner 2020',
        '  - tag: harvey award nominee 2019',
      ].join('\n')

      const result = normalizeAwardTags(yaml)

      // No lowercase award-name prefix should survive anywhere in the output.
      expect(result).not.toMatch(/^\s*- tag: (?:eisner|harvey|hugo|pulitzer|ringo|ignatz) /m)

      // Source tags are normalized
      expect(result).toContain('  - tag: Eisner Award Winner 2020')
      expect(result).toContain('  - tag: Harvey Award Nominee 2019')

      // Derived tags follow
      expect(result).toContain('  - tag: Eisner Award Winning Series')
      expect(result).toContain('  - tag: Harvey Award Nominated Series')
    })
  })

  // Regression: standalone `{Award} nominee` / `{Award} winner` (no year) were not
  // covered by SERIES_CASING_FIXES, so the incorrectly-cased original tag persisted
  // AND the correctly-cased derived tag was blocked by the case-insensitive dedup filter.
  describe('normalizeAwardTags – standalone nominee/winner normalization (no year)', () => {
    it('normalizes a fully-lowercase standalone nominee tag to Title Case', () => {
      const yaml = ['tags:', '  - tag: eisner award nominee'].join('\n')
      const result = normalizeAwardTags(yaml)
      expect(result).toContain('  - tag: Eisner Award Nominee')
      expect(result).not.toContain('  - tag: eisner award nominee')
    })

    it('normalizes a fully-lowercase standalone winner tag to Title Case', () => {
      const yaml = ['tags:', '  - tag: harvey award winner'].join('\n')
      const result = normalizeAwardTags(yaml)
      expect(result).toContain('  - tag: Harvey Award Winner')
      expect(result).not.toContain('  - tag: harvey award winner')
    })

    it('does not duplicate Eisner Award Nominee when a badly-cased standalone and a Winner tag coexist', () => {
      // Before the fix: "eisner award nominee" blocked the derived "Eisner Award Nominee"
      // so only one (badly-cased) copy existed. After the fix both the source tag is
      // normalized and the derived copy is correctly deduplicated.
      const yaml = [
        'tags:',
        '  - tag: Eisner Award Winner 2020',
        '  - tag: eisner award nominee',
      ].join('\n')
      const result = normalizeAwardTags(yaml)
      const lines = result.split('\n')
      const nomineeLines = lines.filter((l) => /eisner award nominee$/i.test(l))
      expect(nomineeLines).toHaveLength(1)
      expect(nomineeLines[0]).toBe('  - tag: Eisner Award Nominee')
    })
  })
})
