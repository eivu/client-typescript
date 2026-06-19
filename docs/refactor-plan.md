# Refactor Plan: `feat-ai-overhaul` Branch

This branch added ~11,000 lines of mostly-good code. A meaningful fraction is copy-pasted rather than composed. The goal of this refactor is to consolidate the duplication into reusable, extensible primitives **without changing behavior**, separate experiments from production code, and verify equivalence with a re-run of an existing spike.

## TL;DR

- **All work lands on the current `feat-ai-overhaul` branch as a single PR.** No phase-per-PR split — the phases are sequencing for the work, not for review.
- **5 phases**, sequenced so each step is independently revertible via `git revert` if needed.
- **Phase A** moves spike code out of `src/` into a new sibling `experiments/` folder.
- **Phases B + C** collapse duplication (production code first, then experiment code).
- **Phase D** deletes truly-unused files.
- **Phase E** re-runs the spike harness and verifies per-fixture results match the pre-refactor baseline within tolerance.

## Goals

1. Reduce duplication in a way that makes adding a new media type, pipeline, or spike variant **a config change, not a new file**.
2. Eliminate documented drift hazards (e.g. assembler ordering encoded in two places, raw vs non-raw method pairs in `ClaudeAgent`).
3. Separate `experiments/` (prompt-engineering harness, never ships) from `src/` (production code).
4. Verify the refactor preserves spike-measurable behavior: rating consistency, web-search budget usage, parse-failure rate.

## Non-goals

- Adding features, fixing bugs unrelated to duplication, or renaming public CLI surfaces.
- Modifying telemetry CSV columns (`logs/metadata-runs.csv` is append-only).
- Changing fragment markdown content (`src/ai/prompts/claude/fragments/**`).
- Touching test fixtures.

## Constraints (explicit user overrides)

- **DO NOT modify [src/commands/process.ts](../src/commands/process.ts)** — reserved for forthcoming phases.
- **DO NOT modify any file under [test/fixtures/samples/](../test/fixtures/samples/)** — even unused-looking binaries.

These rules win over anything else in this plan; if a step would touch one of those paths, skip it.

---

## Phase A — Reorganization: move experiments out of `src/`

Goal: a new `experiments/` directory at the repo root, sibling to `src/`, housing all spike code. Production `src/` shrinks; the boundary between production and research becomes visible at the filesystem level.

### A.1 New folder layout

```
client-typescript/
├── src/                    ← production only
├── experiments/            ← NEW; sibling of src/
│   └── spike/              ← moved from src/ai/spike/
│       ├── content/
│       ├── variants/
│       ├── harness.ts
│       └── ...
├── test/
├── docs/
└── scripts/
```

### A.2 Mechanical moves

