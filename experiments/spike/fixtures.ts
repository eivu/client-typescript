import type {Fixture} from '@experiments/spike/types.js'

/**
 * Phase 0 spike fixtures. Filename-only — no binary files required because
 * the metadata pipeline reads only the basename to construct prompts.
 *
 * Distribution: 3 comics + 3 audio + 2 video = 8 fixtures (per Phase 0 plan).
 * Tiers (obscure / mid-tier / award-winner) span the reception-data spectrum
 * so the spike can detect whether consistency or rating accuracy degrades on
 * thin-evidence fixtures.
 *
 * Filenames mirror the eivu naming conventions seen in test/fixtures/samples/
 * (year in parens, distribution tags in parens, .cbz/.cbr/etc.) so the existing
 * `buildUserMessage` routing in base-agent.ts picks the right category.
 *
 * THIS LIST IS SUBJECT TO USER SIGN-OFF before the full spike runs.
 */
export const FIXTURES: Fixture[] = [
  // --- Comics (3) ---
  {
    category: 'comic',
    expectation: 'Dell golden-age horror, public domain, almost no reception data — tests low-evidence behavior.',
    filename: 'Werewolf 001 (c2c) (Dell 1966).cbr',
    name: 'obscure-comic-werewolf-001',
    tier: 'obscure',
  },
  {
    category: 'comic',
    expectation: 'Mainstream DC milestone issue (1000th Detective Comics) — moderate critical attention, multiple reviews.',
    filename: 'Detective Comics 1000 (2019) (Digital) (Zone-Empire).cbz',
    name: 'mid-tier-comic-detective-1000',
    tier: 'mid-tier',
  },
  {
    category: 'comic',
    expectation:
      'Complete-series TPB collection of Watchmen (Hugo Award winner). The TPB has stronger and more uniform reception evidence than any single issue, so this is the cleaner award-winner anchor.',
    filename: 'Watchmen (1995) (digital) (Minutemen-Ghus).cbz',
    name: 'award-winner-comic-watchmen-tpb',
    tier: 'award-winner',
  },

  // --- Audio (3) ---
  {
    category: 'audio',
    expectation: 'Niche indie folk track, modest reviews — tests audio mid-low evidence.',
    filename: 'The Mountain Goats - Going to Georgia (1995).mp3',
    name: 'obscure-audio-mountain-goats',
    tier: 'obscure',
  },
  {
    category: 'audio',
    expectation: 'Mainstream alt-rock single, moderate reception (Phantom Planet "California" / The OC).',
    filename: 'Phantom Planet - California (2002).mp3',
    name: 'mid-tier-audio-phantom-planet',
    tier: 'mid-tier',
  },
  {
    category: 'audio',
    expectation: 'Pulitzer Prize for Music + multiple Grammys — top of the audio rubric.',
    filename: 'Kendrick Lamar - DNA (2017) [DAMN].mp3',
    name: 'award-winner-audio-kendrick-dna',
    tier: 'award-winner',
  },

  // --- Video (2) ---
  {
    category: 'video',
    expectation: 'Cult sci-fi action, strong but not award-tier reception.',
    filename: 'Edge of Tomorrow (2014) [1080p].mp4',
    name: 'mid-tier-video-edge-of-tomorrow',
    tier: 'mid-tier',
  },
  {
    category: 'video',
    expectation: 'Best Picture + Palme d\'Or + Oscar for Best Director — top of the video rubric.',
    filename: 'Parasite (2019) [1080p].mkv',
    name: 'award-winner-video-parasite',
    tier: 'award-winner',
  },
]
