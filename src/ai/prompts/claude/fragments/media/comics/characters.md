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
