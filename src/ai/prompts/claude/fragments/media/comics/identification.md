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
  - ai:skill_version: 7.16.4
  - ai:engine: <YOUR-MODEL-NAME>  # self-report: e.g. claude-sonnet-4-6, claude-opus-4-6
  # ai:cost, ai:cost_all, ai:tokens_in, ai:tokens_out are injected here by the post-processor (rule #34) — DO NOT emit yourself
  - tag: Eivu's AI Masterwork Collection  # only if ai:rating >= 4.0
```

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
