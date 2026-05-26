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
  - ai:skill_version: 7.16.4
  - ai:engine: <YOUR-MODEL-NAME>  # self-report: e.g. claude-sonnet-4-6, claude-opus-4-6
```

### Video-Only Notes 🎬

> **Skip for comics and audio.**

- `artists` is a top-level array (required)
- `release` is a top-level object (optional — use only when video is part of a series or album)
- No `id3:` prefix — video metadata_list fields are unprefixed

## §A — NAME FIELD

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

### Video (non-TV, non-movie) 🎬

> **Skip for comics and audio.**

```
Format: [Title]

Rules:
  Use the video's title as-is (cleaned up for readability)
  No S##/v## numbering unless part of a series
```
