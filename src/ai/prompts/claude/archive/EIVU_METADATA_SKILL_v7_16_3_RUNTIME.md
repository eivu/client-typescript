---
name: eivu-metadata-runtime
version: 7.16.3-runtime
description: Condensed runtime reference for generating .eivu.yml files. Same rules as v7.16.1, with dynamic ai:engine self-reporting instead of hardcoded model name. Use when token budget is tight.
---

# EIVU Metadata Runtime v7.16.3

## FILE TYPE ROUTING — READ THIS FIRST

Determine file type from extension, then **skip irrelevant sections**:

| Extension | Type | Read | Skip |
|-----------|------|------|------|
| `.cbr` `.cbz` `.pdf` | **Comics** | Violations 1–28a · YAML§Comics · §A Comics/TV/Movies · §B · §C · §D · §E · §F · Checklist§YAML/Name/Characters/Comics/Awards | Violations 29–33 · YAML§Audio · YAML§Video · §A Audio/Video · Checklist§Audio · Checklist§Video |
| `.m4a` `.mp3` `.flac` | **Audio** | Violations 7–13, 19–20, 22–24, 29–31, 33 · YAML§Audio · §A Audio · §E · Checklist§YAML/Awards/Audio | Violations 1–6c, 14–18, 21, 25–28a, 32 · YAML§Comics · YAML§Video · §A Comics/TV/Movies · §B · §C · §D · §F · Season tables · Checklist§Name/Characters/Comics/Video |
| `.mp4` `.mkv` `.avi` | **Video** | Violations 7–13, 19–20, 22–24, 29, 32 · YAML§Video · §A Video/TV/Movies · §E · Checklist§YAML/Awards/Video | Violations 1–6c, 14–18, 21, 25–28a, 30–31, 33 · YAML§Comics · YAML§Audio · §A Comics/Audio · §B · §C · §D · §F · Season tables · Checklist§Name/Characters/Comics/Audio |

**Rule of thumb:** Characters (§B), Universe (§C), Franchise (§F), and Season tables are **comics-only**. The `id3:` prefix is **audio-only**. The `artists`/`release` top-level structure is **audio+video only**.

> **`ai:engine` self-reporting:** Always populate `ai:engine` with the model identifier of the agent executing this skill. Known values: `claude-sonnet-4-6` · `claude-opus-4-6` · `claude-haiku-4-5-20251001`. If uncertain of your exact model string, use your best self-knowledge. Never leave this field as a placeholder or copy a value from an example.

---

## VIOLATIONS — CHECK APPLICABLE ROWS BEFORE OUTPUT

