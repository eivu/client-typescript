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
| 11 | 📗 | Franchise = property name, never publisher | `franchise: DC Comics` | `franchise: Batman` |
| 14 | 📗 | Name separator is ` - ` (space-dash-space) | `S04v02 Title` | `S04 v02 - Title` |
| 15 | 📗 | S## from mapping table — never from filename | trust filename S## | look up in authoritative source |
| 16 | 📗 | Eisner series tags: only within recognized creative run | apply to all volumes | only volumes inside award-winning run |
| 21 | 📗 | Spin-off title brands are separate franchises with own S## | Invincible Iron Man as Iron Man S04 | `franchise: Invincible Iron Man`, S01 |
| 25 | 📗 | Wolverine in Marvel 616 uses Logan | `Wolverine (James Howlett)` | `Wolverine (Logan)` |
| 26 | 📗 | `collects` field required for all TPBs and collections | omit on a TPB | `collects: "Series (Year) #1-6"` |
| 28 | 📗 | Non-primary universe characters need plain civilian/character name entry | `Batman (Bruce Wayne: Earth-19)` + `Batman` only | + `Bruce Wayne` · `Shuri (Marvel Universe 6160)` → + `Shuri` |
| 28a | 📗 | Non-primary universe characters with codenames need universe-scoped person-level identifier | `Maker (Reed Richards: Marvel Universe 1610)` + `Reed Richards` only | + `Reed Richards (Marvel Universe 1610)` |
