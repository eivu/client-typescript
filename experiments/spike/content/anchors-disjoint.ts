/**
 * DISJOINT rating anchor exemplars for the confirmatory anchored-rubric spike.
 *
 * The original anchors.ts shared 6 of 8 exemplars with the Phase 0 fixture set
 * (Watchmen, DAMN., Parasite, Detective Comics 1000, In Rainbows, Edge of
 * Tomorrow, etc.), which left ambiguity about whether the variance reduction
 * observed in the first spike came from genuine rubric calibration or from
 * the model literally copying anchor ratings onto matching fixtures.
 *
 * This anchor set is intentionally disjoint from the 8 fixtures in
 * experiments/spike/fixtures.ts. If anchored-rubric-disjoint still beats baseline
 * on stddev, the lever is real and we ship anchors in Phase 2. If it ties,
 * the original win was overlap artifact.
 *
 * Structure mirrors RATING_ANCHORS_FRAGMENT exactly so the only meaningful
 * variable between the two variants is the identity of the exemplars.
 */
export const RATING_ANCHORS_DISJOINT_FRAGMENT = `## §E.1 — ai:rating Anchor Exemplars 🔵

Use these reference works to calibrate ai:rating across media types. When
scoring, compare the available reception data against the closest anchor
and adjust by 0.5 increments. Always cite specific reception evidence in
ai:rating_reasoning — exemplars are calibration, not justification.

### 5.0 — Widespread acclaim + major award wins
- **Maus** (Spiegelman, 1986-91) — Pulitzer Prize Special Award, foundational graphic novel, near-universal acclaim across decades of reassessment
- **The Beach Boys — Pet Sounds** (1966) — Grammy Hall of Fame, AFI and Rolling Stone all-time top albums lists, era-defining critical consensus
- **The Godfather** (Coppola, 1972) — Best Picture Oscar, AFI #2 on Greatest Movies list, durable critical consensus

### 4.0 — Strong positive, minimal criticism (→ Masterwork tag)
- **Bone** (Jeff Smith, 1991-2004) — 10 Eisner wins, 11 Harvey wins, broad critical consensus as a top-tier all-ages epic
- **Radiohead — OK Computer** (1997) — 88 Metacritic, Grammy for Best Alternative Album, frequent top-of-decade placement
- **The Dark Knight** (Nolan, 2008) — 8 Oscar nominations (2 wins), 94% RT, broad critical consensus as a top-tier comic adaptation

### 3.0 — Generally positive, notable mixed reception
- **Spider-Man: Brand New Day** (2008-10) — mainstream Marvel relaunch, divisive among long-time readers, generally positive issue-level reviews but uneven aggregate
- **Gorillaz — Demon Days** (2005) — 80 Metacritic, commercially successful and well-reviewed but not era-defining
- **Star Trek Beyond** (Lin, 2016) — 86% RT but modest box office, solid critical reception without award traction

### 2.0 — Evenly split positive/negative
- **Bloodstrike** (Liefeld, 1993) — early Image Comics title, broadly mixed-to-negative critical reception, commercial peak during the speculator boom
- **Metallica — St. Anger** (2003) — 65 Metacritic, divisive among the fanbase, commercial success without critical consensus
- **Batman & Robin** (Schumacher, 1997) — 12% RT and Razzie nominations but profitable; split between camp defenders and broad critical pan

### 1.0 — Predominantly negative
- **Spider-Man: One More Day** (2007) — broadly considered a disastrous retcon, no critical defenders of note, frequently cited as a low-water mark
- **Lou Reed & Metallica — Lulu** (2011) — 39 Metacritic, near-universal critical pan, no commercial or award recognition
- **The Last Airbender** (Shyamalan, 2010) — 5% RT, swept the Razzies including Worst Picture, broad critical and fan rejection

Use 0.5 increments between anchors. Cite specific evidence in ai:rating_reasoning
(review scores by name, award names, aggregate scores). Anchors are calibration,
not citations.
`