| # | Scope | Rule | ❌ Wrong | ✅ Right |
|---|-------|------|---------|---------|
| 1 | 📗 | Every superhero needs civilian name | `Batman` | `Batman (Bruce Wayne)` |
| 2 | 📗 | Shared mantles: specific + generic BOTH required | `Batman (Bruce Wayne)` alone | `Batman (Bruce Wayne)` + `Batman` |
| 3 | 📗 | Unique codenames: NO generic codename entry | `Harley Quinn (Harleen Quinzel)` + `Harley Quinn` | `Harley Quinn (Harleen Quinzel)` only |
| 4 | 📗 | Multi-codename primary universe: add standalone civilian name | `Oracle (Barbara Gordon)` + `Oracle` | + `Barbara Gordon` too |
| 5 | 📗 | Teams are character entries, not just tags | `tag: Avengers` only | `character: Avengers` (+ tag optional) |
| 6 | 📗 | Non-primary universe characters MUST carry universe label | `Batman (Bruce Wayne)` in Earth-19 story | `Batman (Bruce Wayne: Earth-19)` |
| 6a | 📗 | Primary universe characters NEVER carry a universe label | `Spider-Man (Peter Parker: Marvel Universe 616)` | `Spider-Man (Peter Parker)` |
| 6b | 📗 | Label = character's ORIGIN universe, not the book's universe | `Grifter (Cole Cash: DC Prime Earth)` | `Grifter (Cole Cash: WildStorm Universe)` |
| 6c | 📗 | NO nested parentheses in character entries | `Batman (Bruce Wayne: DC Multiverse (Earth-19))` | `Batman (Bruce Wayne: Earth-19)` |
| 7 | 🔵 | ai:rating >= 4.0 → Masterwork tag required | rating without tag | + `tag: Eivu's AI Masterwork Collection` |
| 8 | 🔵 | ai:rating → ai:rating_reasoning required | rating alone | rating + reasoning citing specific evidence |
| 9 | 🔵 | Award tag present → evaluate ai:rating | apply tag and move on | does this merit a rating? evaluate it |
| 10 | 🔵 | Always generate ai:rating — do not omit | skip rating if no award | generate a rating for every item with any reception data |
| 11 | 📗 | Franchise = property name, never publisher | `franchise: DC Comics` | `franchise: Batman` |
| 12 | 🔵 | Numbers never quoted | `year: "2023"` | `year: 2023` |
| 13 | 🔵 | No top-level `rating` field (deprecated) | `rating: 4` at top level | `ai:rating: 4.0` inside metadata_list |
| 14 | 📗 | Name separator is ` - ` (space-dash-space) | `S04v02 Title` | `S04 v02 - Title` |
| 15 | 📗 | S## from mapping table — never from filename | trust filename S## | look up in authoritative source |
| 16 | 📗 | Eisner series tags: only within recognized creative run | apply to all volumes | only volumes inside award-winning run |
| 17 | 📗 | No `format: Digital` | `format: Digital` | omit format field entirely for digital files |
| 18 | 🔵 | Description = content only — no SEO/search hints | "Features Batman and Joker" | story/content summary only |
| 19 | 🔵 | `ai:skill_version` required on every file | omit | `ai:skill_version: 7.16.3` |
| 20 | 🔵 | `ai:engine` required on every file — use YOUR OWN model name | omit or hardcode a different model | `ai:engine: claude-sonnet-4-6` (Sonnet), `ai:engine: claude-opus-4-6` (Opus), `ai:engine: claude-haiku-4-5-20251001` (Haiku) |
| 21 | 📗 | Spin-off title brands are separate franchises with own S## | Invincible Iron Man as Iron Man S04 | `franchise: Invincible Iron Man`, S01 |
| 22 | 🔵 | All sequential numbers zero-padded to 2+ digits | `S1 E9` or `v2` | `S01 E09` or `v02` |
| 23 | 🔵 | `duration` in integer seconds, not minutes | `duration: 22` | `duration: 1320` |
| 24 | 🔵 | genre values are Title Case | `genre: science fiction` | `genre: Science Fiction` |
| 25 | 📗 | Wolverine in Marvel 616 uses Logan | `Wolverine (James Howlett)` | `Wolverine (Logan)` |
| 26 | 📗 | `collects` field required for all TPBs and collections | omit on a TPB | `collects: "Series (Year) #1-6"` |
| 27 | 📗 | Winner award tags always accompanied by nominee tags | `Eisner Award Winner 2020` alone | + `Eisner Award Nominee` + `Eisner Award Nominee 2020` |
| 28 | 📗 | Non-primary universe characters need plain civilian/character name entry | `Batman (Bruce Wayne: Earth-19)` + `Batman` only | + `Bruce Wayne` · `Shuri (Marvel Universe 6160)` → + `Shuri` |
| 28a | 📗 | Non-primary universe characters with codenames need universe-scoped person-level identifier | `Maker (Reed Richards: Marvel Universe 1610)` + `Reed Richards` only | + `Reed Richards (Marvel Universe 1610)` |
| 29 | 🎵🎬 | Audio/video files require top-level `artists` array | `- artist: Name` in metadata_list | `artists:\n  - name: Name` at top level |
| 30 | 🎵 | Audio files: ID3-mappable fields use `id3:` prefix in metadata_list | `- genre: R&B` · `- producer: Name` | `- id3:genre: R&B` · `- id3:producer: Name` |
| 31 | 🎵 | Audio files always have `artists`; should have `release` when album is known | omit artists/release | `artists` required; `release` strongly recommended |
| 32 | 🎬 | Video files always have `artists`; `release` optional | omit artists | `artists` required; `release` only if applicable |
| 33 | 🎵 | `release.position` = track number on album (integer) | omit or guess | verify track position from authoritative source |

