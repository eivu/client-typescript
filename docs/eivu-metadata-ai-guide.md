---
name: eivu-metadata
description: Generate .eivu.yml metadata files (also triggered by "eivu yml", "eivu.yml", "eivu yaml") for the Eivu upload system with proper YAML structure, character disambiguation, and comprehensive metadata
---

# EIVU Metadata Generation Skill

## Skill Purpose

Generate `.eivu.yml` metadata files for the Eivu upload system. These YAML files provide rich metadata for media files including movies, music, comics, books, and other digital content.

## When to Use This Skill

Use this skill when the user asks to:

- Create `.eivu.yml`, `eivu.yml`, or `eivu yml` files for media content
- Generate metadata for movies, music, comics, books, PDFs, or other files
- Update or modify existing EIVU metadata files
- Convert metadata from other formats to EIVU format
- Any mention of "eivu" combined with "metadata", "yml", "yaml", or "file"

## File Naming Convention

### For File Association

Append `.eivu.yml` to the complete filename (including extension):

- `movie.mp4` → `movie.mp4.eivu.yml`
- `comic.cbz` → `comic.cbz.eivu.yml`
- `song.mp3` → `song.mp3.eivu.yml`

### For Bulk Updates

Use MD5 hash: `{MD5_HASH}.eivu.yml` (uppercase, 32 hex characters)

- Example: `6068BE59B486F912BB432DDA00D8949B.eivu.yml`

### Determining Collection vs Single Issue (Comics)

**If no issue number is present in the filename** (e.g., no "001", "#1"), assume the item is:

- A **collection** (trade paperback, omnibus, complete collection)
- OR a **one-shot** (single standalone issue)

**When it's a collection:**

- Research to find what issues are collected
- Include comprehensive `collects` field
- Include `info_url` linking to official publisher page
- Example filename: `Spider-Verse (2015) (Digital).cbz` → This is the TPB collection, not individual issues

## YAML Structure Template

```yaml
# Top-level fields (all optional - omit if no meaningful value)
name: string
year: number
rating: number
duration: number
description: |
  Multi-line description.

  Use pipe operator for paragraphs.
info_url: string
artwork_md5: string

# Metadata list (array of single-key objects)
metadata_list:
  - key1: value1
  - key2: value2
  - key1: value3 # Same key can repeat
```

## Top-Level Fields

| Field         | Type    | Description                                               | Example                  |
| ------------- | ------- | --------------------------------------------------------- | ------------------------ |
| `name`        | string  | Primary title                                             | `"The Dark Knight"`      |
| `year`        | integer | Release year (4 digits)                                   | `2008`                   |
| `rating`      | number  | **DEPRECATED - Use `ai:rating` in metadata_list instead** | N/A                      |
| `duration`    | integer | Duration in seconds                                       | `7200`                   |
| `description` | string  | Multi-line description (use `\|`)                         | See examples             |
| `info_url`    | string  | URL to additional info                                    | `"https://imdb.com/..."` |
| `artwork_md5` | string  | MD5 of artwork (32 char uppercase)                        | `"ABC123..."`            |

## Metadata List Keys

### People

- `performer` - Actors, voice actors
- `writer` - Writers, authors, screenwriters
- `artist` - Artists, illustrators
- `director` - Directors
- `producer` - Producers
- `composer` - Music composers
- `conductor` - Orchestra conductors
- `penciler` - Comic pencilers
- `inker` - Comic inkers
- `letterer` - Comic letterers
- `colorist` - Comic colorists
- `cover_artist` - Cover artists
- `editor` - Editors

### Organizations

- `studio` - Production studio
- `publisher` - Publishing company
- `label` - Record label
- `distributor` - Distribution company

### Classification

- `tag` - General tags/keywords
- `genre` - Genre (can repeat)
- `character` - Character names (can repeat)
  - **CRITICAL**: Organizations/teams serving narrative roles MUST be listed as characters (e.g., Avengers, X-Men, Eternals, Illuminati, Revengers)
  - **IMPORTANT**: Teams should get their own character entry in addition to individual team members
- `series` - Series name
- `franchise` - Franchise name
- `universe` - Fictional universe

### Physical Format (Comics/Books)

