import type {Pipeline, PipelineName} from '@src/ai/pipeline'

import {buildAudioPipeline} from '@src/ai/pipelines/audio'
import {buildComicsPipeline} from '@src/ai/pipelines/comics'
import {buildOtherPipeline} from '@src/ai/pipelines/other'
import {type PipelineFactoryOptions} from '@src/ai/pipelines/types'
import {buildVideoPipeline} from '@src/ai/pipelines/video'

/**
 * Builds the full set of production pipelines. Called once at
 * `ClaudeAgent` construction. The 'other' pipeline is omitted when the
 * v7.16.4 monolith is missing — `resolvePipeline()` then raises for files
 * that route to 'other', rather than silently using a wrong-shape pipeline.
 *
 * Options are forwarded to every individual pipeline factory so spike
 * variants and tests can override `model` / `maxTokens` / `webSearchMaxUses`
 * uniformly across all four pipelines. Production callers pass nothing.
 */
export function buildAllPipelines(
  options: PipelineFactoryOptions = {},
): Partial<Record<PipelineName, Pipeline>> {
  const pipelines: Partial<Record<PipelineName, Pipeline>> = {
    audio: buildAudioPipeline(options),
    comics: buildComicsPipeline(options),
    video: buildVideoPipeline(options),
  }
  const other = buildOtherPipeline(options)
  if (other) pipelines.other = other
  return pipelines
}

export {buildAudioPipeline} from '@src/ai/pipelines/audio'
export {buildComicsPipeline} from '@src/ai/pipelines/comics'
export {buildOtherPipeline} from '@src/ai/pipelines/other'
export {type PipelineFactoryOptions} from '@src/ai/pipelines/types'
export {buildVideoPipeline} from '@src/ai/pipelines/video'
