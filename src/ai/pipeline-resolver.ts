import type {Pipeline, PipelineName} from '@src/ai/pipeline'

import {getMediaCategory} from '@src/ai/base-agent'

/**
 * Maps a file path to the pipeline that should handle it. Pure lookup —
 * never reads from disk, never throws — designed to be called once per
 * batch request inside `ClaudeAgent.buildBatchParams()`.
 *
 * `getMediaCategory()` returns singular `'comic'` while pipelines (and the
 * fragment directory layout) use plural `'comics'`. The mapping is performed
 * here so callers don't need to know about that asymmetry.
 *
 * Returns `undefined` when no pipeline is configured for the file's category.
 * That happens in practice only when the 'other' pipeline couldn't be built
 * (e.g. v7.16.4 monolith deleted from disk). Callers should surface a clear
 * error rather than silently falling back — the previous behavior of using
 * the comics prompt for non-media files would produce wrong output.
 */
export function resolvePipeline(
  filePath: string,
  pipelines: Partial<Record<PipelineName, Pipeline>>,
): Pipeline | undefined {
  const category = getMediaCategory(filePath)
  const name: PipelineName = category === 'comic' ? 'comics' : category
  return pipelines[name]
}
