## VIOLATIONS — CHECK APPLICABLE ROWS BEFORE OUTPUT

| # | Scope | Rule | ❌ Wrong | ✅ Right |
|---|-------|------|---------|---------|
| 29 | 🎵🎬 | Audio/video files require top-level `artists` array | `- artist: Name` in metadata_list | `artists:\n  - name: Name` at top level |
| 30 | 🎵 | Audio files: ID3-mappable fields use `id3:` prefix in metadata_list | `- genre: R&B` · `- producer: Name` | `- id3:genre: R&B` · `- id3:producer: Name` |
| 31 | 🎵 | Audio files always have `artists`; should have `release` when album is known | omit artists/release | `artists` required; `release` strongly recommended |
| 33 | 🎵 | `release.position` = track number on album (integer) | omit or guess | verify track position from authoritative source |