**Scope key:** 📗 = Comics only · 🎵 = Audio only · 🎬 = Video only · 🎵🎬 = Audio + Video · 🔵 = All media types

---

## YAML STRUCTURE

### Comics / Collected Editions 📗

> **Skip this section for audio and video files.**

```yaml
name: string                    # required — §A format rules
year: 2023                      # required — integer, never quoted
description: |                  # optional — story summary only, no SEO
  Content here.
info_url: https://...           # optional but strongly recommended
collects: "Series (Year) #1-6" # required for TPBs/collections
metadata_list:                  # ONE key per item; same key may repeat
  - writer: Name
  - publisher: Name
  - format: Trade Paperback     # omit entirely for digital files
  - genre: Superhero            # Title Case
  - franchise: Batman           # property name, never publisher
  - universe: DC Prime Earth    # required for comics; exact value from §C
  - character: Batman (Bruce Wayne)
  - tag: lowercase freeform
  - ai:rating: 4.0              # 0.5 increments only; omit if insufficient data
  - ai:rating_reasoning: "..."  # required with ai:rating
  - ai:skill_version: 7.16.3
  - ai:engine: <YOUR-MODEL-NAME>  # self-report: e.g. claude-sonnet-4-6, claude-opus-4-6
  - tag: Eivu's AI Masterwork Collection  # only if ai:rating >= 4.0
```

### Audio Files (.m4a, .mp3, .flac, etc.) 🎵

> **Skip this section for comics and video files.**

```yaml
name: string                    # required — §A format rules
year: 2012                      # required — integer, never quoted
duration: 329                   # required — integer seconds
artists:                        # required — array of artist objects
  - name: BJ The Chicago Kid
  - name: Kendrick Lamar
release:                        # strongly recommended for audio
  name: Pineapple Now-Laters    # album/EP/mixtape name
  primary_artist_name: BJ The Chicago Kid
  year: 2012                    # album release year (integer)
  position: 15                  # track number on album (integer)
  bundle_pos: null              # disc number if multi-disc (integer or null)
description: |                  # optional — song summary only, no SEO
  Content here.
info_url: https://...           # optional but strongly recommended
lyrics_url: https://...         # optional — link to authorized lyrics source
metadata_list:                  # ONE key per item; same key may repeat
  - id3:producer: Name          # id3: prefix for ID3-mappable fields
  - id3:label: Label Name       # id3: prefix
  - id3:genre: R&B              # id3: prefix; Title Case
  - tag: lowercase freeform
  - ai:rating: 4.0
  - ai:rating_reasoning: "..."
  - ai:skill_version: 7.16.3
  - ai:engine: <YOUR-MODEL-NAME>  # self-report: e.g. claude-sonnet-4-6, claude-opus-4-6
  - tag: Eivu's AI Masterwork Collection  # only if ai:rating >= 4.0
```

### Video Files (.mp4, .mkv, .avi, etc.) 🎬

> **Skip this section for comics and audio files.**

```yaml
name: string                    # required — §A format rules
year: 2025                      # required — integer, never quoted
duration: 120                   # optional — integer seconds
artists:                        # required — array of artist/creator objects
  - name: Creator Name
release:                        # optional — only if part of a series/album
  name: Series Name
  primary_artist_name: Creator Name
  year: 2025
  position: 1                   # episode/track number if applicable
description: |                  # optional — content summary only, no SEO
  Content here.
info_url: https://...           # optional but strongly recommended
metadata_list:                  # ONE key per item; same key may repeat
  - platform: TikTok            # hosting platform if applicable
  - genre: Political Commentary # Title Case
  - tag: lowercase freeform
  - ai:rating: 3.0
  - ai:rating_reasoning: "..."
  - ai:skill_version: 7.16.3
  - ai:engine: <YOUR-MODEL-NAME>  # self-report: e.g. claude-sonnet-4-6, claude-opus-4-6
```

