# Refactor Kickoff Prompt

Paste the block below into a fresh Claude Code session at the repo root (`/Users/jinx/projects/eivu/client-typescript`). It's self-contained — the executor doesn't need this conversation's history.

---

## Prompt to paste

You are picking up a refactor on the `feat-ai-overhaul` branch of an oclif Node CLI for `@eivu/upload-client`. The branch landed a working but copy-paste-heavy AI metadata pipeline; your job is to consolidate the duplication into reusable primitives **without changing observable behavior**, separate experimental code from production code, and verify equivalence at the end.

**All work lands on the current `feat-ai-overhaul` branch as a single PR.** Do not create new branches; do not split into multiple PRs. Use one focused commit per step so history is bisectable. Do not push or open the PR until I confirm.

**The full plan lives at [docs/refactor-plan.md](refactor-plan.md). Read it first.** It contains rationale, phase ordering, file-by-file specs, and acceptance criteria. This prompt is the executable summary.

### Project context (read these too)

- [CLAUDE.md](../CLAUDE.md) — repo conventions, ESM rules, oclif specifics, the metadata-pipeline overview.
- [src/ai/pipelines/](../src/ai/pipelines/) and [src/ai/base-agent.ts](../src/ai/base-agent.ts) — primary refactor targets.
- [src/ai/spike/](../src/ai/spike/) — being moved to `experiments/spike/`.
- [src/ai/prompt-assembler.ts](../src/ai/prompt-assembler.ts) — the prompt-cache determinism contract lives here; any change MUST keep assembled output byte-identical per `(media-type, model)`.

### Hard constraints

1. **DO NOT modify [src/commands/process.ts](../src/commands/process.ts).** It's reserved for forthcoming phases. The CLAUDE.md note calling it a "stub on feat-process branch" is stale — update the doc text, but leave the file untouched.
2. **DO NOT modify any file under [test/fixtures/samples/](../test/fixtures/samples/).** Even if a binary looks unused, leave it.
3. **DO NOT change telemetry CSV columns.** `logs/metadata-runs.csv` is append-only; existing column order in [src/ai/telemetry.ts](../src/ai/telemetry.ts) is a wire format.
4. **DO NOT modify fragment markdown content** under `src/ai/prompts/claude/fragments/`. Content is locked; only the assembly path can change.
5. **DO NOT rename CLI commands or oclif aliases.** Users have these in muscle memory and CI.
6. **DO NOT commit anything** unless I explicitly say to. Show diffs and pause.

### Tasks in order (one PR per group)

**Step 0 — Pin the verification baseline (DO THIS FIRST, before any code change).**

```bash
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY npx tsx src/ai/spike/run-phase1-comparison.ts
cp tmp/phase1-comparison.json tmp/refactor-baseline.json
cp tmp/phase1-comparison.md   tmp/refactor-baseline.md
```

Cost ~$0.36 calibrated. If the user objects to spending, ask before proceeding.

**Step 1 — Phase A: experiments/ reorganization.**