- `isbn` - ISBN (NO prefix)
- `pages` - Page count (NO prefix)
- `format` - Physical format (NO prefix): `Trade Paperback`, `Hardcover`, `Omnibus`
  - **IMPORTANT**: Do NOT use `format: Digital` - all files are inherently digital
  - Only use format to indicate the physical binding type of the original publication
  - Examples: `Trade Paperback`, `Hardcover`, `Omnibus`, `Deluxe Edition`
- `collects` - What issues/content the collection includes (IMPORTANT for trade paperbacks and collections)
  - Format: "Series Name (Year) #1-6" or "Series Name (Year) #1-6, Annual #1"
  - Example: `collects: "Ultimate Spider-Man (2024) #1-6"`
  - Example: `collects: "Batman (2016) #85-100"`
  - Include this field whenever collection information is available

### URLs

- `source_url` - Where content obtained
- `info_url` - Additional information (IMPORTANT: Include when available for cross-referencing)
  - Use official publisher pages (Marvel.com, DC.com, etc.)
  - Helps verify metadata accuracy and understand what's in collections
  - Enables source checking and cross-referencing
  - Example: `info_url: https://www.marvel.com/comics/collection/112986/ultimate_spider-man_by_jonathan_hickman_vol_1_married_with_children_trade_paperback`
- `synopsis` - Brief plot summary

### Audio Metadata (ID3 namespace)

- `id3:album` - Album name
- `id3:artist` - Artist name
- `id3:band` - Band/album artist
- `id3:track_nr` - Track number
- `id3:disc_nr` - Disc number
- `id3:genre` - Music genre
- `id3:year` - Year
- `id3:title` - Track title
- `id3:composer` - Composer
- `id3:conductor` - Conductor

### Eivu-Specific (eivu namespace)

- `eivu:artist_name` - Primary artist
- `eivu:release_name` - Release/album name
- `eivu:album_artist` - Album artist
- `eivu:release_pos` - Track number
- `eivu:bundle_pos` - Disc position
- `eivu:artwork_md5` - Artwork reference
- `eivu:name` - Override name
- `eivu:year` - Year
- `eivu:duration` - Duration in seconds

**DO NOT USE**: `eivu:series`, `eivu:volume`, `eivu:isbn`, `eivu:pages`, `eivu:format` (use plain keys instead)

### AI Namespace (ai namespace)

- `ai:rating` - AI-assessed quality rating (1-5 scale, integer only)
  - **CRITICAL**: Do NOT use the top-level `rating` field. Use `ai:rating` in metadata_list instead.
  - Only apply when the work is demonstrably exceptional (critically acclaimed, award-winning, culturally significant)
  - Do NOT impose ratings arbitrarily - omit if not confident the work deserves recognition
  - When `ai:rating` is 4.5 or above (round 4.5 to 5), ALSO add tag: `Eivu's AI Masterwork Collection`
- `ai:reasoning` - **REQUIRED** when `ai:rating` is used
  - Must provide clear justification for the rating with specific evidence
  - Include awards, critical acclaim, sales records, historical significance, or cultural impact
  - Example: "Won 2023 Eisner Award for Best Continuing Series. Became #3 bestselling graphic novel of 2024 despite only 4 months on sale. Selected by Hollywood Reporter as Best Marvel Comic of 2024."

### Override Namespace

- `override:name` - Force override auto-detected name

## Critical Rules

### 1. Single-Key Objects in metadata_list

Each list item is ONE key-value pair:

✅ **CORRECT:**

```yaml
metadata_list:
  - character: Batman
  - tag: superhero
```

❌ **WRONG:**

```yaml
metadata_list:
  - character: Batman, tag: superhero
```

### 2. Repeating Keys Are Intentional

Same key can appear multiple times:

```yaml
metadata_list:
  - tag: action
  - tag: thriller
  - character: Batman
  - character: Joker
```

### 3. Numbers Are Never Quoted

✅ **CORRECT:**

```yaml
year: 2023
duration: 180
pages: 630
```

❌ **WRONG:**

```yaml
year: '2023'
duration: '180'
pages: '630'
```

### 4. Multi-line Descriptions Use Pipe

✅ **CORRECT:**

```yaml
description: |
  First paragraph.

  Second paragraph.
```

❌ **WRONG:**

```yaml
description: "Line 1\nLine 2"
```

### 5. Omit Empty Fields

✅ **CORRECT:**

```yaml
name: My File
year: 2023
```

❌ **WRONG:**

```yaml
name: My File
year: 2023
rating: null
description: null
```

### 6. Use Underscores in Keys

✅ **CORRECT:**