### Shared Rules (All Media Types) 🔵

**Field order (metadata_list):** people → organizations → physical → classification → ai fields → Masterwork/award tags

**Never:** `null` values · quoted numbers · multiple keys per list item · top-level `rating` · `eivu:isbn` / `eivu:series` / `eivu:volume` / `eivu:pages` / `eivu:format`

### Audio-Only Notes 🎵

> **Skip for comics and video.**

- `artists` is a top-level array (NOT in metadata_list)
- `release` is a top-level object (NOT in metadata_list) — replaces `- album:` in metadata_list
- ID3-mappable fields in metadata_list use `id3:` prefix: `id3:genre`, `id3:producer`, `id3:label`
- Non-ID3 fields (`tag`, `ai:*`) remain unprefixed
- Ignore `artwork_md5` in `release` — do not attempt to generate

### Video-Only Notes 🎬

> **Skip for comics and audio.**

- `artists` is a top-level array (required)
- `release` is a top-level object (optional — use only when video is part of a series or album)
- No `id3:` prefix — video metadata_list fields are unprefixed

---

## §A — NAME FIELD

### Comics / Collected Editions 📗

> **Skip for audio and video.**

```
Format: [Franchise] [S##] [v##] - [Collection Title]

S## = season (mapping table below), zero-padded       S01, S02 …
v## = volume within season, zero-padded               v01, v02 …
### = single issue number, zero-padded                #01, #02 …

Rules:
  Complete season in one book    → S## only, no v##
  Single-season franchise        → v## only, no S##
  Multi-volume season            → S## v##
  S## always before v##; v## always before title
  Separator always " - "

  ✅ Iron Man S06 v02 - The Insurgent Iron Man
  ❌ Iron Man S06v02-The Insurgent Iron Man
  ❌ Iron Man v02 S06 - The Insurgent Iron Man

Branded spin-off (distinct title name) = SEPARATE FRANCHISE, own S## starting S01:
  Invincible Iron Man · Superior Iron Man · Infamous Iron Man · Tony Stark: Iron Man
  Absolute Wonder Woman · Gotham by Gaslight · Ultimate Black Panther

NEVER use S## in search queries — EIVU-internal only.
NEVER derive S## from filename — verify from mapping table.
```

### TV Episodes 📗🎬

> **Skip for audio.**

```
Format: [Series] S## E## - [Episode Title]
Verify episode number and title against IMDb or official source.
```

### Movies 📗🎬

> **Skip for audio.**

```
Format: [Title]  (add year in parens only when disambiguation required)
```

### Audio Tracks 🎵

> **Skip for comics and video.**

```
Format: [Track Title] - [Primary Artist] feat. [Featured Artist(s)]

Rules:
  Always list primary artist after title separator
  Featured artists after "feat." if present
  No S##/v## numbering for audio

  ✅ His Pain - BJ The Chicago Kid feat. Kendrick Lamar
  ❌ His Pain II (feat. Kendrick Lamar) - BJ The Chicago Kid
```

### Video (non-TV, non-movie) 🎬

> **Skip for comics and audio.**

```
Format: [Title]

Rules:
  Use the video's title as-is (cleaned up for readability)
  No S##/v## numbering unless part of a series
```

---

### Season Mapping Tables 📗

> **Skip for audio and video. Seasons apply to comics and TV only.**

*WildC.A.T.s:*
S01=Vol.1 1992–98 · S02=Vol.2 1999–2001 · S03=Version 3.0 2002–04 · S04=Vol.4 2006 · S05=Vol.5 2008–11 · S06=2022–23 DC

