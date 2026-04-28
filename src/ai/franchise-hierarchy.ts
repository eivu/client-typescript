/**
 * Franchise hierarchy — maps child franchises to their parent franchise(s).
 *
 * Used by postProcess to automatically add missing parent franchise entries.
 * For example, if a file has `franchise: Madrox` but is missing `franchise: X-Men`,
 * the post-processor adds the parent.
 *
 * Rules:
 *   - Keys are LOWERCASE for case-insensitive matching.
 *   - Values are the EXACT franchise names to insert (preserving canonical casing).
 *   - A child may have multiple parents (e.g. Deadpool & Wolverine → both franchises).
 *   - Parents are NOT recursively resolved here — the lookup function handles that.
 *   - Spin-off title brands (Invincible Iron Man, Absolute Wonder Woman) that the
 *     runtime treats as separate franchises still roll up to the parent property.
 */
const XMEN_FRANCHISE: Record<string, string[]> = {
  'all-new x-men': ['X-Men'],
  'amazing x-men': ['X-Men'],
  'astonishing x-men': ['X-Men'],
  bishop: ['X-Men'],
  cable: ['X-Men'],
  deadpool: ['X-Men'],
  excalibur: ['X-Men'],
  'extraordinary x-men': ['X-Men'],
  'fallen angels': ['X-Men'],
  gambit: ['X-Men'],
  'generation x': ['X-Men'],
  hellions: ['X-Men'],
  iceman: ['X-Men'],
  legion: ['X-Men'],
  madrox: ['X-Men'],
  magneto: ['X-Men'],
  marauders: ['X-Men'],
  'multiple man': ['X-Men'],
  mystique: ['X-Men'],
  'new mutants': ['X-Men'],
  'new x-men': ['X-Men'],
  nightcrawler: ['X-Men'],
  psylocke: ['X-Men'],
  rogue: ['X-Men'],
  sabretooth: ['X-Men'],
  storm: ['X-Men'],
  'uncanny x-men': ['X-Men'],
  wolverine: ['X-Men'],
  'x-23': ['X-Men'],
  'x-factor': ['X-Men'],
  'x-factor investigations': ['X-Men'],
  'x-force': ['X-Men'],
  'x-men: legacy': ['X-Men'],
  'x-men legacy': ['X-Men'],
  'x-statix': ['X-Men'],
}

const AVENGERS_FRANCHISE: Record<string, string[]> = {
  'a-force': ['Avengers'],
  'avengers academy': ['Avengers'],
  'avengers arena': ['Avengers'],
  'avengers undercover': ['Avengers'],
  'avengers world': ['Avengers'],
  'dark avengers': ['Avengers'],
  'mighty avengers': ['Avengers'],
  'new avengers': ['Avengers'],
  'secret avengers': ['Avengers'],
  'uncanny avengers': ['Avengers'],
  'west coast avengers': ['Avengers'],
  'young avengers': ['Avengers'],
}

const SPIDER_MAN_FRANCHISE: Record<string, string[]> = {
  'amazing spider-man': ['Spider-Man'],
  carnage: ['Spider-Man'],
  'friendly neighborhood spider-man': ['Spider-Man'],
  'miles morales: spider-man': ['Spider-Man'],
  'scarlet spider': ['Spider-Man'],
  'sensational spider-man': ['Spider-Man'],
  silk: ['Spider-Man'],
  'spectacular spider-man': ['Spider-Man'],
  'spider-gwen': ['Spider-Man'],
  'spider-man 2099': ['Spider-Man'],
  'spider-man/deadpool': ['Spider-Man', 'Deadpool'],
  'spider-verse': ['Spider-Man'],
  'spider-woman': ['Spider-Man'],
  'superior spider-man': ['Spider-Man'],
  'symbiote spider-man': ['Spider-Man'],
  venom: ['Spider-Man'],
  'web of spider-man': ['Spider-Man'],
}

const IRON_MAN_FRANCHISE: Record<string, string[]> = {
  'invincible iron man': ['Iron Man'],
  ironheart: ['Iron Man'],
  'iron man': ['Avengers'], // Iron Man is a top-level franchise, but also rolls up to Avengers
  rescue: ['Iron Man'],
  'war machine': ['Iron Man'],
}

