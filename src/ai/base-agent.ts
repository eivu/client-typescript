import type {AgentOptions, AgentRequest, AgentResult, BatchProgress, RawAgentUsage} from '@src/ai/types'

import {normalizeAwardTags} from '@src/ai/award-tags'
import {addMissingParentFranchises} from '@src/ai/franchise-hierarchy'
import {type AiCostFields, applyMechanicalRules, injectAiCostFields} from '@src/ai/postprocess-rules'
import {summarizeIssues, validateEivuYaml} from '@src/ai/validate-yaml'
import {contentTypeIsAudio, contentTypeIsComic, contentTypeIsVideo, detectMime} from '@src/utils'
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
 * Post-processes generated YAML before it is written. Applies normalization rules:
 *   1. Ensures ai:engine matches the actual model used.
 *   2. Adds missing parent franchises from the franchise hierarchy.
 *   3. Normalizes award tags (derives implied Nominee/series/recognized tags).
 *   4. Applies mechanical rules (#7, #12, #17, #19, #22, #24) that the model
 *      is aware of (via violations table) but doesn't need to verify (removed from checklist).
 *
 * @param yaml - Raw YAML string (e.g. from extractYamlFromResponse)
 * @param model - Model identifier (e.g. 'claude-opus-4-6')
 * @returns Post-processed YAML
 */
export function postProcess(yaml: string, model: string): string {
  let result = yaml

  // 1. Fix ai:engine to match the actual model
  result = result.replaceAll(/^(\s*- ai:engine:\s*)[^\n]*/gm, `$1${model}`)

  // 2. Add missing parent franchises
  result = addMissingParentFranchises(result)

  // 3. Normalize award tags
  result = normalizeAwardTags(result)

  // 4. Mechanical rules (unquote numbers, remove format:Digital, skill version, zero-pad, genre casing, Masterwork tag)
  result = applyMechanicalRules(result)

  return result
}

/**
 * Final-stage post-process applied only on the WRITE path (not at validation time)
 * because the cost data depends on cumulative usage across retry attempts, which
 * MetadataGenerator's retry loop only knows after all attempts complete.
 *
 * Runs `postProcess` first (re-idempotent — same rules), then layers on the
 * ai:cost / ai:cost_all / ai:tokens_in / ai:tokens_out fields.
 *
 * @param yaml - YAML that has already been through validateAndPostProcess
 * @param model - Model identifier (used by postProcess re-application)
 * @param costFields - The cost fields to inject; null skips injection entirely
 * @returns Final YAML ready to write to disk
 */
export function postProcessWithCost(
  yaml: string,
  model: string,
  costFields: AiCostFields | null,
): string {
  if (!costFields) return yaml
  return injectAiCostFields(yaml, costFields)
}

/**
 * Returns the broad media category for a file based on its extension.
 * @param filePath - Full or relative path to the file
 * @returns 'comic' | 'audio' | 'video' | 'other'
 */
export function getMediaCategory(filePath: string): 'audio' | 'comic' | 'other' | 'video' {
  const {type} = detectMime(filePath)

  if (contentTypeIsComic(type)) return 'comic'
  if (contentTypeIsAudio(type)) return 'audio'
  if (contentTypeIsVideo(type)) return 'video'

  return 'other'
}

/**
 * One numbered research step in a `buildUserMessage` workflow. `title` becomes
 * the `### Step N: <title>` heading; `body` is the step's instruction text.
 */
type ResearchStep = {
  body: string
  title: string
}

/**
 * Per-media research steps. These are the steps BEFORE the always-appended final
 * "Generate the YAML" step (added by `renderWorkflow`). Keeping comics-specific
 * instructions out of audio/video messages avoids AI confusion and wasted
 * web-search budget. The user message is NOT cached server-side, so per-category
 * prose differences are fine — this table is just the single structural source.
 */
const RESEARCH_STEPS: Record<ReturnType<typeof getMediaCategory>, ResearchStep[]> = {
  audio: [
    {
      body: 'Parse the filename to extract artist, album/track title, year, and any edition markers.',
      title: 'Identify the release',
    },
    {
      body: `Search the web for this specific recording. Determine:
- Is this a single, EP, album, live recording, or compilation?
- What label released it and in what year?
- Search: "[artist] [album] [year]" or "[artist] [title] discography"`,
      title: 'Verify release details',
    },
    {
      body: `List ALL contributors: performers, producers, engineers, featured artists, and session musicians.
Check AllMusic, Discogs, or the label's official site.`,
      title: 'Find the full credits',
    },
    {
      body: `Search for reviews and aggregate scores to calibrate the ai:rating.
Check: Metacritic, AllMusic, Pitchfork, RateYourMusic, Rolling Stone.
Cite SPECIFIC sources by name in ai:rating_reasoning.`,
      title: 'Research critical reception for ai:rating',
    },
  ],
  comic: [
    {
      body: `Parse the filename to extract title, volume, year, and any creator names.
- Values like (Digital-TPB), (hybrid), (Zone-Empire), (Marika-Empire) are distribution tags — ignore them.
- Files ending in .eivu_compressed.cbr/.cbz were processed by https://github.com/eivu/ts-comic-compress — this suffix is not meaningful for identification.
- The year in parentheses may be the collected edition's publication year, NOT the original series year.`,
      title: 'Identify the book',
    },
    {
      body: `Search the web for this specific publication. Determine:
- Is this a single issue, trade paperback, omnibus, or collected edition?
- What specific issues/content does it collect?
- What year was it published?
- Search: "[title] [creator if present] [year] trade paperback" or "[title] collected edition contents"`,
      title: 'Verify what this book actually is',
    },
    {
      body: `For collected editions spanning multiple issues, list ALL contributors across all collected issues.
Search: "[title] [year] credits" or check dc.com, marvel.com, comics.org, Grand Comics Database.
Include pencillers, inkers, colorists, letterers, and cover artists — not just writer and "artist."`,
      title: 'Find the full creative team',
    },
    {
      body: `Build a comprehensive character list. For DC titles, search:
"[Title] Vol [#] [Year] fandom wiki appearances characters" or "[Title] [Year] dc fandom characters"
For Marvel: check marvel.com/comics/series or Marvel Fandom wiki.
Include villains, supporting cast, teams/organizations, and guest appearances.`,
      title: 'Research character appearances',
    },
    {
      body: `Search for reviews and reception data to calibrate the ai:rating.
Check: ComicBookRoundUp aggregate scores, Goodreads ratings, professional reviews (CBR, IGN, AV Club),
Eisner/Harvey/Hugo nominations and wins from official sources.
Cite SPECIFIC sources by name in ai:rating_reasoning.`,
      title: 'Research critical reception for ai:rating',
    },
  ],
  other: [
    {
      body: 'Parse the filename to extract title, creator, year, and any edition markers.',
      title: 'Identify the content',
    },
    {
      body: 'Search the web for this specific work to confirm its identity, release date, and creator(s).',
      title: 'Verify what this file is',
    },
    {
      body: 'List all relevant contributors. Check authoritative sources appropriate to the content type.',
      title: 'Find the full credits',
    },
    {
      body: 'Search for reviews and aggregate scores. Cite SPECIFIC sources by name in ai:rating_reasoning.',
      title: 'Research critical reception for ai:rating',
    },
  ],
  video: [
    {
      body: 'Parse the filename to extract title, year, season/episode numbers, and any edition markers.',
      title: 'Identify the content',
    },
    {
      body: `Search the web for this specific title. Determine:
- Is this a feature film, TV episode, documentary, short, or special?
- What year was it released or aired?
- Search: "[title] [year] film" or "[title] season [#] episode [#]"`,
      title: 'Verify what this video is',
    },
    {
      body: `List director(s), writers, lead cast, producers, and composer.
Check IMDb, TMDb, or the studio's official site.`,
      title: 'Find the full creative team',
    },
    {
      body: `Search for reviews and aggregate scores to calibrate the ai:rating.
Check: IMDb rating, Rotten Tomatoes/Metacritic scores, prominent reviews (AV Club, Variety, etc.).
Cite SPECIFIC sources by name in ai:rating_reasoning.`,
      title: 'Research critical reception for ai:rating',
    },
  ],
}

/**
 * Renders the shared research-workflow message: a fixed header + the per-media
 * numbered steps + an always-final "Generate the YAML" step. The single source
 * of structural truth for every category's user message.
 */
function renderWorkflow(filename: string, steps: ResearchStep[]): string {
  const stepBlocks = steps.map((step, i) => `### Step ${i + 1}: ${step.title}\n${step.body}`).join('\n\n')
  const finalStep = steps.length + 1

  return `Create an .eivu.yml metadata file for: ${filename}

## Research Workflow — execute these steps IN ORDER before generating any YAML

**IMPORTANT: "Filenames lie." The filename is a hint, not ground truth. You MUST verify
every detail via web search. Do NOT generate YAML until you have completed research.**

${stepBlocks}

### Step ${finalStep}: Generate the YAML
Only now — with verified data from Steps 1-${steps.length} — generate the .eivu.yml following all
runtime skill rules. Run through the FINAL CHECKLIST before outputting.

Output ONLY the raw YAML content. No markdown fences, no commentary.`
}

/**
 * Builds the user message sent to the agent for a given file path.
 * Returns a media-category-specific research workflow so that comics instructions
 * are not sent for audio/video files (and vice-versa), avoiding AI confusion and
 * unnecessary web-search budget consumption.
 *
 * @param filePath - Full path to the file
 * @returns Message string with research workflow instructions tailored to the file type
 */
export function buildUserMessage(filePath: string): string {
  const filename = path.basename(filePath)
  return renderWorkflow(filename, RESEARCH_STEPS[getMediaCategory(filePath)])
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

  /**
   * Validates and post-processes raw YAML strings extracted from agent responses.
   *
   * Centralises the shared pipeline so that every agent implementation automatically
   * benefits from validation and post-processing without duplicating the logic.
   * Subclasses should call this on the raw YAML they extract from the provider API
   * before returning results.
   *
   * Returns `success` results (with post-processed YAML) or `validation_error` results
   * (with `rawYaml` preserved so callers can save it for debugging/retry).
   *
   * Note: the ai:cost / ai:cost_all / ai:tokens_in / ai:tokens_out fields are NOT
   * injected here — MetadataGenerator accumulates usage across retries and applies
   * `postProcessWithCost` immediately before the write.
   *
   * @param items - Array of `{customId, rawYaml, usage}` triples extracted from provider responses
   * @returns Array of `AgentResult` — each either `success` or `validation_error`
   */
  protected validateAndPostProcess(
    items: Array<{customId: string; model?: string; pipeline?: string; rawYaml: string; usage: RawAgentUsage}>,
  ): AgentResult[] {
    return items.map(({customId, model, pipeline, rawYaml, usage}) => {
      const effectiveModel = model ?? this.model
      const validationResult = validateEivuYaml(rawYaml)
      if ('errors' in validationResult) {
        return {
          customId,
          error: summarizeIssues(validationResult.errors),
          model: effectiveModel,
          pipeline,
          rawYaml,
          status: 'validation_error' as const,
          usage,
          validationCodes: validationResult.errors.map((e) => e.code),
        }
      }

      const yaml = postProcess(validationResult.sanitizedYaml, effectiveModel)
      return {customId, model: effectiveModel, pipeline, status: 'success' as const, usage, yaml}
    })
  }
}