*Iron Man* (title brand "Iron Man" only — spin-offs are separate franchises):
S01=Vol.1 1968–96 · S02=Vol.2 Heroes Reborn 1996–97 · S03=Vol.3 1998–2004 · S04=Vol.4 Marvel NOW! 2013–14 · S05=Vol.5 Cantwell 2020–23 · S06=Vol.6 Ackerman 2024–25 · S07=Vol.7 2026–

*Invincible Iron Man* (separate franchise):
S01=Ellis/Knauf 2005–09 · S02=Fraction/Larroca 2008–12 · S03=Bendis/Maleev 2015–16 · S04=Bendis 2017–18 · S05=Duggan 2023–24

*Birds of Prey:*
S01=Vol.1 1999–2009

*Absolute Wonder Woman* (separate franchise):
S01=Thompson 2024–

*Batman: Gotham by Gaslight* (separate franchise):
S01=1989 OGN + Elseworlds continuations

---

## §B — CHARACTER ENTRIES 📗

> **Skip this entire section for audio and video files. Character disambiguation rules apply only to comics.**

### B1. Universe Label Decision

```
STEP 1 — Is this character's ORIGIN universe Marvel 616 or DC Prime Earth?
  YES → NO label. Go to B2.
  NO  → MUST carry a label. Go to Step 2.

STEP 2 — Determine short-form label (NO nested parentheses):

  Full universe field value                   Short-form for character entries
  ─────────────────────────────────────────────────────────────────────────────
  DC Multiverse (Earth-19)               →   Earth-19
  DC Multiverse (Earth-##)               →   Earth-##
  DC Absolute Universe                   →   DC Absolute Universe
  Marvel Universe 1610 (Ultimate v1)     →   Marvel Universe 1610
  Marvel Universe 6160 (Ultimate v2)     →   Marvel Universe 6160
  Marvel Universe #### (description)     →   Marvel Universe ####
  WildStorm Universe                     →   WildStorm Universe
  The Wild Storm Universe                →   The Wild Storm Universe
  [Series Name] Universe                 →   [Series Name] Universe

  Format: Character (Civilian Name: Short-form label)
  ✅ Batman (Bruce Wayne: Earth-19)
  ❌ Batman (Bruce Wayne: DC Multiverse (Earth-19))   ← nested parens

STEP 3 — Add searchability entries for every non-primary universe character

  Every non-primary universe character with a codename requires ALL applicable entries:

  ┌──────────────────────────┬─────────────────────────────────────────────────────────┐
  │ Character type           │ Required entries                                        │
  ├──────────────────────────┼─────────────────────────────────────────────────────────┤
  │ Shared mantle            │ [Codename] (Civilian: Universe)                         │
  │                          │ [Codename]               ← generic codename             │
  │                          │ Civilian Name (Universe) ← universe-scoped person ID   │
  │                          │ Civilian Name            ← plain civilian name          │
  ├──────────────────────────┼─────────────────────────────────────────────────────────┤
  │ Unique codename          │ [Codename] (Civilian: Universe)                         │
  │                          │ Civilian Name (Universe) ← universe-scoped person ID   │
  │                          │ Civilian Name            ← plain civilian name          │
  ├──────────────────────────┼─────────────────────────────────────────────────────────┤
  │ Name-only (no codename)  │ [Name] (Universe)                                       │
  │                          │ [Name]                   ← plain name                  │
  ├──────────────────────────┼─────────────────────────────────────────────────────────┤
  │ Team / organization      │ [Team] (Universe)                                       │
  │                          │ [Team]                   ← plain team name              │
  └──────────────────────────┴─────────────────────────────────────────────────────────┘

  Universe-scoped person-level identifier `Civilian Name (Universe)` tracks the PERSON
  across all codenames in this universe. Example: `Reed Richards (Marvel Universe 1610)`
  finds him as Mister Fantastic in UFF and as Maker in Ultimate Invasion.

  Primary universe (616, DC Prime Earth): entries ARE already the plain form — no extras needed.
  Primary multi-codename: use plain `Civilian Name` as person-level identifier (no universe needed).
```