const CAPTAIN_AMERICA_FRANCHISE: Record<string, string[]> = {
  'captain america': ['Avengers'],
  falcon: ['Captain America'],
  'sam wilson: captain america': ['Captain America'],
  'winter soldier': ['Captain America'],
}

const THOR_FRANCHISE: Record<string, string[]> = {
  'beta ray bill': ['Thor'],
  'jane foster': ['Thor'],
  loki: ['Thor'],
  'mighty thor': ['Thor'],
  thor: ['Avengers'],
  'unworthy thor': ['Thor'],
}

const HULK_FRANCHISE: Record<string, string[]> = {
  'amadeus cho': ['Hulk'],
  hulk: ['Avengers'],
  'immortal hulk': ['Hulk'],
  'incredible hulk': ['Hulk'],
  'red hulk': ['Hulk'],
  'she-hulk': ['Hulk'],
  'totally awesome hulk': ['Hulk'],
}

const FANTASTIC_FOUR_FRANCHISE: Record<string, string[]> = {
  'doctor doom': ['Fantastic Four'],
  'future foundation': ['Fantastic Four'],
  'human torch': ['Fantastic Four'],
  'silver surfer': ['Fantastic Four'],
  thing: ['Fantastic Four'],
}

const GUARDIANS_OF_THE_GALAXY_FRANCHISE: Record<string, string[]> = {
  drax: ['Guardians of the Galaxy'],
  gamora: ['Guardians of the Galaxy'],
  groot: ['Guardians of the Galaxy'],
  nova: ['Guardians of the Galaxy'],
  'rocket raccoon': ['Guardians of the Galaxy'],
  'star-lord': ['Guardians of the Galaxy'],
}

const DAREDEVIL_FRANCHISE: Record<string, string[]> = {
  elektra: ['Daredevil'],
  punisher: ['Daredevil'],
}

const BLACK_PANTHER_FRANCHISE: Record<string, string[]> = {
  'black panther and the crew': ['Black Panther'],
  shuri: ['Black Panther'],
  'the crew': ['Black Panther'],
  'world of wakanda': ['Black Panther'],
}

const DOCTOR_STRANGE_FRANCHISE: Record<string, string[]> = {
  'doctor strange': ['Avengers'],
}

const DEFENDERS_FRANCHISE: Record<string, string[]> = {
  defenders: ['Avengers'],
}

const INHUMANS_FRANCHISE: Record<string, string[]> = {
  'black bolt': ['Inhumans'],
  karnak: ['Inhumans'],
  'moon girl': ['Inhumans'],
  'ms. marvel': ['Inhumans'],
  royals: ['Inhumans'],
}

const CROSSOVER_FRANCHISE: Record<string, string[]> = {
  'cable & deadpool': ['Cable', 'Deadpool'],
  // ── Marvel: Crossover / Multi-franchise ───────────────────────────────
  'deadpool & wolverine': ['Deadpool', 'Wolverine'],
  'power pack': ['Fantastic Four'],
}

const BATMAN_FRANCHISE: Record<string, string[]> = {
  batgirl: ['Batman'],
  'batman/superman': ['Batman', 'Superman'],
  'batman: gotham by gaslight': ['Batman'],
  'batman: the brave and the bold': ['Batman'],
  'batman: the dark knight': ['Batman'],
  'batman and robin': ['Batman'],
  'batman beyond': ['Batman'],
  'batman incorporated': ['Batman'],
  batwing: ['Batman'],
  batwoman: ['Batman'],
  'birds of prey': ['Batman'],
  catwoman: ['Batman'],
  // ── DC: Batman family ─────────────────────────────────────────────────
  'detective comics': ['Batman'],
  'gotham academy': ['Batman'],
  'gotham city sirens': ['Batman'],
  'harley quinn': ['Batman'],
  'legends of the dark knight': ['Batman'],
  nightwing: ['Batman'],
  'red hood': ['Batman'],
  'red hood and the outlaws': ['Batman'],
  robin: ['Batman'],
  'shadow of the bat': ['Batman'],
}

const SUPERMAN_FRANCHISE: Record<string, string[]> = {
  // ── DC: Superman family ───────────────────────────────────────────────
  'action comics': ['Superman'],
  steel: ['Superman'],
  superboy: ['Superman'],
  supergirl: ['Superman'],
  'superman/batman': ['Superman', 'Batman'],
  'superman: son of kal-el': ['Superman'],
}