- Create `experiments/` at the repo root, sibling to `src/`.
- `git mv src/ai/spike experiments/spike` (preserves history).
- Add `@experiments/*` TS path alias to [tsconfig.json](../tsconfig.json) mirroring `@src/*`; ensure `tsc-alias` resolves it.
- Update [jest.config.js](../jest.config.js) module-mapper.
- Update every `@src/ai/spike/` import to `@experiments/spike/` (and the moved files' relative imports back into `@src/ai/...` stay the same).
- Update [CLAUDE.md](../CLAUDE.md) references from `src/ai/spike/` to `experiments/spike/` (plan section, file links, verification gate command, follow-up commands printed by spike runners).
- Verify: `npm run build`, `npm test`, `npx tsx experiments/spike/phase1-equivalence.ts` PASS, and one tiny live spike call (`npx tsx experiments/spike/run-phase1-comparison.ts` with a 1-fixture filter if supported, else accept the full run cost).

**Step 2 — Phase B production DRY (groups of related changes).**

- B.1: single ordering source in `prompt-assembler.ts`. Both `assemble()` and `fragmentsFor()` read from one ordered-list generator.
- B.2: shared `zeroUsage()` exported from [src/ai/types.ts](../src/ai/types.ts); call from `ClaudeAgent.emptyUsage`, `MetadataGenerator.emitTelemetry` fallback, and (after the move) `experiments/spike/skill-loader.ts`.
- B.3: `findAiAnchor(lines, preference)` helper in [src/ai/postprocess-rules.ts](../src/ai/postprocess-rules.ts). The four rules keep their splice logic; only anchor search + indent derivation is shared.
- B.4: collapse `src/ai/pipelines/{audio,comics,video,other}.ts` into a config-driven `buildPipeline(name, options)`. `buildAllPipelines()` signature unchanged. Preserve per-pipeline JSDoc rationale at config rows.
- B.5: `buildUserMessage` template + per-media step-config table in [src/ai/base-agent.ts](../src/ai/base-agent.ts).
- B.6: unify raw vs non-raw method pairs in [src/ai/claude-agent.ts](../src/ai/claude-agent.ts) (`processRequests/Raw`, `submitAndPollBatch/Raw`, `collectResults/Raw`, `parseRawSuccess`/`extractUsage`). Single internal `runBatch<T>(requests, collect)` plus a single `parseUsage()`.

After each of B.1, B.4, B.5: re-run `experiments/spike/phase1-equivalence.ts` PASS.

**Per-phase spike gates (B.4, B.5, B.6 only).** Before B.4 begins, author `experiments/spike/verify-refactor.ts` (originally a Phase E deliverable; bring it forward). Then for B.4, B.5, and B.6 — and only those three phases — gate each commit with a live spike comparison:

- Variant: `phase1-fragments`. Fixtures: the 8 in `experiments/spike/fixtures.ts`. Reruns: 3. 24 calls per run, ~$0.36 each.
- Thresholds (same as Phase E), recalibrated during B.4/B.5 for n=3 reruns: **primary** `|Δ pooled mean rating| ≤ 0.15` (all fixtures × reruns; added B.5); per fixture `|Δmean| ≤ 0.50` (backstop, loosened from 0.25 in B.5), `|Δstddev| ≤ 0.25` (recalibrated from 0.05 in B.4), parse-failure delta = 0, `|Δweb-search-count| / pre ≤ 30%`. See plan for the n=3-quantum rationale.
- Pre/post reuse: B.4-pre = Phase 0 baseline (`tmp/refactor-baseline.json`). B.5-pre = B.4-post. B.6-pre = B.5-post. One fresh post-spike per phase.
- **Regression handling: fix-forward.** Stay on the failing-phase commit, investigate via the per-axis report, push a fix-up commit on top, re-run. The phase is not complete until the gate passes. Do NOT `git revert` unless the root cause is intractable from the spike output.
- B.1/B.2/B.3 are exempt from the spike gate (their existing equivalence/unit-test gates are sufficient).
- Total per-phase + Phase E spike spend: 4 × $0.36 ≈ $1.44 (on top of the $0.36 Phase 0 baseline).

**Step 3 — Phase C experiments DRY (in `experiments/spike/`).**

- C.1: `simpleVariant({name, description, buildAgent})` helper in `experiments/spike/variant-runner.ts`. Refactor 7 boilerplate-shaped variants to use it (`baseline`, `anchored-rubric`, `anchored-rubric-disjoint`, `phase1-fragments`, `phase2-opus-4-7`, `phase2-sonnet-non-comics`, `phase2-haiku-non-comics`). Leave `multi-sample`, `structured-output`, `two-stage`, `haiku-comics-research` custom. One file per variant — keep historical JSDoc.
- C.2: parameterize `run-phase1-comparison`, `run-phase2-comparison`, `run-phase2-haiku-comparison` against one shared `run-comparison.ts`. The three original scripts become 5-line wrappers preserved for compat.
- C.3: same for the three `analyze-*` scripts — collapse into one `analyze-comparison.ts` taking `--input/--output/--control/--title`.

**Step 4 — Phase D cleanup.**

Tracked deletions:
- `test/commands/hello/foo.ts`, `index.test.ts`, `world.test.ts` (oclif starter placeholders).
- `src/ai/prompts/claude/archive/EIVU_METADATA_SKILL_v7_16_{1,2,3}_RUNTIME.md` (superseded, no code references).

Tracked moves:
- `EIVU_METADATA_AI_GUIDE.md` → `docs/eivu-metadata-ai-guide.md`. Update links in [CLAUDE.md](../CLAUDE.md) and [README.md](../README.md).

Doc updates:
- Update the CLAUDE.md line about `src/commands/process.ts` to say it's reserved for a forthcoming phase (NOT delete the file — see constraint #1).
- Add a short note in CLAUDE.md describing [scripts/eivu-yml-html-report.ts](../scripts/eivu-yml-html-report.ts) and its `--run-id` flag so it doesn't get re-discovered/duplicated.

Working-tree cleanup (not committed, but run once):
```bash
find src test -type d -name dist -exec rm -rf {} +
find . -name .DS_Store -not -path './node_modules/*' -delete
```

**Step 5 — Phase E verification (REQUIRED before declaring done).**

- Re-run the same baseline spike from the new location:
  ```bash
  ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY npx tsx experiments/spike/run-phase1-comparison.ts
  cp tmp/phase1-comparison.json tmp/refactor-verification.json
  ```
- Write `experiments/spike/verify-refactor.ts` (NEW file) that:
  1. Loads `tmp/refactor-baseline.json` and `tmp/refactor-verification.json`.
  2. Per-fixture computes Δmean rating, Δstddev, parse-failure delta, Δmean web-searches.
  3. Reports PASS when |Δ pooled mean rating| ≤ 0.15 (primary, added B.5) and per fixture |Δmean| ≤ 0.50 (backstop, loosened from 0.25 in B.5), |Δstddev| ≤ 0.25 (recalibrated from 0.05 in B.4), parse-failure delta = 0, |Δweb-searches| / pre ≤ 30%.
  4. Otherwise prints a per-fixture per-axis breakdown showing which regressed.
- Run `npx tsx experiments/spike/verify-refactor.ts`. Report the result.
- Capture `gm:pipeline-list` and `gm:pipeline-show comics --prompt` output pre/post; diff must be empty.

### What "done" means

All of the following hold simultaneously:
- `npm test` PASS, `npm run lint` PASS, `npm run build` succeeds.
- `npx tsx experiments/spike/phase1-equivalence.ts` PASS.
- `npx tsx experiments/spike/verify-refactor.ts` PASS.
- `gm:pipeline-list` and `gm:pipeline-show <each>` outputs are byte-identical to a pre-refactor snapshot.
- [docs/refactor-plan.md](refactor-plan.md) is updated with any deviations you made (e.g. if a constraint forced you to skip a step).

### If anything goes wrong

- A step's gate fails → STOP, do not move to the next step. Investigate via the per-axis report from `verify-refactor.ts` (Phase E) or the failing unit test. The commit boundaries are deliberately small so a `git revert <hash>` localizes the regression.
- An import refuses to resolve after the move → check `tsconfig.json` paths, `jest.config.js` moduleNameMapper, and `tsc-alias` config.
- A test that was passing before now fails → `git revert` the most recent commit first, confirm green, then re-attempt with the failure information in hand. Do not amend prior commits to "fix" a later failure.

### Communication style

- Show diffs before applying.
- **Single PR on `feat-ai-overhaul`. One focused commit per step.** Don't squash steps together — commit-per-step keeps a bisect cheap. Phase A, Phase B.6, and Phase E in particular MUST be their own commits.
- Do not push or open the PR until I confirm at the end of Phase E.
- Don't summarize what I can read from `git diff`.
- Tell me cost before any spike run.
- Pause for confirmation before:
  - Running a live spike against the Anthropic API
  - `git mv` on a large directory
  - Deleting any tracked file

Begin with Step 0.