---

### B2. Codename & Mantle Decision Tree 📗

> **Skip for audio and video.**

```
1. SHARED MANTLE? (multiple people have used this codename — see list below)
   PRIMARY universe:
     - [Codename] (Civilian Name)
     - [Codename]
   NON-PRIMARY universe:
     - [Codename] (Civilian Name: Universe)
     - [Codename]
     - Civilian Name (Universe)             ← universe-scoped person-level identifier
     - Civilian Name

2. MULTI-CODENAME character? (same person, multiple codenames — see list below)
   PRIMARY universe:
     - [Active Codename] (Civilian Name)
     - [Active Codename]
     - Civilian Name                        ← standalone civilian name (person-level identifier)
   NON-PRIMARY universe:
     - [Active Codename] (Civilian Name: Universe)
     - [Active Codename]
     - Civilian Name (Universe)             ← universe-scoped person-level identifier
     - Civilian Name

3. SINGLE codename, single holder:
   PRIMARY:     - [Codename] (Civilian Name)           [no generic, no civilian standalone]
   NON-PRIMARY: - [Codename] (Civilian Name: Universe)
                - Civilian Name (Universe)             ← universe-scoped person-level identifier
                - Civilian Name

4. NAME-ONLY character (no codename, e.g. Shuri, Okoye, John Constantine):
   PRIMARY:     - [Name]
   NON-PRIMARY: - [Name] (Universe)
                - [Name]

5. TEAM / ORGANIZATION:
   PRIMARY:     - [Team Name]
   NON-PRIMARY: - [Team Name] (Universe)
                - [Team Name]

When uncertain whether a mantle is shared → assume SHARED.
Verify civilian name for the specific universe — never assume it matches 616/Prime Earth.
```

**Shared mantles** (step 1 YES):
Batman · Robin · Batgirl · Nightwing · Red Hood · Black Canary · Green Lantern · Flash · Aquaman · Wonder Woman · Spider-Man · Captain America · Thor · Iron Man · Hulk · She-Hulk · Captain Marvel · Ms. Marvel · Black Panther · Wolverine · X-23 · Daredevil · Hawkeye · War Machine · Iron Fist · Starbrand · Ant-Man · Giant-Man · Wasp · Nova · Blue Beetle · The Atom · Firestorm

**Preferred civilian name overrides:**
- Wolverine (616) → `Wolverine (Logan)` — NOT James Howlett
- Magneto (616) → `Magneto (Max Eisenhardt)` — NOT Erik Lehnsherr

**Unique codenames** (step 1 NO, step 2 NO → single entry):
Harley Quinn · Big Barda · Pyro · Havok · Polaris · Joker · Lex Luthor · Magneto · Mephisto · Doctor Doom · Tao · Savant · Mr. Majestic · Professor X · Ra's al Ghul · Mister Sinister · Apocalypse · Emma Frost · Mystique · Moira MacTaggert · Cyclops · Jean Grey · Storm

**Multi-codename characters** (step 2 YES → active codename + generic + civilian):
- Carol Danvers: Ms. Marvel → Binary → Warbird → Captain Marvel
- Dick Grayson: Robin → Nightwing → Batman → Agent 37
- Barbara Gordon: Batgirl → Oracle → Batgirl
- Cassandra Cain: Batgirl → Black Bat → Orphan
- Wally West: Kid Flash → Flash
- Bucky Barnes: Bucky → Winter Soldier → Captain America
- Sam Wilson: Falcon → Captain America → Falcon
- Jason Todd: Robin → Red Hood
- James Rhodes: War Machine / Iron Patriot
- Billy Batson: Captain Marvel → Shazam

**Canonically absorbed characters — treat as primary universe for ALL appearances:** 📗
- **Direct absorption:** Character moved + origin retroactively rewritten as native primary universe.
  - *Miles Morales* → `Spider-Man (Miles Morales)` + `Miles Morales` everywhere, including original 1610 stories
