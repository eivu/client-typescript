/**
 * Rating anchor exemplars for variant 2 (anchored rubric).
 *
 * PENDING USER SIGN-OFF — these draft exemplars are derived from the v7.16.4
 * skill's §E rubric (lines 481-500), which defines the integer scale but offers
 * no anchor examples. The exemplars below are 3 canonical works per integer
 * rating across media types, chosen so that:
 *   - 5.0 examples have unambiguous major-award wins
 *   - 4.0 examples have strong consensus but lack a "best of the year" sweep
 *   - 3.0 examples have positive but uneven critical reception
 *   - 2.0 examples have split reactions (commercial success + critical drubbing,
 *     or vice versa)
 *   - 1.0 examples are broadly panned with no defenders of note
 *
 * The user should review this list before variant 2 runs; if the exemplars
 * don't match the user's editorial sense, variant 2 measures the wrong thing.
 */
export const RATING_ANCHORS_FRAGMENT = `## §E.1 — ai:rating Anchor Exemplars 🔵

Use these reference works to calibrate ai:rating across media types. When
scoring, compare the available reception data against the closest anchor
and adjust by 0.5 increments. Always cite specific reception evidence in
ai:rating_reasoning — exemplars are calibration, not justification.

### 5.0 — Widespread acclaim + major award wins
- **Watchmen** (Moore/Gibbons, 1986-87) — Hugo Award, foundational work, near-universal acclaim across 35+ years of reassessment
- **Kendrick Lamar — DAMN.** (2017) — Pulitzer Prize for Music, 4 Grammys including Best Rap Album, 95 Metacritic
- **Parasite** (Bong Joon-ho, 2019) — Palme d'Or, 4 Oscars including Best Picture, 99% RT critics consensus

### 4.0 — Strong positive, minimal criticism (→ Masterwork tag)
- **Saga of the Swamp Thing** (Moore, 1984-87) — multiple Eisner wins, near-unanimous critical praise, frequent best-of-decade lists
- **Radiohead — In Rainbows** (2007) — 88 Metacritic, year-end #1 on multiple major outlets, Grammy for Best Alternative Album
- **Mad Max: Fury Road** (2015) — 10 Oscar nominations (6 wins), 97% RT, broad critical consensus as a top-tier action film

### 3.0 — Generally positive, notable mixed reception
- **Detective Comics #1000** (2019) — milestone anthology, generally positive reviews but uneven stories pulled the aggregate down (~7.5/10 on ComicBookRoundUp)
- **Phantom Planet — The Guest** (2002) — solid 73 Metacritic, mainstream alt-rock success driven by "California" but album quality uneven
- **Edge of Tomorrow** (2014) — 91% RT but underperformed commercially; strong critical reception without award traction

### 2.0 — Evenly split positive/negative
- **Heroes Reborn: Captain America** (Loeb/Liefeld, 1996) — mixed at release, retrospectively viewed as low-point of the Heroes Reborn experiment
- **30 Seconds to Mars — This Is War** (2009) — split between fan acclaim and critical skepticism (~60 Metacritic), commercial success without consensus
- **Suicide Squad** (Ayer, 2016) — 26% RT but profitable; split fan/critic reception, Best Makeup Oscar despite broader negativity

### 1.0 — Predominantly negative
- **All-Star Batman & Robin** (Miller/Lee, 2005-08) — broadly panned for tone, dialogue, and pacing; no award recognition; cited as a low-water mark for both creators
- **Britney Spears — Britney Jean** (2013) — 46 Metacritic, weakest commercial debut of her catalog, broad critical drubbing
- **Cats** (Hooper, 2019) — 18% RT, swept Razzies (Worst Picture among 6 wins), box-office disaster despite high-profile cast

Use 0.5 increments between anchors. Cite specific evidence in ai:rating_reasoning
(review scores by name, award names, aggregate scores). Anchors are calibration,
not citations.
`
