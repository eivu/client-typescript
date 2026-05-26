## FINAL CHECKLIST

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