const WONDER_WOMAN_FRANCHISE: Record<string, string[]> = {
  // ── DC: Wonder Woman family ───────────────────────────────────────────
  'absolute wonder woman': ['Wonder Woman'],
  nubia: ['Wonder Woman'],
  'wonder girl': ['Wonder Woman'],
}

const GREEN_LANTERN_FRANCHISE: Record<string, string[]> = {
  'far sector': ['Green Lantern'],
  // ── DC: Green Lantern family ──────────────────────────────────────────
  'green lantern corps': ['Green Lantern'],
  'green lanterns': ['Green Lantern'],
  'hal jordan and the green lantern corps': ['Green Lantern'],
  'new guardians': ['Green Lantern'],
  'red lanterns': ['Green Lantern'],
  sinestro: ['Green Lantern'],
}

const FLASH_FRANCHISE: Record<string, string[]> = {
  // ── DC: Flash family ──────────────────────────────────────────────────
  flash: ['Justice League'],
  'speed force': ['Flash'],
}

const JUSTICE_LEAGUE_FRANCHISE: Record<string, string[]> = {
  // ── DC: Justice League family ─────────────────────────────────────────
  'justice league dark': ['Justice League'],
  'justice league europe': ['Justice League'],
  'justice league international': ['Justice League'],
  'justice league of america': ['Justice League'],
}

const JUSTICE_LEAGUE_CONSTITUENT_FRANCHISES: Record<string, string[]> = {
  // ── DC: Justice League constituent franchises ─────────────────────────
  aquaman: ['Justice League'],
  atom: ['Justice League'],
  'black canary': ['Justice League'],
  constantine: ['Justice League Dark'],
  firestorm: ['Justice League'],
  'green arrow': ['Justice League'],
  hawkgirl: ['Justice League'],
  hawkman: ['Justice League'],
  'martian manhunter': ['Justice League'],
  zatanna: ['Justice League'],
}

const TEEN_TITANS_FRANCHISE: Record<string, string[]> = {
  titans: ['Teen Titans'],
  'young justice': ['Teen Titans'],
}

const SUICIDE_SQUAD_FRANCHISE: Record<string, string[]> = {
  // ── DC: Suicide Squad family ──────────────────────────────────────────
  deadshot: ['Suicide Squad'],
}

const JUSTICE_SOCIETY_OF_AMERICA_FRANCHISE: Record<string, string[]> = {
  'doctor fate': ['Justice Society of America'],
  jsa: ['Justice Society of America'],
  'mr terrific': ['Justice Society of America'],
  stargirl: ['Justice Society of America'],
  starman: ['Justice Society of America'],
}

const SWAMP_THING_FRANCHISE: Record<string, string[]> = {
  'swamp thing': ['Justice League Dark'],
}

const VERTIGO_FRANCHISE: Record<string, string[]> = {
  'books of magic': ['Vertigo'],
  'dead boy detectives': ['Vertigo'],
  fables: ['Vertigo'],
  hellblazer: ['Vertigo'],
  'jack of fables': ['Vertigo'],
  lucifer: ['Vertigo'],
  sandman: ['Vertigo'],
  'sandman mystery theatre': ['Vertigo'],
}

const WILDCATS_FRANCHISE: Record<string, string[]> = {
  deathblow: ['WildStorm'],
  gen13: ['WildStorm'],
  grifter: ['WildStorm'],
  midnighter: ['WildStorm'],
  planetary: ['WildStorm'],
  stormwatch: ['WildStorm'],
  'the authority': ['WildStorm'],
  'the wild storm': ['WildStorm'],
  wildcats: ['WildStorm'],
}

const IMAGE_COMICS_FRANCHISE: Record<string, string[]> = {
  invincible: ['Image Comics'],
  'savage dragon': ['Image Comics'],
  spawn: ['Image Comics'],
  'the darkness': ['Image Comics'],
  witchblade: ['Image Comics'],
}

