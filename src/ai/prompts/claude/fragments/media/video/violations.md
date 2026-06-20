## VIOLATIONS — CHECK APPLICABLE ROWS BEFORE OUTPUT

| # | Scope | Rule | ❌ Wrong | ✅ Right |
|---|-------|------|---------|---------|
| 29 | 🎵🎬 | Audio/video files require top-level `artists` array | `- artist: Name` in metadata_list | `artists:\n  - name: Name` at top level |
| 32 | 🎬 | Video files always have `artists`; `release` optional | omit artists | `artists` required; `release` only if applicable |