```yaml
- cover_artist: John Doe
```

❌ **WRONG:**

```yaml
- coverArtist: John Doe
- cover-artist: John Doe
```

### 7. No AI Instructions in Descriptions

✅ **CORRECT:**

```yaml
description: |
  This represents the 4th iteration of the series (2010-2013).
```

❌ **WRONG:**

```yaml
description: |
  Plot summary.

  When searching, omit "S04" as it's EIVU-specific.
```

### 8. Plain Keys for Physical Format

✅ **CORRECT:**

```yaml
metadata_list:
  - isbn: 9781302907730
  - pages: 630
  - format: Trade Paperback
```

❌ **WRONG:**

```yaml
metadata_list:
  - eivu:isbn: 9781302907730
  - eivu:pages: 630
  - eivu:format: Trade Paperback
```

## Comic Books: Special Handling

### Character Disambiguation (CRITICAL)

**ALWAYS** disambiguate superhero identities with civilian names in parentheses, but the rule differs for unique vs shared codenames:

**Unique Codenames** (only one character ever used this name):

```yaml
metadata_list:
  - character: Pyro (Simon Lasker)
  - character: Havok (Alex Summers)
  - character: Polaris (Lorna Dane)
```

Only include the disambiguated version. No need for generic entry.

**Shared Codenames** (multiple characters have used this name):

```yaml
metadata_list:
  - character: Spider-Man (Peter Parker)
  - character: Spider-Man
  - character: Captain America (Steve Rogers)
  - character: Captain America
  - character: Captain America (Bucky Barnes)
  - character: Doctor Doom (Victor von Doom)
  - character: Doctor Doom
```

Include BOTH the specific disambiguated version AND the generic name for each character who uses the codename.

❌ **WRONG:**

```yaml
metadata_list:
  - character: Pyro (Simon Lasker)
  - character: Pyro # Wrong - only one Pyro exists
  - character: Spider-Man (Peter Parker) # Wrong - missing generic "Spider-Man"
```

**RULE**: When applying a disambiguated character for a shared codename (e.g., `Starman (Jack Knight)`), ALSO add the generic character name (e.g., `Starman`). For unique codenames, only the disambiguated version is needed.

### Organizations as Characters

List organizations/teams when they serve narrative roles:

```yaml
metadata_list:
  - character: Iron Man (Tony Stark)
  - character: Illuminati
  - character: Revengers
  - character: Sinister Six
```

### Season/Volume Notation

