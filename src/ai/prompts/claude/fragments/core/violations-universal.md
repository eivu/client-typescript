| # | Scope | Rule | ❌ Wrong | ✅ Right |
|---|-------|------|---------|---------|
| 7 | ⚙️ | ai:rating >= 4.0 → Masterwork tag required | rating without tag | + `tag: Eivu's AI Masterwork Collection` |
| 8 | 🔵 | ai:rating → ai:rating_reasoning required | rating alone | rating + reasoning citing specific evidence |
| 9 | 🔵 | Award tag present → evaluate ai:rating | apply tag and move on | does this merit a rating? evaluate it |
| 10 | 🔵 | Always generate ai:rating — do not omit | skip rating if no award | generate a rating for every item with any reception data |
| 12 | ⚙️ | Numbers never quoted | `year: "2023"` | `year: 2023` |
| 13 | 🔵 | No top-level `rating` field (deprecated) | `rating: 4` at top level | `ai:rating: 4.0` inside metadata_list |
| 17 | ⚙️ | No `format: Digital` | `format: Digital` | omit format field entirely for digital files |
| 18 | 🔵 | Description = content only — no SEO/search hints | "Features Batman and Joker" | story/content summary only |
| 19 | ⚙️ | `ai:skill_version` required on every file | omit | `ai:skill_version: 7.16.4` |
| 20 | 🔵 | `ai:engine` required on every file — use YOUR OWN model name | omit or hardcode a different model | `ai:engine: claude-sonnet-4-6` (Sonnet), `ai:engine: claude-opus-4-6` (Opus), `ai:engine: claude-haiku-4-5-20251001` (Haiku) |
| 22 | ⚙️ | All sequential numbers zero-padded to 2+ digits | `S1 E9` or `v2` | `S01 E09` or `v02` |
| 23 | 🔵 | `duration` in integer seconds, not minutes | `duration: 22` | `duration: 1320` |
| 24 | ⚙️ | genre values are Title Case | `genre: science fiction` | `genre: Science Fiction` |
| 27 | ⚙️ | Winner award tags always accompanied by nominee tags | `Eisner Award Winner 2020` alone | + `Eisner Award Nominee` + `Eisner Award Nominee 2020` |
| 34 | ⚙️ | `ai:cost`, `ai:cost_all`, `ai:tokens_in`, `ai:tokens_out` are POST-PROCESSOR-ONLY | model emits its own values | DO NOT emit these fields; the post-processor injects them with the real billing/usage data |

**Scope key:** 📗 = Comics only · 🎵 = Audio only · 🎬 = Video only · 🎵🎬 = Audio + Video · 🔵 = All media types · ⚙️ = Enforced by post-processor (follow convention but do not spend time verifying)
