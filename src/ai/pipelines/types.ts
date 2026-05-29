/**
 * Options accepted by each pipeline factory. All fields are overrides on the
 * per-pipeline defaults — pass nothing to get the production defaults.
 *
 * Used by:
 *   - `ClaudeAgent`'s pipeline-mode constructor, which threads agent-level
 *     `maxTokens` / `model` / `webSearchMaxUses` overrides into every pipeline
 *     so spike variants (e.g. `phase1-fragments` at `maxTokens=8192`) and
 *     tests can pin behavior without sacrificing the pipeline abstraction.
 *   - Pipeline tests, which use `fragmentsRoot` to point at a fixture
 *     fragments directory.
 */
export type PipelineFactoryOptions = {
  /** Override the fragments directory (test-only). Resolved against `process.cwd()` if relative. */
  fragmentsRoot?: string
  /** Override the stage's max output tokens. */
  maxTokens?: number
  /** Override the stage's Anthropic model identifier. */
  model?: string
  /** Override the stage's web search budget. Use 0 to disable web search. */
  webSearchMaxUses?: number
}
