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
const FRANCHISE_PARENTS: Record<string, string[]> = {
  // ── Marvel: X-Men family ──────────────────────────────────────────────
  'x-factor': ['X-Men'],
  'x-factor investigations': ['X-Men'],
  'x-force': ['X-Men'],
  'x-statix': ['X-Men'],
  'new mutants': ['X-Men'],
  excalibur: ['X-Men'],
  'generation x': ['X-Men'],
  wolverine: ['X-Men'],
  cable: ['X-Men'],
  deadpool: ['X-Men'],
  gambit: ['X-Men'],
  rogue: ['X-Men'],
  storm: ['X-Men'],
  iceman: ['X-Men'],
  nightcrawler: ['X-Men'],
  bishop: ['X-Men'],
  psylocke: ['X-Men'],
  'multiple man': ['X-Men'],
  madrox: ['X-Men'],
  magneto: ['X-Men'],
  mystique: ['X-Men'],
  sabretooth: ['X-Men'],
  'x-23': ['X-Men'],
  legion: ['X-Men'],
  hellions: ['X-Men'],
  marauders: ['X-Men'],
  'fallen angels': ['X-Men'],
  'new x-men': ['X-Men'],
  'astonishing x-men': ['X-Men'],
  'uncanny x-men': ['X-Men'],
  'all-new x-men': ['X-Men'],
  'extraordinary x-men': ['X-Men'],
  'amazing x-men': ['X-Men'],
  'x-men: legacy': ['X-Men'],
  'x-men legacy': ['X-Men'],

  // ── Marvel: Avengers family ───────────────────────────────────────────
  'west coast avengers': ['Avengers'],
  'new avengers': ['Avengers'],
  'mighty avengers': ['Avengers'],
  'secret avengers': ['Avengers'],
  'uncanny avengers': ['Avengers'],
  'avengers academy': ['Avengers'],
  'avengers arena': ['Avengers'],
  'avengers undercover': ['Avengers'],
  'young avengers': ['Avengers'],
  'dark avengers': ['Avengers'],
  'avengers world': ['Avengers'],
  'a-force': ['Avengers'],

  // ── Marvel: Spider-Man family ─────────────────────────────────────────
  'spider-woman': ['Spider-Man'],
  'spider-gwen': ['Spider-Man'],
  'miles morales: spider-man': ['Spider-Man'],
  silk: ['Spider-Man'],
  'spider-man 2099': ['Spider-Man'],
  'scarlet spider': ['Spider-Man'],
  venom: ['Spider-Man'],
  carnage: ['Spider-Man'],
  'symbiote spider-man': ['Spider-Man'],
  'amazing spider-man': ['Spider-Man'],
  'spectacular spider-man': ['Spider-Man'],
  'sensational spider-man': ['Spider-Man'],
  'superior spider-man': ['Spider-Man'],
  'friendly neighborhood spider-man': ['Spider-Man'],
  'web of spider-man': ['Spider-Man'],
  'spider-verse': ['Spider-Man'],
  'spider-man/deadpool': ['Spider-Man', 'Deadpool'],

  // ── Marvel: Iron Man family ───────────────────────────────────────────
  'invincible iron man': ['Iron Man'],
  'iron man': ['Avengers'], // Iron Man is a top-level franchise, but also rolls up to Avengers
  'war machine': ['Iron Man'],
  rescue: ['Iron Man'],
  ironheart: ['Iron Man'],

  // ── Marvel: Captain America family ────────────────────────────────────
  'captain america': ['Avengers'],
  falcon: ['Captain America'],
  'winter soldier': ['Captain America'],
  'sam wilson: captain america': ['Captain America'],

  // ── Marvel: Thor family ───────────────────────────────────────────────
  thor: ['Avengers'],
  'mighty thor': ['Thor'],
  'unworthy thor': ['Thor'],
  'jane foster': ['Thor'],
  loki: ['Thor'],
  'beta ray bill': ['Thor'],

  // ── Marvel: Hulk family ───────────────────────────────────────────────
  hulk: ['Avengers'],
  'incredible hulk': ['Hulk'],
  'immortal hulk': ['Hulk'],
  'she-hulk': ['Hulk'],
  'totally awesome hulk': ['Hulk'],
  'amadeus cho': ['Hulk'],
  'red hulk': ['Hulk'],

  // ── Marvel: Fantastic Four family ─────────────────────────────────────
  'silver surfer': ['Fantastic Four'],
  thing: ['Fantastic Four'],
  'human torch': ['Fantastic Four'],
  'future foundation': ['Fantastic Four'],
  'doctor doom': ['Fantastic Four'],

  // ── Marvel: Guardians family ──────────────────────────────────────────
  'rocket raccoon': ['Guardians of the Galaxy'],
  groot: ['Guardians of the Galaxy'],
  'star-lord': ['Guardians of the Galaxy'],
  gamora: ['Guardians of the Galaxy'],
  drax: ['Guardians of the Galaxy'],
  nova: ['Guardians of the Galaxy'],

  // ── Marvel: Daredevil family ──────────────────────────────────────────
  elektra: ['Daredevil'],
  punisher: ['Daredevil'],

  // ── Marvel: Black Panther family ──────────────────────────────────────
  shuri: ['Black Panther'],

  // ── Marvel: Doctor Strange family ─────────────────────────────────────
  'doctor strange': ['Avengers'],

  // ── Marvel: Defenders family ──────────────────────────────────────────
  defenders: ['Avengers'],

  // ── Marvel: Inhumans family ───────────────────────────────────────────
  'ms. marvel': ['Inhumans'],
  'moon girl': ['Inhumans'],
  'black bolt': ['Inhumans'],
  royals: ['Inhumans'],

  // ── Marvel: Crossover / Multi-franchise ───────────────────────────────
  'deadpool & wolverine': ['Deadpool', 'Wolverine'],
  'cable & deadpool': ['Cable', 'Deadpool'],
  'power pack': ['Fantastic Four'],

  // ── DC: Batman family ─────────────────────────────────────────────────
  'detective comics': ['Batman'],
  nightwing: ['Batman'],
  robin: ['Batman'],
  batgirl: ['Batman'],
  batwoman: ['Batman'],
  'red hood': ['Batman'],
  'red hood and the outlaws': ['Batman'],
  'batman and robin': ['Batman'],
  'batman beyond': ['Batman'],
  'batman: gotham by gaslight': ['Batman'],
  'gotham academy': ['Batman'],
  catwoman: ['Batman'],
  'harley quinn': ['Batman'],
  'birds of prey': ['Batman'],
  'gotham city sirens': ['Batman'],
  batwing: ['Batman'],
  'batman/superman': ['Batman', 'Superman'],
  'batman: the brave and the bold': ['Batman'],
  'batman incorporated': ['Batman'],
  'batman: the dark knight': ['Batman'],
  'shadow of the bat': ['Batman'],
  'legends of the dark knight': ['Batman'],

  // ── DC: Superman family ───────────────────────────────────────────────
  'action comics': ['Superman'],
  supergirl: ['Superman'],
  superboy: ['Superman'],
  'superman/batman': ['Superman', 'Batman'],
  'superman: son of kal-el': ['Superman'],
  steel: ['Superman'],

  // ── DC: Wonder Woman family ───────────────────────────────────────────
  'absolute wonder woman': ['Wonder Woman'],
  'wonder girl': ['Wonder Woman'],
  nubia: ['Wonder Woman'],

  // ── DC: Green Lantern family ──────────────────────────────────────────
  'green lantern corps': ['Green Lantern'],
  'green lanterns': ['Green Lantern'],
  'hal jordan and the green lantern corps': ['Green Lantern'],
  'red lanterns': ['Green Lantern'],
  sinestro: ['Green Lantern'],
  'new guardians': ['Green Lantern'],
  'far sector': ['Green Lantern'],

  // ── DC: Flash family ──────────────────────────────────────────────────
  flash: ['Justice League'],
  'speed force': ['Flash'],

  // ── DC: Justice League family ─────────────────────────────────────────
  'justice league dark': ['Justice League'],
  'justice league of america': ['Justice League'],
  'justice league international': ['Justice League'],
  'justice league europe': ['Justice League'],
  'justice society of america': ['Justice League'],
  jsa: ['Justice Society of America'],
  stargirl: ['Justice Society of America'],

  // ── DC: Justice League constituent franchises ─────────────────────────
  aquaman: ['Justice League'],
  'green arrow': ['Justice League'],
  'black canary': ['Justice League'],
  hawkman: ['Justice League'],
  hawkgirl: ['Justice League'],
  'martian manhunter': ['Justice League'],
  atom: ['Justice League'],
  firestorm: ['Justice League'],
  zatanna: ['Justice League'],
  constantine: ['Justice League Dark'],

  // ── DC: Teen Titans family ────────────────────────────────────────────
  'teen titans': ['Justice League'],
  titans: ['Teen Titans'],
  'young justice': ['Teen Titans'],

  // ── DC: Suicide Squad family ──────────────────────────────────────────
  'suicide squad': ['Justice League'],
  deadshot: ['Suicide Squad'],

  // ── DC: Doctor Fate family ────────────────────────────────────────────
  'doctor fate': ['Justice Society of America'],

  // ── DC: Swamp Thing family ────────────────────────────────────────────
  'swamp thing': ['Justice League Dark'],

  // ── DC: Vertigo/mature imprints ───────────────────────────────────────
  sandman: ['Vertigo'],
  lucifer: ['Sandman'],
  'dead boy detectives': ['Sandman'],
  'sandman mystery theatre': ['Sandman'],
  'books of magic': ['Vertigo'],
  hellblazer: ['Constantine'],
  fables: ['Vertigo'],
  'jack of fables': ['Fables'],

  // ── DC: WildStorm family ──────────────────────────────────────────────
  'the wild storm': ['WildStorm'],
  wildcats: ['WildStorm'],
  'the authority': ['WildStorm'],
  planetary: ['WildStorm'],
  stormwatch: ['WildStorm'],
  gen13: ['WildStorm'],
  grifter: ['WildStorm'],
  midnighter: ['WildStorm'],
  deathblow: ['WildStorm'],

  // ── Image Comics family ───────────────────────────────────────────────
  spawn: ['Image'],
  invincible: ['Image'],
  'savage dragon': ['Image'],
  witchblade: ['Image'],
  'the darkness': ['Image'],
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

  // Collect existing franchises and track the last franchise line index
  const existingFranchises = new Set<string>()
  let lastFranchiseLineIndex = -1

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)- franchise:\s*(.+)$/)
    if (match) {
      existingFranchises.add(match[2].trim())
      lastFranchiseLineIndex = i
    }
  }

  if (lastFranchiseLineIndex === -1) return yaml // no franchises at all

  // Determine indent from existing franchise line
  const indentMatch = lines[lastFranchiseLineIndex].match(/^(\s*)/)
  const indent = indentMatch ? indentMatch[1] : '  '

  // Resolve all missing parents
  const toAdd: string[] = []
  for (const franchise of existingFranchises) {
    const parents = resolveParentFranchises(franchise)
    for (const parent of parents) {
      if (!existingFranchises.has(parent) && !toAdd.includes(parent)) {
        toAdd.push(parent)
      }
    }
  }

  if (toAdd.length === 0) return yaml

  // Insert new franchise lines after the last existing franchise line
  const newLines = toAdd.map((f) => `${indent}- franchise: ${f}`)
  lines.splice(lastFranchiseLineIndex + 1, 0, ...newLines)

  return lines.join('\n')
}
