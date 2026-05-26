import * as fs from 'node:fs'
import path from 'node:path'

/**
 * Media types the assembler can produce a prompt for. Matches the directory
 * names under `src/ai/prompts/claude/fragments/media/`. Callers translating
 * from `getMediaCategory` (which uses singular `'comic'`) must map `'comic'`
 * → `'comics'`.
 */
export type AssemblerMediaType = 'audio' | 'comics' | 'video'

export type AssembleOptions = {
  /** Override the fragments directory (test-only). Resolved against `process.cwd()` if relative. */
  fragmentsRoot?: string
  mediaType: AssemblerMediaType
}

const DEFAULT_FRAGMENTS_ROOT = path.join('src', 'ai', 'prompts', 'claude', 'fragments')
const SEPARATOR = '\n\n---\n\n'

/**
 * In-memory fragment cache keyed by `${absoluteRoot}::${relPath}`.
 *
 * Phase 1's cache-determinism requirement is that `assemble({mediaType})` returns
 * a byte-identical string across calls. Reading from disk on every call would
 * still produce identical output, but caching is cheaper and removes any chance
 * of filesystem races (e.g. an editor saving a fragment mid-batch) corrupting the
 * Anthropic prompt-cache key.
 */
const fragmentCache = new Map<string, string>()

function resolveRoot(fragmentsRoot: string | undefined): string {
  const root = fragmentsRoot ?? DEFAULT_FRAGMENTS_ROOT
  return path.isAbsolute(root) ? root : path.join(process.cwd(), root)
}

function readFragment(absoluteRoot: string, relPath: string): string {
  const key = `${absoluteRoot}::${relPath}`
  const cached = fragmentCache.get(key)
  if (cached !== undefined) return cached

  const fullPath = path.join(absoluteRoot, relPath)
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Prompt fragment not found: ${fullPath}`)
  }

  // Trim only trailing whitespace so the SEPARATOR controls inter-fragment spacing.
  // Leading whitespace inside a fragment is meaningful (indented YAML, code blocks).
  const content = fs.readFileSync(fullPath, 'utf8').replace(/\s+$/, '')
  fragmentCache.set(key, content)
  return content
}

/**
 * Assemble a per-media-type system prompt by concatenating fragments in a fixed
 * order with a fixed `\n\n---\n\n` separator. Output is byte-deterministic for
 * the same `mediaType`, which is what keeps the Anthropic ephemeral prompt cache
 * hot across files of the same category.
 *
 * Order (matches `tmp/phase1-fragment-mapping.md`):
 *   1. core/header.md
 *   2. core/routing-note.md
 *   3. core/yaml-syntax.md
 *   4. core/engine-self-report.md
 *   5. media/<type>/identification.md
 *   6. media/comics/characters.md    (comics only)
 *   7. media/comics/franchises.md    (comics only)
 *   8. media/<type>/violations.md
 *   9. core/violations-universal.md
 *  10. core/scoring-rubric.md
 *  11. media/<type>/checklist.md
 *  12. core/checklist-universal.md
 */
export function assemble({fragmentsRoot, mediaType}: AssembleOptions): string {
  const root = resolveRoot(fragmentsRoot)

  const parts: string[] = [
    readFragment(root, 'core/header.md'),
    readFragment(root, 'core/routing-note.md'),
    readFragment(root, 'core/yaml-syntax.md'),
    readFragment(root, 'core/engine-self-report.md'),
    readFragment(root, `media/${mediaType}/identification.md`),
  ]

  if (mediaType === 'comics') {
    parts.push(
      readFragment(root, 'media/comics/characters.md'),
      readFragment(root, 'media/comics/franchises.md'),
    )
  }

  parts.push(
    readFragment(root, `media/${mediaType}/violations.md`),
    readFragment(root, 'core/violations-universal.md'),
    readFragment(root, 'core/scoring-rubric.md'),
    readFragment(root, `media/${mediaType}/checklist.md`),
    readFragment(root, 'core/checklist-universal.md'),
  )

  return parts.join(SEPARATOR)
}

/** Test-only: clear the fragment cache so tests can simulate fresh reads. */
export function _resetFragmentCacheForTests(): void {
  fragmentCache.clear()
}