- **Universe collapse:** Origin universe erased, characters folded into primary.
  - *Crisis on Infinite Earths absorbed characters* (e.g. Donna Troy)
- Variants in OTHER non-primary universes still get normal universe labels.

**Teams** (character entries, not just tags): 📗
Marvel: Avengers · X-Men · Fantastic Four · Guardians of the Galaxy · Inhumans · Defenders · Ultimates · S.H.I.E.L.D. · Hydra · A.I.M. · Illuminati · New Avengers · Young Avengers · Champions · Thunderbolts · X-Force · New Mutants · Excalibur
DC: Justice League · Teen Titans · Suicide Squad · Legion of Super-Heroes · Justice Society · Birds of Prey · Outsiders · Doom Patrol · Green Lantern Corps · Checkmate

---

## §C — UNIVERSE FIELD VALUES 📗

> **Skip for audio and video. Comics require a `universe` field; audio/video files do not.**

| Continuity | `universe` field value |
|-----------|----------------------|
| Marvel main (Earth-616) | `Marvel Universe 616` |
| Marvel Ultimate v1 (2000–2015) | `Marvel Universe 1610 (Ultimate v1)` |
| Marvel Ultimate v2 (2023–) | `Marvel Universe 6160 (Ultimate v2)` |
| DC main | `DC Prime Earth` |
| DC Absolute line | `DC Absolute Universe` |
| DC Elseworlds Earth-19 (Gotham by Gaslight) | `DC Multiverse (Earth-19)` |
| DC Elseworlds other | `DC Multiverse (Earth-##)` |
| WildStorm original (1992–2011, Earth-50) | `WildStorm Universe` |
| WildStorm Ellis reboot (2017–2019) | `The Wild Storm Universe` |
| Creator-owned | `[Series Name] Universe` |

`The Wild Storm Universe` ≠ `WildStorm Universe` — never conflate.
WildStorm franchise: original → `WildC.A.T.s`; Ellis reboot → `The Wild Storm`

---

## §D — AWARD TAGS 📗

> **Skip for audio and video. Eisner and comic-specific award handling is comics-only.**

```
Volume directly nominated/won → Eisner Award Nominee [year] (+ Winner [year] if won)
Volume within recognized creative run → Eisner Award recognized series
  + winning series (if series won) OR nominated series (if series nominated only)
Winner tags always accompanied by Nominee tags.
Year = year award was PRESENTED (not publication year).
Uncertain about run boundaries → omit series tags.
```

| Tag | When |
|-----|------|
| `Eisner Award Winner [year]` | This volume directly won |
| `Eisner Award Nominee [year]` | This volume nominated (always with Winner tag) |
| `Eisner Award Nominee` | Generic (always with year tag) |
| `Eisner Award recognized series` | Volume within recognized run |
| `Eisner Award winning series` | Run won |
| `Eisner Award nominated series` | Run nominated, didn't win |

Same logic for Hugo Award · Pulitzer Prize · etc.

---

## §E — ai:rating SCALE 🔵

> **Applies to all media types.**

Always generate an ai:rating. Omit only if genuinely no reception data exists (unreleased, zero reviews).

```
5.0 = Widespread acclaim + major award wins + exceptional consensus
4.5 = Widespread critical acclaim OR major award recognition
4.0 = Strong positive, minimal criticism                              → + Masterwork tag
3.5 = Mostly positive with some mixed reviews
3.0 = Generally positive, notable mixed reception
2.5 = Evenly split positive/mixed
2.0 = Evenly split positive/negative
1.5 = Mostly negative with some positive
1.0 = Predominantly negative
```

Always cite specific evidence: CBR scores, Eisner wins, Metacritic, etc.
Only 0.5 increments. Awards verified from official bodies only — never marketing copy.

---

## §F — FRANCHISE vs PUBLISHER 📗

> **Skip for audio and video. Franchise/publisher distinction applies to comics only.**

