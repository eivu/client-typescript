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
  - ai:skill_version: 7.16.4
  - ai:engine: <YOUR-MODEL-NAME>  # self-report: e.g. claude-sonnet-4-6, claude-opus-4-6
  - tag: Eivu's AI Masterwork Collection  # only if ai:rating >= 4.0
```

### Audio-Only Notes 🎵

> **Skip for comics and video.**

- `artists` is a top-level array (NOT in metadata_list)
- `release` is a top-level object (NOT in metadata_list) — replaces `- album:` in metadata_list
- ID3-mappable fields in metadata_list use `id3:` prefix: `id3:genre`, `id3:producer`, `id3:label`
- Non-ID3 fields (`tag`, `ai:*`) remain unprefixed
- Ignore `artwork_md5` in `release` — do not attempt to generate

## §A — NAME FIELD

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