- **S## notation**: Represents different seasons/iterations of a comic series over time (S01 = Season 1, S04 = Season 4)
- **v## notation**: Represents volume numbers within a single season (v01 = Volume 1, v02 = Volume 2)
- **In filename**: `Avengers S04 v01 - Complete Collection`
- **In name field**: `name: Avengers S04 by Brian Michael Bendis v01 - Complete Collection`
  - **CRITICAL**: Volume number (v##) must come BEFORE the collection name for proper alphabetical sorting
  - **Correct**: `X-Factor S05 by Mark Russell v02 - Know Your Enemy`
  - **Wrong**: `X-Factor S05 by Mark Russell - Know Your Enemy v02`
- **In description**: Explain what S04 represents (e.g., "This volume collects issues #1-6 of the 4th season (2010-2013)")
- **NOT as metadata**: Don't use `eivu:series` or `eivu:volume`

**Key distinction**: Season numbers (S01, S02, etc.) distinguish between different iterations or relaunches of a title over time, while volume numbers (v01, v02, etc.) organize collected editions within a single season's run.

### Publisher Disambiguation

```yaml
- character: Big Three (Marvel) # Iron Man, Cap, Thor
- character: Big Three (DC) # Superman, Batman, Wonder Woman
```

### Franchise and Universe Guidelines

**Franchise vs Publisher**: Franchise refers to the specific property/hero, NOT the publisher

- **Correct**: `franchise: Batman`, `franchise: Avengers`, `franchise: Powers`
- **Incorrect**: `franchise: DC Comics`, `franchise: Marvel Comics`, `franchise: Image Comics`

**Universe Naming Conventions**:

- **Marvel main continuity (Earth-616)**: `universe: Marvel Universe 616`
- **Marvel alternate universes**: `universe: Marvel Universe [NUMBER] ([ITERATION])`
  - Example: `universe: Marvel Universe 6160 (Ultimate v2)` - Second iteration of Ultimate Universe
  - Example: `universe: Marvel Universe 1610 (Ultimate v1)` - Original Ultimate Universe (2000-2015)
- **DC main continuity**: `universe: DC Universe`
- **DC Absolute line**: `universe: DC Absolute Universe`
- **Creator-owned**: `universe: [Series Name] Universe` (e.g., `Powers Universe`)

**Character Disambiguation for Alternate Universes**:

- **Primary universe characters (Marvel 616, DC Universe)**: NO universe label needed
  - Example: `Spider-Man (Peter Parker)` - assumes Marvel Universe 616
  - Example: `Batman (Bruce Wayne)` - assumes DC Universe
- **Alternate universe characters**: MUST include universe designation in parentheses
  - Format: `[Character] ([Identity]: [Universe])`
  - Example: `Spider-Man (Peter Parker: Marvel Universe 6160)` - Ultimate v2 Spider-Man
  - Example: `Spider-Man (Miles Morales: Marvel Universe 1610)` - Original Ultimate Universe
  - Example: `Batman (Bruce Wayne: DC Absolute Universe)` - Absolute Universe Batman
- **Rationale**: Characters from different universes may meet/interact, requiring clear distinction
- **Generic entries**: Still include generic name for searchability alongside universe-specific versions
  - Example: Include both `Spider-Man (Peter Parker: Marvel Universe 6160)` AND `Spider-Man`

**Multiple Franchises**: Team-up books can have multiple franchise entries

```yaml
- franchise: Batman
- franchise: Superman
- universe: DC Universe
```

### Comic Book Checklist (Apply BEFORE Presenting)

- [ ] All superhero identities include civilian names
- [ ] Shared codenames have both generic and disambiguated entries
- [ ] Unique codenames only have disambiguated entry (no generic)
- [ ] Characters from alternate universes include universe designation with colon (e.g., "Spider-Man (Peter Parker: Marvel Universe 6160)")
- [ ] Primary universe characters (Marvel 616, DC Universe) have NO universe label
- [ ] Volume number (v##) comes BEFORE collection name in name field
- [ ] Season number auto-generated when series has multiple iterations
- [ ] Publisher-specific terms disambiguated
- [ ] Organizations/teams listed as characters when narrative roles
- [ ] Include collects field when collection information is available
- [ ] Include info_url when available for cross-referencing and source verification
- [ ] Do NOT use format: Digital (all files are digital - only use for physical binding types)
- [ ] If X-Men franchise during Krakoa era (2019-2024), add tag: Krakoa era
- [ ] If comics event, add tag: comics event
- [ ] If ai:rating ≥ 4.5, add tag: Eivu's AI Masterwork Collection
- [ ] If ai:rating is used, ai:reasoning is included with specific justification
- [ ] No top-level `rating` field used (use `ai:rating` in metadata_list instead)
- [ ] Franchise uses property name (Batman, Avengers) not publisher (DC Comics, Marvel Comics)
- [ ] Universe follows naming conventions with iteration labels (e.g., Marvel Universe 6160 (Ultimate v2))
- [ ] Volume numbers verified against authoritative sources (not just filename)
- [ ] If no issue number in filename, determine if collection or one-shot and research accordingly

## Namespace Usage Guide

| Namespace    | Use Case                                                        |
| ------------ | --------------------------------------------------------------- |
| (none)       | General metadata: tags, performers, genres, isbn, pages, format |
| `id3:*`      | Audio file ID3 tags                                             |
| `eivu:*`     | Audio-specific eivu processing                                  |
| `ai:*`       | AI-assessed metadata (e.g., quality ratings)                    |
| `override:*` | Force override auto-detected values                             |
| `acoustid:*` | Audio fingerprinting (rarely manual)                            |

## YAML Syntax Requirements

- **Indentation**: 2 spaces (NEVER tabs)
- **List items**: Start with `- ` (dash + space)
- **Strings**: Quote if special characters/colons, otherwise plain
- **URLs**: Can be plain or quoted
- **MD5**: Exactly 32 uppercase hex characters (0-9, A-F)

## Example Files

### Comic Book

```yaml
name: Avengers S04 v01 - The Complete Collection
year: 2018
description: |
  The complete collection of Brian Michael Bendis's acclaimed Avengers run.

  This volume collects issues #1-6 of the 4th season (2010-2013).
info_url: https://marvel.com/comics/collection/...
metadata_list:
  - writer: Brian Michael Bendis
  - penciler: John Romita Jr.
  - inker: Klaus Janson
  - colorist: Dean White
  - letterer: Cory Petit
  - cover_artist: John Romita Jr.
  - publisher: Marvel Comics
  - format: Trade Paperback
  - pages: 144
  - isbn: 9781302907730
  - character: Iron Man (Tony Stark)
  - character: Iron Man
  - character: Captain America (Steve Rogers)
  - character: Captain America
  - character: Thor (Thor Odinson)
  - character: Thor
  - character: Spider-Man (Peter Parker)
  - character: Spider-Man
  - character: Spider-Woman (Jessica Drew)
  - character: Spider-Woman
  - character: Avengers
  - character: Illuminati
  - genre: Superhero
  - genre: Action
  - tag: avengers
  - tag: marvel
  - tag: Eivu's AI Masterwork Collection
  - ai:rating: 5
  - franchise: Avengers
  - universe: Marvel Universe 616
```

### Movie

```yaml
name: The Matrix
year: 1999
duration: 8160
description: |
  A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.

  Neo is offered a choice between the red pill and the blue pill.
info_url: https://www.imdb.com/title/tt0133093/
metadata_list:
  - director: Lana Wachowski
  - director: Lilly Wachowski
  - writer: Lana Wachowski
  - writer: Lilly Wachowski
  - performer: Keanu Reeves
  - performer: Laurence Fishburne
  - performer: Carrie-Anne Moss
  - studio: Warner Bros.
  - genre: Sci-Fi
  - genre: Action
  - character: Neo
  - character: Morpheus
  - character: Trinity
  - tag: cyberpunk
  - tag: dystopian
  - tag: Eivu's AI Masterwork Collection
  - ai:rating: 5
  - franchise: The Matrix
```

### Music Track

```yaml
name: Bohemian Rhapsody
year: 1975
duration: 354
description: |
  Epic rock song by Queen from the album A Night at the Opera.
metadata_list:
  - id3:album: A Night at the Opera
  - id3:artist: Queen
  - id3:track_nr: 11
  - id3:disc_nr: 1
  - id3:genre: Rock
  - eivu:artist_name: Queen
  - eivu:release_name: A Night at the Opera
  - eivu:release_pos: 11
  - tag: rock
  - tag: progressive rock
  - tag: opera
  - tag: Eivu's AI Masterwork Collection
  - ai:rating: 5
  - composer: Freddie Mercury
```

### Minimal File

```yaml
year: 2025
```

## Validation Checklist

Before generating output, verify:

- [ ] YAML syntax valid (2-space indentation, no tabs)
- [ ] Numbers unquoted (`year: 2023` not `year: "2023"`)
- [ ] Multi-line descriptions use `|`
- [ ] metadata_list items are single-key objects
- [ ] URLs complete and valid (http/https)
- [ ] MD5 hashes 32 chars, uppercase hex
- [ ] No empty/null values (omit instead)
- [ ] Keys use underscores
- [ ] Keys can repeat in metadata_list
- [ ] No AI instructions in description
- [ ] isbn, pages, format have NO namespace prefix
- [ ] Organizations as characters when narrative roles
- [ ] Superhero identities disambiguated (for comics)
- [ ] Generic character names included alongside disambiguated ones
- [ ] Shared mantles like Thor, Captain America, Spider-Man properly disambiguated
- [ ] Teams listed as characters (Avengers, X-Men, Eternals, etc.)
- [ ] Use `ai:rating` in metadata_list, NOT top-level `rating` field
- [ ] If ai:rating is used, ai:reasoning is included with specific evidence
- [ ] If ai:rating ≥ 4.5, include tag: Eivu's AI Masterwork Collection

## AI Workflow

When creating EIVU metadata:

1. **Consult this skill file** - Don't rely on memory
2. **Search for information** if needed (remove EIVU season notation like "S04" from searches - it's internal EIVU terminology)
3. **For comics**: AUTOMATICALLY disambiguate characters in FIRST draft
4. **For character disambiguation**: Only include generic codename if multiple characters share it (e.g., Spider-Man, Captain America). Skip generic for unique codenames (e.g., Pyro, Havok).
5. **For name field**: Volume number (v##) must come BEFORE collection name (e.g., "v02 - Know Your Enemy" not "Know Your Enemy v02")
6. **For franchise field**: Use specific property names (Batman, Avengers) NOT publisher names (DC Comics, Marvel Comics)
7. **For universe field**: Follow conventions (Marvel Universe 616, DC Universe, DC Absolute Universe)
8. **Verify volume numbers**: Check authoritative sources; filenames may be incorrect
9. **Follow specification exactly**
10. **Apply validation checklist**
11. **Save to /mnt/user-data/outputs** with correct filename

## Common Errors to Avoid

| Error                                               | Impact                      | Fix                                                                                            |
| --------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| Quoting numbers                                     | Type mismatch               | Remove quotes                                                                                  |
| Multiple keys per item                              | Parser error                | Split into separate items                                                                      |
| Using null values                                   | Clutters data               | Omit field entirely                                                                            |
| Wrong indentation                                   | YAML invalid                | Use exactly 2 spaces                                                                           |
| Missing pipe in description                         | Formatting broken           | Use `\|` for multi-line                                                                        |
| AI instructions in description                      | Metadata pollution          | Only content info                                                                              |
| Using `eivu:format`, `eivu:isbn`                    | Wrong namespace             | Use plain keys                                                                                 |
| Generic character names (comics)                    | Ambiguity                   | Add civilian name in parens                                                                    |
| Using top-level `rating` field                      | Wrong location              | Use `ai:rating` in metadata_list                                                               |
| Missing generic character                           | Limits discoverability      | Add both generic and specific (only for shared codenames)                                      |
| Generic for unique codename                         | Unnecessary duplication     | Only disambiguated version needed for unique names                                             |
| Volume after collection name                        | Wrong sort order            | Put v## before collection name (e.g., "v02 - Know Your Enemy")                                 |
| ai:rating ≥ 4.5 without Masterwork tag              | Incomplete metadata         | Add "Eivu's AI Masterwork Collection" tag                                                      |
| ai:rating without ai:reasoning                      | Missing justification       | Always include ai:reasoning with specific evidence (awards, acclaim, impact)                   |
| Publisher as franchise                              | Incorrect categorization    | Use property name (Batman, Avengers) not publisher (DC Comics, Marvel Comics)                  |
| Wrong universe naming                               | Inconsistent tagging        | Marvel Universe 616, DC Universe, DC Absolute Universe                                         |
| Missing universe iteration label                    | Incomplete designation      | Include iteration (e.g., "Marvel Universe 6160 (Ultimate v2)")                                 |
| Alternate universe character without universe label | Ambiguous identity          | Add universe designation with colon (e.g., "Spider-Man (Peter Parker: Marvel Universe 6160)")  |
| Primary universe character with universe label      | Unnecessary verbosity       | Omit universe for Marvel 616 and DC Universe characters                                        |
| Missing collects field for collections              | Incomplete metadata         | Include collects field when information is available                                           |
| Missing info_url                                    | Harder to verify sources    | Include official publisher URL when available for cross-referencing                            |
| Using format: Digital                               | Redundant information       | Omit - all files are digital; only use for physical binding types                              |
| Missing Krakoa era tag                              | Incomplete categorization   | Add tag: Krakoa era for X-Men franchise comics from 2019-2024                                  |
| Missing comics event tag                            | Incomplete categorization   | Add tag: comics event for crossover events like Spider-Verse, Judgment Day                     |
| Missing team character entries                      | Incomplete character roster | Teams like Avengers, X-Men, Eternals should be listed as characters in addition to individuals |
| Trusting filename volume numbers                    | May be incorrect            | Always verify against authoritative sources                                                    |
| Assuming single issues when no number               | May be collection           | Research to determine if collection/one-shot and include proper metadata                       |

## Processing Notes

The eivu system will:

1. Merge YAML metadata with auto-extracted data
2. Give YAML priority over auto-extracted
3. Remove duplicate metadata pairs
4. Filter null/empty values
5. Validate YAML format

## Tips for Success

- **Research thoroughly**: Search for accurate metadata
- **Be comprehensive**: Include all relevant metadata
- **Stay organized**: Group similar metadata together
- **Validate syntax**: Double-check YAML structure
- **Test examples**: Use provided examples as templates
- **For comics**: Always disambiguate from the start
- **Be concise**: Omit unnecessary fields
- **User preferences**: Learn and apply user's specific needs

## Conclusion

This skill enables high-quality EIVU metadata generation. Follow the rules precisely, validate thoroughly, and produce clean, well-structured YAML files that the eivu system can process correctly.