```
franchise = PROPERTY:   Batman · Avengers · Powers · WildC.A.T.s · The Wild Storm
publisher = COMPANY:    DC Comics · Marvel Comics · Image Comics · WildStorm Productions
```

---

## FINAL CHECKLIST

### YAML (All Media Types) 🔵
- [ ] Numbers unquoted · 2-space indent · no tabs · no null · pipe on multi-line descriptions
- [ ] One key per metadata_list item · no deprecated top-level `rating`
- [ ] `ai:skill_version: 7.16.3` present · `ai:engine` present and set to THIS agent's own model name
- [ ] genre Title Case · sequential numbers zero-padded

### Name (Comics Only) 📗

> **Skip for audio and video.**

- [ ] Separator ` - ` (space-dash-space) · S## before v##/E## · all zero-padded
- [ ] S## from mapping table, never from filename
- [ ] Spin-off brands have own franchise + own S## sequence

### Characters (Comics Only) 📗

> **Skip for audio and video.**

- [ ] Every superhero has civilian name in parens
- [ ] Shared mantles: specific + generic entries both present (violations 1–2)
- [ ] Unique codenames: NO generic codename (violation 3)
- [ ] Multi-codename primary: specific + generic + standalone civilian (violation 4)
- [ ] Non-primary universe characters with codenames: labeled + universe-scoped person ID `Civilian Name (Universe)` + plain civilian name (violations 6, 28, 28a)
- [ ] Non-primary name-only characters: labeled + plain name (violation 28)
- [ ] NO nested parentheses — short-form label used (violation 6c)
- [ ] Primary universe (616, DC Prime Earth): NO universe label (violation 6a)
- [ ] Label = origin universe, not book setting (violation 6b)
- [ ] Civilian name verified for that universe
- [ ] Canonically absorbed characters (Miles Morales, Crisis-absorbed chars): NO universe label ever
- [ ] Wolverine (616) → Logan · Magneto (616) → Max Eisenhardt
- [ ] Teams/organizations listed as character entries

### Comics Structure 📗

> **Skip for audio and video.**

- [ ] `collects` present for all TPBs/collections
- [ ] `info_url` present
- [ ] `franchise` = property name, not publisher
- [ ] `universe` matches §C exactly
- [ ] No `format: Digital`
- [ ] X-Men 2019–2024 → `tag: Krakoa era` · crossover events → `tag: comics event`

### Awards & Ratings (All Media Types) 🔵
- [ ] Award history researched from official sources
- [ ] ai:rating generated for every item with any available reception data
- [ ] ai:rating present → ai:rating_reasoning present with evidence
- [ ] ai:rating >= 4.0 → `tag: Eivu's AI Masterwork Collection` after ai:engine
- [ ] Winner tags accompanied by Nominee tags
- [ ] Eisner series tags only within recognized creative run (comics only)

### Audio Files 🎵

> **Skip for comics and video.**

- [ ] `artists` array present at top level (required) — NOT in metadata_list
- [ ] `release` object present at top level when album is known
- [ ] `release.position` = correct track number (integer)
- [ ] `release.primary_artist_name` matches primary artist
- [ ] `release.year` = album release year (integer, not quoted)
- [ ] ID3-mappable fields prefixed with `id3:` (`id3:genre`, `id3:producer`, `id3:label`)
- [ ] Non-ID3 fields (`tag`, `ai:*`) remain unprefixed
- [ ] `duration` present in integer seconds
- [ ] `lyrics_url` present when lyrics source is available
- [ ] No `- artist:` or `- album:` entries in metadata_list (moved to top level)
- [ ] `artwork_md5` never generated — omit or leave null

### Video Files 🎬

> **Skip for comics and audio.**

- [ ] `artists` array present at top level (required) — NOT in metadata_list
- [ ] `release` at top level only if video is part of a series/album
- [ ] `duration` in integer seconds when known
- [ ] No `id3:` prefix on metadata_list fields (video fields are unprefixed)
