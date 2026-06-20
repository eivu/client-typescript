import type {Pipeline, PipelineName} from '@src/ai/pipeline'
import type {PipelineFactoryOptions} from '@src/ai/pipelines/types'
import type {AssemblerMediaType} from '@src/ai/prompt-assembler'

import {buildUserMessage} from '@src/ai/base-agent'
import {assemble} from '@src/ai/prompt-assembler'
import * as fs from 'node:fs'
import path from 'node:path'

/**
 * Where a pipeline's system prompt comes from:
 *   - `assembler` — composed from per-media fragments via `PromptAssembler`
 *     (comics / audio / video).
 *   - `monolith` — the whole v7.16.4 runtime markdown read from disk
 *     (`other`, the catch-all for unknown file types).
 */
type SystemPromptSource = {mediaType: AssemblerMediaType; type: 'assembler'} | {type: 'monolith'}

type PipelineConfig = {
  maxTokens: number
  model: string
  systemPromptSource: SystemPromptSource
  webSearchMaxUses: number
}

const MONOLITH_PATH = path.join('src', 'ai', 'prompts', 'claude', 'EIVU_METADATA_SKILL_v7_16_4_RUNTIME.md')

/**
 * Production pipeline configuration — one row per media category. This table is
 * the single source for model tiering and prompt sourcing; adding a media type
 * is a new row here, not a new file.
 *
 * Model tiering rationale (locked in 2026-05-28 after the Phase 2 sub-experiment,
 * see tmp/phase2-comparison-analysis.md):
 *   - comics → Opus 4.6. Comics research (S## mapping tables, universe
 *     disambiguation, full creator credits, character labeling) is the heaviest
 *     lift in the eivu workflow, so comics is NOT a Sonnet candidate.
 *   - audio + video → Sonnet 4.6. The model-tiering sub-experiment showed 25%
 *     cost savings, tighter stddev (0.029 vs 0.088), and a preserved web-search
 *     budget (4.7/call vs 5.6 control) for non-comics media — no behavioral
 *     regression from the lighter model.
 *   - other → Opus 4.6 with the v7.16.4 monolith. Phase 1 only authored
 *     fragments for comics/audio/video; the monolith remains the most complete
 *     ruleset for unknown file types.
 *
 * All four share maxTokens 16384 and a 10-search web budget (the v7.16.4-era
 * production defaults).
 */
const PIPELINE_CONFIGS: Record<PipelineName, PipelineConfig> = {
  audio: {maxTokens: 16_384, model: 'claude-sonnet-4-6', systemPromptSource: {mediaType: 'audio', type: 'assembler'}, webSearchMaxUses: 10},
  comics: {maxTokens: 16_384, model: 'claude-opus-4-6', systemPromptSource: {mediaType: 'comics', type: 'assembler'}, webSearchMaxUses: 10},
  other: {maxTokens: 16_384, model: 'claude-opus-4-6', systemPromptSource: {type: 'monolith'}, webSearchMaxUses: 10},
  video: {maxTokens: 16_384, model: 'claude-sonnet-4-6', systemPromptSource: {mediaType: 'video', type: 'assembler'}, webSearchMaxUses: 10},
}

/**
 * Resolves a config's system prompt to a byte-stable string. Returns `undefined`
 * only for the `monolith` source when the v7.16.4 file is missing on disk — the
 * caller (`buildPipeline`) treats that as "pipeline unavailable".
 */
function resolveSystemPrompt(source: SystemPromptSource, fragmentsRoot: string | undefined): string | undefined {
  if (source.type === 'assembler') {
    return assemble({fragmentsRoot, mediaType: source.mediaType})
  }

  const fullPath = path.join(process.cwd(), MONOLITH_PATH)
  if (!fs.existsSync(fullPath)) return undefined
  return fs.readFileSync(fullPath, 'utf8')
}

/**
 * Builds one production pipeline from its config row. `options` are overrides on
 * the per-pipeline defaults — used by spike variants (e.g. `phase1-fragments` at
 * `maxTokens=8192`) and tests; production callers pass nothing.
 *
 * Returns `undefined` only for the `other` pipeline when the monolith is absent,
 * mirroring the previous `buildOtherPipeline` contract — `resolvePipeline()`
 * raises a clear error if a file then routes to a missing pipeline.
 */
export function buildPipeline(name: PipelineName, options: PipelineFactoryOptions = {}): Pipeline | undefined {
  const config = PIPELINE_CONFIGS[name]
  const systemPrompt = resolveSystemPrompt(config.systemPromptSource, options.fragmentsRoot)
  if (systemPrompt === undefined) return undefined

  return {
    name,
    stages: [
      {
        buildUserMessage,
        maxTokens: options.maxTokens ?? config.maxTokens,
        model: options.model ?? config.model,
        systemPrompt,
        webSearchMaxUses: options.webSearchMaxUses ?? config.webSearchMaxUses,
      },
    ],
  }
}

/**
 * Comics pipeline (Phase 2 primary): single Opus 4.6 stage, assembled comics
 * prompt, 10-search budget. See `PIPELINE_CONFIGS` for the model rationale.
 */
export function buildComicsPipeline(options: PipelineFactoryOptions = {}): Pipeline {
  return buildPipeline('comics', options) as Pipeline
}

/** Audio pipeline (Phase 2 primary): single Sonnet 4.6 stage, assembled audio prompt. */
export function buildAudioPipeline(options: PipelineFactoryOptions = {}): Pipeline {
  return buildPipeline('audio', options) as Pipeline
}

/** Video pipeline (Phase 2 primary): single Sonnet 4.6 stage, assembled video prompt. */
export function buildVideoPipeline(options: PipelineFactoryOptions = {}): Pipeline {
  return buildPipeline('video', options) as Pipeline
}

/**
 * 'Other' pipeline (Phase 2 primary): catch-all for files whose extension does
 * not match a known media category, using the v7.16.4 monolith as the system
 * prompt. Returns `undefined` when the monolith is not on disk.
 */
export function buildOtherPipeline(options: PipelineFactoryOptions = {}): Pipeline | undefined {
  return buildPipeline('other', options)
}

/**
 * Builds the full set of production pipelines. Called once at `ClaudeAgent`
 * construction. The 'other' pipeline is omitted when the v7.16.4 monolith is
 * missing — `resolvePipeline()` then raises for files that route to 'other',
 * rather than silently using a wrong-shape pipeline.
 *
 * Options are forwarded to every pipeline so spike variants and tests can
 * override `model` / `maxTokens` / `webSearchMaxUses` uniformly. Production
 * callers pass nothing.
 */
export function buildAllPipelines(
  options: PipelineFactoryOptions = {},
): Partial<Record<PipelineName, Pipeline>> {
  const pipelines: Partial<Record<PipelineName, Pipeline>> = {
    audio: buildPipeline('audio', options),
    comics: buildPipeline('comics', options),
    video: buildPipeline('video', options),
  }
  const other = buildPipeline('other', options)
  if (other) pipelines.other = other
  return pipelines
}

export {type PipelineFactoryOptions} from '@src/ai/pipelines/types'