const FRANCHISE_PARENTS: Record<string, string[]> = {
  ...XMEN_FRANCHISE,
  ...AVENGERS_FRANCHISE,
  ...SPIDER_MAN_FRANCHISE,
  ...IRON_MAN_FRANCHISE,
  ...CAPTAIN_AMERICA_FRANCHISE,
  ...THOR_FRANCHISE,
  ...HULK_FRANCHISE,
  ...FANTASTIC_FOUR_FRANCHISE,
  ...GUARDIANS_OF_THE_GALAXY_FRANCHISE,
  ...DAREDEVIL_FRANCHISE,
  ...BLACK_PANTHER_FRANCHISE,
  ...DOCTOR_STRANGE_FRANCHISE,
  ...DEFENDERS_FRANCHISE,
  ...INHUMANS_FRANCHISE,
  ...CROSSOVER_FRANCHISE,
  ...BATMAN_FRANCHISE,
  ...SUPERMAN_FRANCHISE,
  ...WONDER_WOMAN_FRANCHISE,
  ...GREEN_LANTERN_FRANCHISE,
  ...FLASH_FRANCHISE,
  ...JUSTICE_LEAGUE_FRANCHISE,
  ...JUSTICE_LEAGUE_CONSTITUENT_FRANCHISES,
  ...TEEN_TITANS_FRANCHISE,
  ...SUICIDE_SQUAD_FRANCHISE,
  ...JUSTICE_SOCIETY_OF_AMERICA_FRANCHISE,
  ...SWAMP_THING_FRANCHISE,
  ...VERTIGO_FRANCHISE,
  ...WILDCATS_FRANCHISE,
  ...IMAGE_COMICS_FRANCHISE,
}

/**
 * Resolves all ancestor franchises for a given franchise name.
 * Walks the hierarchy recursively, collecting every parent up the chain.
 * Deduplicates and avoids cycles.
 *
 * @param franchise - Franchise name (case-insensitive lookup)
 * @returns Array of parent franchise names (canonical casing), empty if no parents
 */
export function resolveParentFranchises(franchise: string): string[] {
  const parents: string[] = []
  const visited = new Set<string>()

  function walk(name: string): void {
    const key = name.toLowerCase()
    if (visited.has(key)) return
    visited.add(key)

    const directParents = FRANCHISE_PARENTS[key]
    if (!directParents) return

    for (const parent of directParents) {
      if (!visited.has(parent.toLowerCase())) {
        parents.push(parent)
        walk(parent) // recurse for grandparents
      }
    }
  }

  walk(franchise)
  return parents
}

/**
 * Given a full YAML string, finds all `- franchise: X` entries,
 * resolves missing parent franchises, and inserts them after the
 * last existing franchise entry.
 *
 * @param yaml - The full YAML string
 * @returns YAML with missing parent franchises added
 */
export function addMissingParentFranchises(yaml: string): string {
  const lines = yaml.split('\n')

  // Collect existing franchises and track the last franchise line index.
  // existingLower holds lowercased values for case-insensitive dedup checks,
  // since resolveParentFranchises returns canonical-cased names while the YAML
  // may contain non-canonical casing (e.g. `franchise: x-men`).
  const existingFranchises = new Set<string>()
  const existingLower = new Set<string>()
  let lastFranchiseLineIndex = -1

  for (const [i, line] of lines.entries()) {
    const match = line.match(/^(\s*)- franchise:\s*(.+)$/)
    if (match) {
      const value = match[2].trim()
      existingFranchises.add(value)
      existingLower.add(value.toLowerCase())
      lastFranchiseLineIndex = i
    }
  }

  if (lastFranchiseLineIndex === -1) return yaml // no franchises at all

  // Determine indent from existing franchise line
  const indentMatch = lines[lastFranchiseLineIndex].match(/^(\s*)/)
  const indent = indentMatch ? indentMatch[1] : '  '

  // Resolve all missing parents
  const toAdd: string[] = []
  const toAddLower = new Set<string>()
  for (const franchise of existingFranchises) {
    const parents = resolveParentFranchises(franchise)
    for (const parent of parents) {
      if (!existingLower.has(parent.toLowerCase()) && !toAddLower.has(parent.toLowerCase())) {
        toAdd.push(parent)
        toAddLower.add(parent.toLowerCase())
      }
    }
  }

  if (toAdd.length === 0) return yaml

  // Insert new franchise lines after the last existing franchise line
  const newLines = toAdd.map((f) => `${indent}- franchise: ${f}`)
  lines.splice(lastFranchiseLineIndex + 1, 0, ...newLines)

  return lines.join('\n')
}
