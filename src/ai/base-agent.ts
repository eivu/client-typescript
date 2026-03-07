import type {AgentOptions, AgentRequest, AgentResult, BatchProgress} from '@src/ai/types'

import path from 'node:path'

/** Default values for agent configuration (maxTokens, model, pollIntervalMs). */
export type AgentDefaults = {
  maxTokens: number
  model: string
  pollIntervalMs: number
}

/**
 * Extracts YAML from an LLM response, stripping markdown code fences and any
 * research/reasoning prose the model may have emitted before the actual YAML.
 *
 * When web search is enabled, the model often outputs its research summary and
 * checklist reasoning as plain text before the YAML. This function detects the
 * YAML start (the `name:` top-level key) and discards everything before it.
 *
 * Extraction priority:
 *   1. Fenced YAML block (```yaml ... ```)
 *   2. YAML detected by top-level `name:` key — everything before it is stripped
 *   3. Full text as-is (fallback)
 */
export function extractYamlFromResponse(content: Array<{text?: string; type: string}>): string {
  const text = content
    .filter((block): block is {text: string; type: 'text'} => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')

  // 1. Prefer fenced YAML blocks — cleanest signal
  const fenced = text.match(/```(?:ya?ml)?\n?([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()

  // 2. Detect YAML by the required top-level `name:` key at the start of a line.
  //    The model may emit research prose, a "Now generating:" preamble, or checklist
  //    notes before the actual YAML. We find the LAST occurrence of a line starting
  //    with `name:` (not indented, not inside backticks) — that's the real YAML start.
  //    We use the last match because earlier occurrences may be inline references
  //    like `name: \`Doctor Fate...\`` inside reasoning prose.
  const lines = text.split('\n')
  let yamlStartIndex = -1

  for (let i = lines.length - 1; i >= 0; i--) {
    // Match `name:` at the start of the line, followed by a space and a non-backtick char
    // (to exclude reasoning lines like "name: `Some Title`")
    if (/^name:\s+[^`]/.test(lines[i])) {
      yamlStartIndex = i
      break
    }
  }

  if (yamlStartIndex > 0) {
    // Found YAML start after some prose — strip the prose
    return lines.slice(yamlStartIndex).join('\n').trim()
  }

  // 3. Fallback — return the full text trimmed
  return text.trim()
}

/**
 * Post-processes generated YAML so that any line starting with `- ai:engine:` has
 * its value set to the actual model used for the request. Claude may emit a
 * placeholder or wrong model name; this ensures the written .eivu.yml reflects
 * the engine that produced it.
 *
 * @param yaml - Raw YAML string (e.g. from extractYamlFromResponse)
 * @param model - Model identifier (e.g. 'claude-opus-4-6')
 * @returns YAML with ai:engine lines normalized to the given model
 */
export function postProcessAiEngine(yaml: string, model: string): string {
  return yaml.replace(/^(- ai:engine:\s*)[^\n]*/gm, `$1${model}`)
}

/**
 * Builds the user message sent to the agent for a given file path (filename only, no path).
 * Includes a structured research workflow to ensure the agent verifies the book's identity,
 * creative team, characters, and critical reception via web search before generating YAML.
 *
 * @param filePath - Full path to the file
 * @returns Message string with research workflow instructions for the filename
 */
export function buildUserMessage(filePath: string): string {
  const filename = path.basename(filePath)
  return `Create an .eivu.yml metadata file for: ${filename}

## Research Workflow — execute these steps IN ORDER before generating any YAML

**IMPORTANT: "Filenames lie." The filename is a hint, not ground truth. You MUST verify
every detail via web search. Do NOT generate YAML until you have completed research.**

### Step 1: Identify the book
Parse the filename to extract title, volume, year, and any creator names.
- Values like (Digital-TPB), (hybrid), (Zone-Empire), (Marika-Empire) are distribution tags — ignore them.
- Files ending in .eivu_compressed.cbr/.cbz were processed by https://github.com/eivu/ts-comic-compress — this suffix is not meaningful for identification.
- The year in parentheses may be the collected edition's publication year, NOT the original series year.

### Step 2: Verify what this book actually is
Search the web for this specific publication. Determine:
- Is this a single issue, trade paperback, omnibus, or collected edition?
- What specific issues/content does it collect?
- What year was it published?
- Search: "[title] [creator if present] [year] trade paperback" or "[title] collected edition contents"

### Step 3: Find the full creative team
For collected editions spanning multiple issues, list ALL contributors across all collected issues.
Search: "[title] [year] credits" or check dc.com, marvel.com, comics.org, Grand Comics Database.
Include pencillers, inkers, colorists, letterers, and cover artists — not just writer and "artist."

### Step 4: Research character appearances
Build a comprehensive character list. For DC titles, search:
"[Title] Vol [#] [Year] fandom wiki appearances characters" or "[Title] [Year] dc fandom characters"
For Marvel: check marvel.com/comics/series or Marvel Fandom wiki.
Include villains, supporting cast, teams/organizations, and guest appearances.

### Step 5: Research critical reception for ai:rating
Search for reviews and reception data to calibrate the ai:rating.
Check: ComicBookRoundUp aggregate scores, Goodreads ratings, professional reviews (CBR, IGN, AV Club),
Eisner/Harvey/Hugo nominations and wins from official sources.
Cite SPECIFIC sources by name in ai:rating_reasoning.

### Step 6: Generate the YAML
Only now — with verified data from Steps 1-5 — generate the .eivu.yml following all
runtime skill rules. Run through the FINAL CHECKLIST before outputting.

Output ONLY the raw YAML content. No markdown fences, no commentary.`
}

/**
 * Base class for AI agents that process metadata generation requests.
 * Subclasses implement processRequests and may override defaults.
 */
export abstract class BaseAgent {
  readonly maxTokens: number
  readonly model: string
  protected onProgress?: (progress: BatchProgress) => void
  readonly pollIntervalMs: number

  /**
   * Creates a base agent with options merged over defaults.
   * @param options - Agent options (API key, model, tokens, etc.)
   * @param defaults - Default values when options omit fields
   */
  constructor(options: AgentOptions, defaults: AgentDefaults) {
    this.maxTokens = options.maxTokens ?? defaults.maxTokens
    this.model = options.model ?? defaults.model
    this.pollIntervalMs = options.pollIntervalMs ?? defaults.pollIntervalMs
    this.onProgress = options.onProgress
  }

  /**
   * Process all requests through the agent's API.
   * Implementations handle their own batching/chunking as needed.
   */
  abstract processRequests(requests: AgentRequest[]): Promise<AgentResult[]>

  /** Returns a promise that resolves after the given number of milliseconds. */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }
}