- Move `src/ai/spike/` → `experiments/spike/`. Preserve every file's content; only the path changes.
- Move `src/commands/test/spike.ts` → keep at its current path (it's a user-facing CLI command via oclif). Update its imports from `@src/ai/spike/...` to `@experiments/spike/...`.
- Add a TypeScript path alias: `@experiments/*` → `./experiments/*`. Mirror the existing `@src/*` shape in [tsconfig.json](../tsconfig.json) and ensure `tsc-alias` resolves it for the build.
- Update all internal imports inside the moved code:
  - `@src/ai/spike/...` → `@experiments/spike/...`
  - `@src/ai/...` references from spike files stay as-is (spike still depends on production `src/ai/*` modules).
- Update [jest.config.js](../jest.config.js) module-mapper so tests resolve the new alias.

### A.3 Documentation updates

- [CLAUDE.md](../CLAUDE.md): every mention of `src/ai/spike/...` becomes `experiments/spike/...`. The "Spike code" line, the "Spike reports" links to scripts under `src/ai/spike/`, and the Phase 1 verification gate command (`npx tsx src/ai/spike/phase1-equivalence.ts` → `npx tsx experiments/spike/phase1-equivalence.ts`).
- Spike-internal scripts that print follow-up command strings (e.g. `run-phase2-comparison.ts` writing `npx tsx src/ai/spike/analyze-phase2-comparison.ts` to stdout) need their command strings updated.

### A.4 Acceptance

- `npm run build` succeeds.
- `npm test` passes.
- `npx tsx experiments/spike/phase1-equivalence.ts` reports PASS.
- A small spike run (e.g. one variant, one fixture, one rerun via `--variants` / `--fixtures` / `--reruns` flags on a runner) executes end-to-end against the live Anthropic API.

---

## Phase B — Production code DRY

Each item below is independently revertible; sequencing within the phase is by ascending risk.

### Per-phase spike gates for B.4, B.5, B.6

B.4, B.5, and B.6 each touch production code paths whose behavior unit tests cannot fully verify (model routing, user-message wording, API plumbing). Each of these three phases gets a **per-phase spike gate** in addition to its unit-test gate.

**Spike shape (identical for every gate, including Phase E):**
- Variant: `phase1-fragments` (the variant that exercises the assembled-prompt path used by all production pipelines).
- Fixtures: the 8 fixtures defined in [experiments/spike/fixtures.ts](../experiments/spike/fixtures.ts) (curated comics + audio + video).
- Reruns: 3.
- Total: 24 API calls per spike run, ~$0.36 calibrated.

**Tolerance thresholds (same as Phase E) — recalibrated during B.4/B.5 for n=3 reruns:**
- **Primary signal: `|Δ pooled mean rating| ≤ 0.15`** — mean over ALL fixtures × reruns (24 samples). **Added during B.5** (see deviation note). Per-fixture means are too quantized at n=3 to gate on directly (a lone rerun moving a full step = Δ0.333), so the pooled mean — where that jitter cancels — is the real regression signal. A true refactor regression drags the whole distribution; noise stays near zero.
- `|Δmean rating| ≤ 0.50` per fixture — **loosened from 0.25 during B.5** to a backstop that only catches a single-fixture blowup; the pooled check above is primary.
- `|Δstddev| ≤ 0.25` per fixture — **recalibrated from 0.05 during B.4** (see deviation note). At n=3 reruns with 0.5-step ratings, stddev is quantized to {0, 0.236, 0.471, …}; a single half-step rerun flip is ≈0.236 of stddev change (ordinary model noise). 0.05 was mathematically unsatisfiable. 0.25 tolerates the one-flip quantum while still catching a real consistency blowup (≥2 flips / a 1.0 swing → Δstddev ≥ 0.47).
- `parse-failure delta = 0` per fixture
- `|Δweb-search-count| / pre ≤ 30%` per fixture

**Pre/post reuse rule:** the "pre" snapshot for B.4 is the Phase 0 baseline (`tmp/refactor-baseline.json`). The "pre" snapshot for B.5 is B.4's post snapshot; the "pre" for B.6 is B.5's post. Only one fresh spike per phase. Phase E re-runs once more and compares back to the Phase 0 baseline as a full end-to-end check.

**Total live spike spend across B.4–B.6 + Phase E: 4 × $0.36 ≈ $1.44** (on top of the $0.36 Phase 0 baseline).

**Regression handling — fix-forward, not revert:** if any per-phase spike gate fails, stay on the failing-phase commit, investigate the regression in place, push a fix-up commit on top, and re-run the same spike. The phase is not complete until the gate passes. Revert (`git revert <commit>`) is reserved for catastrophic regressions where the root cause isn't tractable — the default is to debug and fix the change at hand.

**Tooling:** `experiments/spike/verify-refactor.ts` (authored before B.4 lands, originally specified as a Phase E deliverable; brought forward so B.4/B.5/B.6 can use it as their gate). Invoked as:

```bash
npx tsx experiments/spike/verify-refactor.ts \
  --pre  tmp/refactor-baseline.json \
  --post tmp/phase1-comparison.json
```

PASS exits 0; FAIL exits non-zero with a per-fixture per-axis breakdown.

**B.1–B.3 are exempt** from the spike gate. Their existing gates (equivalence script + Jest snapshots + unit tests) are sufficient: B.1 changes only the *ordering* of prompt assembly (guarded byte-for-byte by `phase1-equivalence.ts`), B.2 is a type-checker-verifiable helper extraction, and B.3 has full unit-test coverage in `test/postprocess-rules.test.ts`.

### B.1 Single ordering source in [src/ai/prompt-assembler.ts](../src/ai/prompt-assembler.ts) (LOW risk)

Today `assemble()` and `fragmentsFor()` both encode the same fragment-order rules; the file even warns they must stay in sync. Collapse to one ordered-path generator that both functions consume.

**Verification:** byte-equivalence test (`prompt-assembler.test.ts` snapshot) plus `phase1-equivalence.ts` PASS.

### B.2 Shared `zeroUsage` in [src/ai/types.ts](../src/ai/types.ts) (TRIVIAL)

Identical zero-record is constructed in 3 places (`ClaudeAgent.emptyUsage`, `MetadataGenerator.emitTelemetry` fallback, spike `zeroUsage()`). Export one helper from `types.ts`; call it from all three sites.

### B.3 Anchor-search helper in [src/ai/postprocess-rules.ts](../src/ai/postprocess-rules.ts) (LOW)

Four rules (`enforceMasterworkTag`, `enforceSkillVersion`, `enforceAiEngineAfterSkillVersion`, `injectAiCostFields`) duplicate a "cascading fallback search for an `ai:*` anchor + derive indent + walk past block-scalar body" pattern. Extract:

```ts
function findAiAnchor(
  lines: string[],
  preference: Array<'engine' | 'skill_version' | 'rating_reasoning' | 'rating'>,
): {insertAfterIndex: number; indent: string} | null
```

Each rule keeps its splice-and-format logic; only the anchor search is shared.

**Verification:** [test/postprocess-rules.test.ts](../test/postprocess-rules.test.ts) full pass; eyeball spot-check on a real generated `.eivu.yml`.

**DEVIATION (landed):** `findAiAnchor` was applied to only **two** of the four named rules — `enforceMasterworkTag` and `injectAiCostFields` — because only those two actually share the contract (cascading search → insert AFTER anchor → indent from the anchor's field line → block-scalar-aware for `ai:rating_reasoning`). The other two were left untouched on purpose, since folding them in would change their output (a behavior change B.3 forbids):
- `enforceSkillVersion` inserts BEFORE `ai:engine` (splice at `engineIndex`, not `engineIndex + 1`) and derives indent via `siblingIndent` (the next non-blank line), not the anchor's own field line.
- `enforceAiEngineAfterSkillVersion` *relocates* an existing `ai:engine` line rather than inserting a new one — it has no cascading search or indent derivation to share.

The signature also landed as `null | {indent; insertAfterIndex}` (lint's union-ordering rule) and the anchor keys are camelCase (`ratingReasoning`, `skillVersion`) to satisfy the `camelcase` rule. A `NOTE` comment in `postprocess-rules.ts` records why the two excluded rules stay separate.

### B.4 Collapse pipeline factories under [src/ai/pipelines/](../src/ai/pipelines/) (LOW-MED)

Today: four factory files (`audio.ts`, `comics.ts`, `video.ts`, `other.ts`) with the same shape varying only in `name`, `model`, and how `systemPrompt` is sourced.

Refactor to a config table consumed by a single `buildPipeline(name, options)`:

```ts
const PIPELINE_CONFIGS: Record<PipelineName, PipelineConfig> = {
  comics: {model: 'claude-opus-4-6',   systemPromptSource: {type: 'assembler', mediaType: 'comics'}},
  audio:  {model: 'claude-sonnet-4-6', systemPromptSource: {type: 'assembler', mediaType: 'audio'}},
  video:  {model: 'claude-sonnet-4-6', systemPromptSource: {type: 'assembler', mediaType: 'video'}},
  other:  {model: 'claude-opus-4-6',   systemPromptSource: {type: 'monolith'}},
}
```

`buildAllPipelines()` keeps the same signature; spike variants that need per-pipeline overrides (`phase2-sonnet-non-comics`, etc.) continue to work by passing per-config overrides.

**Caveat:** preserve the per-pipeline rationale comments (Sonnet for non-comics, Opus for comics) at the config-row level.

**Verification:** [src/ai/pipelines/index.test.ts](../src/ai/pipelines/index.test.ts) passes; `gm:pipeline-list` and `gm:pipeline-show` outputs are byte-identical to a pre-refactor snapshot; **per-phase spike gate** (see "Per-phase spike gates" above) — pre = `tmp/refactor-baseline.json`, post = fresh run, fix-forward on regression.

### B.5 `buildUserMessage` template consolidation in [src/ai/base-agent.ts](../src/ai/base-agent.ts) (LOW-MED)

Four near-identical research-workflow templates (comic, audio, video, fallback) — same header, same disclaimer, same footer, different step bodies.

Refactor to a template + per-media step config:

```ts
const RESEARCH_STEPS: Record<MediaCategory, ResearchStep[]> = {...}
export function buildUserMessage(filePath: string): string {
  return renderWorkflow(path.basename(filePath), RESEARCH_STEPS[getMediaCategory(filePath)])
}
```

**Caveat:** the user message is NOT cached server-side (only the system prompt is). Slight prose differences across categories are OK; the goal is one source of structural truth.

**Verification:** snapshot the existing per-category output strings before the change; after the change, regenerate and assert no diff; **per-phase spike gate** — pre = B.4's post snapshot, post = fresh run, fix-forward on regression.

### B.6 Unify raw vs non-raw paths in [src/ai/claude-agent.ts](../src/ai/claude-agent.ts) (MEDIUM)

Today 4 method pairs duplicate batch-submit/poll logic with different post-processing:
- `processRequests` / `processRequestsRaw`
- `submitAndPollBatch` / `submitAndPollBatchRaw`
- `collectResults` / `collectRawResults`
- `parseRawSuccess` (with inline usage parsing) / `extractUsage`

Refactor:
- Single `runBatch<T>(requests, collect: (batchId) => Promise<T[]>)` internal helper.
- `processRequests` and `processRequestsRaw` become thin wrappers passing different collectors.
- Single `parseUsage(message, startedAt)` consumed by both collectors.

**Verification:** existing tests pass; **per-phase spike gate** — pre = B.5's post snapshot, post = fresh run, fix-forward on regression. Phase E re-runs once more against the original Phase 0 baseline as a full end-to-end check.

---

## Phase C — Experiments DRY (after Phase A move)

### C.1 Variant config-driven approach in `experiments/spike/variants/`

7 of the 10 variants (`baseline`, `anchored-rubric`, `anchored-rubric-disjoint`, `phase1-fragments`, `phase2-opus-4-7`, `phase2-sonnet-non-comics`, `phase2-haiku-non-comics`) share the same `runBatch` shape and a verbatim-copied `mapRawToVariantResult`.

Add a `simpleVariant({name, description, buildAgent})` helper in `experiments/spike/variant-runner.ts`. Variants that match this shape become small declarations:

```ts
export const phase2SonnetNonComicsVariant = simpleVariant({
  name: 'phase2-sonnet-non-comics',
  description: '...',
  buildAgent: () => new ClaudeAgent({pipelines: {...}, webSearchMaxUses: 10}),
})
```

`multi-sample`, `structured-output`, `two-stage`, `haiku-comics-research` stay custom (they do legitimately different things). Each variant keeps its own file with its JSDoc — the historical record matters.

### C.2 Parameterize the run scripts

`run-phase1-comparison.ts`, `run-phase2-comparison.ts`, `run-phase2-haiku-comparison.ts` (~75 lines × 3, ~95% identical) become 5-line wrappers around a shared `experiments/spike/run-comparison.ts` driven by `{variants, outputPrefix, banner}`.

### C.3 Unify the analyze scripts

`analyze-phase1-comparison.ts` (464), `analyze-phase2-comparison.ts` (423), `analyze-phase2-haiku-comparison.ts` (424). The Phase 2 / Phase 2-Haiku pair diffs by ~10 substantive lines. Collapse to one parameterized `analyze-comparison.ts` that takes `--input`, `--output`, `--control`, `--title`. The original three become thin wrappers (preserved for command-line backward compat).

**DEVIATION (landed):** only the **phase2 pair** was unified into `analyze-comparison.ts`; `analyze-phase1-comparison.ts` was left **bespoke**. Its report is structurally different from the phase2 generator — a 2-variant `baseline`-vs-`phase1` framing, a per-fixture **`Verdict`** column the phase2 table lacks, a `classifyOutcome` verdict engine (`within-noise` / `directional-improvement` / `investigate`), an "identical fixtures" count in the TL;DR, and a pure-refactor interpretation guide + recommendation logic. Routing it through the N-variant generator would change its output (the plan's own note that only the phase2 pair is near-identical is the tell). So `analyze-comparison.ts` is the generalized **N-variant** core (from the phase2 generator); the two phase2 scripts are now ~45-line wrappers passing `{inputPath, outputPath, title, controlVariant, narrativeIntro, artifactsLines, rerunHint}`. The phase-specific prose (narrative intro, variant bullets, artifacts) is passed as config rather than CLI flags, since it can't be expressed as `--title`-style scalars. Both wrapper outputs verified **byte-identical** to the pre-refactor scripts against a real JSON. Same B.3-style call: unify what genuinely shares structure, leave the structurally-distinct outlier intact and documented.

---

## Phase D — File cleanup

### D.1 Tracked files to delete

| Path | Reason |
|---|---|
| [test/commands/hello/foo.ts](../test/commands/hello/foo.ts), [index.test.ts](../test/commands/hello/index.test.ts), [world.test.ts](../test/commands/hello/world.test.ts) | oclif starter-template placeholders. All tests are `expect(true).toBe(true)`. |
| [src/ai/prompts/claude/archive/EIVU_METADATA_SKILL_v7_16_1_RUNTIME.md](../src/ai/prompts/claude/archive/EIVU_METADATA_SKILL_v7_16_1_RUNTIME.md), [v7_16_2](../src/ai/prompts/claude/archive/EIVU_METADATA_SKILL_v7_16_2_RUNTIME.md), [v7_16_3](../src/ai/prompts/claude/archive/EIVU_METADATA_SKILL_v7_16_3_RUNTIME.md) | Superseded versions; no code references. Git history preserves them. |

### D.2 Tracked files to move

| From | To | Reason |
|---|---|---|
| [EIVU_METADATA_AI_GUIDE.md](../EIVU_METADATA_AI_GUIDE.md) | `docs/eivu-metadata-ai-guide.md` | Other deep-dive docs (client.md, cloud-file.md, metadata-generator.md) live in `docs/`. Keep repo root tidy. |

Update internal links in [CLAUDE.md](../CLAUDE.md) and [README.md](../README.md).

### D.3 Documentation drift

[CLAUDE.md](../CLAUDE.md) currently says `src/commands/process.ts` is "a stub on the `feat-process` branch" — but the file is on the current branch. **Per the user's constraint, we do NOT delete `process.ts`.** Instead, update the CLAUDE.md line to reflect that it's reserved for an upcoming phase.

### D.4 Document `scripts/eivu-yml-html-report.ts`

Add a short note to README.md or CLAUDE.md describing the tool and its `--run-id` flag. Without it, this 498-line utility will be re-discovered by a future contributor and possibly duplicated.

### D.5 Untracked working-tree pollution

These are gitignored already, but accumulate on disk:

- `src/ai/dist/`, `src/commands/dist/`, `src/commands/generate-metadata/dist/` — stale tsc artifacts.
- 18 `.DS_Store` files across the repo.

One-shot cleanup at the end of the refactor:

```bash
find src test -type d -name dist -exec rm -rf {} +
find . -name .DS_Store -not -path './node_modules/*' -delete
```

If the stale `src/**/dist/` dirs reappear after a build, the wrong `tsconfig.json` is setting `outDir`. Track down and fix.

---

## Phase E — Verification experiment

The purpose of this phase is to **prove the refactor preserves behavior**. The spike harness already measures the things we care about most (rating consistency, cost, web-search counts), so we re-use it as our regression test.

### E.1 Capture pre-refactor baseline (DO THIS FIRST)

**Before any other phase begins**, run a baseline spike using current production code:

```bash
# Pre-refactor (current main / feat-ai-overhaul HEAD)
ANTHROPIC_API_KEY=sk-... npx tsx src/ai/spike/run-phase1-comparison.ts
mv tmp/phase1-comparison.json tmp/refactor-baseline.json
mv tmp/phase1-comparison.md   tmp/refactor-baseline.md
```

This pins the `phase1-fragments` variant's behavior (current production pipeline shape) to a JSON snapshot before any code changes. Cost: ~$0.36 calibrated for the 24 calls (8 fixtures × 3 reruns).

If a baseline from a recent existing run is acceptable (e.g. the `tmp/phase2-comparison.json` from 2026-05-26 has `phase1-fragments` data), it MAY be reused — but only if no production-affecting changes have landed since.

### E.2 Run post-refactor verification

After Phase A-D are merged, re-run the same comparison from the new code path:

```bash
# Post-refactor (refactor branch HEAD)
ANTHROPIC_API_KEY=sk-... npx tsx experiments/spike/run-comparison.ts \
  --variants phase1-fragments \
  --reruns 3 \
  --output tmp/refactor-verification.json
```

### E.3 Comparison script: `experiments/spike/verify-refactor.ts`

**Authoring is brought forward** to immediately before the B.4 commit, because B.4/B.5/B.6 each consume this script as their per-phase spike gate (see "Per-phase spike gates for B.4, B.5, B.6" above). Phase E re-uses the same script for the final end-to-end check.

The script:

1. Loads `tmp/refactor-baseline.json` and `tmp/refactor-verification.json`.
2. Computes the pooled mean rating (all fixtures × reruns) and, per fixture, mean
   rating / stddev / parse-failure count / mean web-search count.
3. Reports PASS when:
   - |Δ pooled mean rating| ≤ 0.15 (primary signal — added during B.5)
   - and per fixture: |Δmean| ≤ 0.50 (backstop, loosened from 0.25 during B.5),
     |Δstddev| ≤ 0.25 (recalibrated from 0.05 during B.4), parse-failure delta = 0,
     |Δweb-search-count| / pre ≤ 30%

Otherwise FAIL with a per-fixture breakdown showing which axis regressed.

These thresholds are deliberately looser than statistical equivalence because production data is non-deterministic (web search results drift day-to-day). Anything tighter would produce spurious failures.

### E.4 Equivalence gate

`experiments/spike/phase1-equivalence.ts` already exists and compares the assembled prompts byte-for-byte against the v7.16.4 monolith slices. After every Phase B step that touches `prompt-assembler.ts`, fragments, or pipelines, this must PASS.

### E.5 Acceptance

The refactor is considered behaviorally safe to merge when:
- `phase1-equivalence.ts` reports PASS.
- `verify-refactor.ts` reports PASS.
- Full Jest suite passes.
- `gm:pipeline-list` and `gm:pipeline-show comics --prompt` outputs are byte-identical pre/post refactor (capture before, diff after).

If any check fails at Phase E, the default is **fix-forward**: investigate via the per-axis report, push a fix-up commit, re-run. `git revert` is reserved for catastrophic cases where the root cause isn't tractable from the spike output. (Individual B.4–B.6 phase gates also follow fix-forward — see "Per-phase spike gates" above.)

---

## Sequencing & commit boundaries

All work lands on `feat-ai-overhaul` as a single PR. Use one focused commit per step so the history is bisectable and any one step is `git revert`-able without touching the others. Run gates inline — don't batch them to the end.

| Commit | Contents | Risk | Gate after this commit |
|---|---|---|---|
| 1 | Phase A: experiments/ move | Low | `npm run build` + `npm test` + `phase1-equivalence` PASS |
| 2 | Phase B.1 (prompt-assembler ordering) | Low | snapshot test + `phase1-equivalence` PASS |
| 3 | Phase B.2 (shared zeroUsage) | Trivial | `npm test` |
| 4 | Phase B.3 (anchor-search helper) | Low | `test/postprocess-rules.test.ts` PASS |
| 5 | `verify-refactor.ts` authored (brought forward from Phase E) | Trivial | unit-test PASS against the existing baseline JSON (no API spend) |
| 6 | Phase B.4 (pipeline factory collapse) | Low-Med | `pipelines/index.test.ts` + `gm:pipeline-list` byte-identical + **per-phase spike gate** (pre = `tmp/refactor-baseline.json`, post = fresh run, `verify-refactor.ts` PASS); fix-forward on regression |
| 7 | Phase B.5 (buildUserMessage template) | Low-Med | per-category snapshot empty diff + **per-phase spike gate** (pre = B.4-post, post = fresh run); fix-forward on regression |
| 8 | Phase B.6 (raw/non-raw unification) | Medium | `npm test` + **per-phase spike gate** (pre = B.5-post, post = fresh run); fix-forward on regression |
| 9 | Phase C.1 (variant simpleVariant helper) | Low | one variant re-run, diff matches baseline |
| 10 | Phase C.2 (run script parameterization) | Low | run a wrapper, output identical |
| 11 | Phase C.3 (analyze script unification) | Low | re-generate one analysis MD, diff = empty |
| 12 | Phase D (file deletions + doc moves) | Trivial | links resolve, `npm test` |
| 13 | Phase E (final verification run) | — | `verify-refactor.ts` PASS against original Phase 0 baseline |

Per-phase spike gates at commits 6, 7, 8 plus the final Phase E run = 4 live spike runs ≈ $1.44 in addition to the $0.36 Phase 0 baseline already pinned, total ≈ $1.80.

If you'd rather not commit-per-step, group adjacent low-risk steps (e.g. commits 3+4+6 together) — but keep Phase A, B.6, and Phase E as their own commits so a bisect can localize a regression in the highest-risk areas.

## Estimated outcome

- ~1,700 LOC removed from production code (pipelines, base-agent, prompt-assembler, claude-agent, postprocess-rules, shared zeroUsage).
- ~1,300 LOC removed from experiments code (variants, run scripts, analyze scripts).
- Several documented drift hazards eliminated.
- A persistent verification harness (`verify-refactor.ts`) that can be re-run any time the AI pipeline is touched.
- Clear `src/` vs `experiments/` boundary.

## Decisions captured

- **Spike code moves to `experiments/`, not `tools/` or `tests/`.** "Spike" is the project's internal term for prompt-engineering measurement runs; "experiments" generalizes that name without losing meaning.
- **`process.ts` stays.** Reserved for forthcoming phases per user directive.
- **No `test/fixtures/samples/` changes.** Per user directive.
- **Verification uses an existing spike variant (`phase1-fragments`), not a new one.** Re-using a known-good variant means we measure the refactor against the same scoring surface the original Phase 1 used.
