# CLAUDE.md

Guide for Claude Code (and other AI coding agents) working in this repo. End-user docs live in [README.md](README.md).

## Metadata generation refactor (in progress)

The `gm:ai` pipeline is being refactored from one monolithic Claude Opus call into a modular per-stage / per-media-type pipeline. **Current state: Phase 0 complete; baseline (Opus 4.6, single-stage) chosen as Phase 2 primary; Phase 1 fragment migration landed — `ClaudeAgent` now assembles per-media-type prompts from fragments under [src/ai/prompts/claude/fragments/](src/ai/prompts/claude/fragments/), with the v7.16.4 monolith retained as the `'other'` (non-media) fallback and as a spike-compatibility option (`skillContent`/`skillPath`).** Phase 2 (pipeline + model tiering) has not started.

- **Plan**: `~/.claude/plans/i-d-like-your-help-quirky-fog.md` (see "Phase 0 — Result" and "Phase 1" sections)
- **Visual reference (open in a browser)**: [tmp/metadata-pipeline-plan.html](tmp/metadata-pipeline-plan.html)
- **Spike code**: `src/ai/spike/` (harness, variants) + `src/commands/test/spike.ts` (runner)
- **Spike reports**: [tmp/spike-report.md](tmp/spike-report.md) (original run, 5 primary variants) · [tmp/spike-confirmatory.md](tmp/spike-confirmatory.md) (baseline + `anchored-rubric-disjoint`)
- **Spike analysis & HTML report**: [tmp/spike-confirmatory-analysis.md](tmp/spike-confirmatory-analysis.md) · [tmp/spike-confirmatory-report.html](tmp/spike-confirmatory-report.html)
- **Phase 1 fragment mapping**: [tmp/phase1-fragment-mapping.md](tmp/phase1-fragment-mapping.md)
- **Phase 1 verification gate**: `npx tsx src/ai/spike/phase1-equivalence.ts` — content-equivalence diff of assembled output vs v7.16.4 slice per media type. Must report PASS.

**Phase 0 outcomes (locked in):**
- **Anchor exemplars ruled out.** Original `anchored-rubric` halved stddev (0.036 vs 0.072), but 6/8 fixtures overlapped with anchor exemplars. The confirmatory `anchored-rubric-disjoint` variant (zero overlap) tied baseline at 0.072 — the "win" was anchor-copying. No `core/scoring-anchors.md` fragment in Phase 1.
- **`FallbackProfile` ruled out.** Measured 0/48 = 0.0% end-to-end failure across both spike runs; well under the 5% threshold. In-pipeline retry-up-to-3x is sufficient. No fallback pipelines authored in Phase 2.
- **Production primary: `baseline`** (Opus 4.6, single-stage, full YAML in one call). Selected 2026-05-23 after cost reconciliation: the four-way 0.072-stddev tie became a 1-3% cost tie at calibrated rates (~$0.02/file comics, ~$0.014/file audio, ~$0.011/file video — see [src/ai/cost.ts](src/ai/cost.ts)). Baseline wins on simplicity, lowest call-shape risk, and pure-refactor Phase 1.
- **Model-tiering deferred** to a Phase 2 sub-experiment AFTER fragment migration lands. Comics stays on Opus; audio/video will be re-tested on Sonnet 4.6 once the assembled-prompt path is stable.
- **`submit_rating` tool deferred** to Phase 3+ as an optional rating-enum hardening polish (hybrid: emit YAML AND call submit_rating). Not required for Phase 2.

**Vocab to know before touching this code:**
- **`Stage`** — one Anthropic API call. Has a model, a prompt, optional web-search budget.
- **`Pipeline`** — an ordered list of stages for one media type (`comics`, `audio`, `video`, `other`).
- **`PromptAssembler`** — composes per-stage system prompts from fragments under `src/ai/prompts/claude/fragments/`. Output must be byte-identical for the same inputs (cache determinism).
- **`FallbackProfile`** — internal-only second pipeline per media type, used by `MetadataGenerator` on retry exhaustion. **Ruled out by Phase 0** (0% failure rate measured); concept preserved in the plan for future reactivation if production telemetry surfaces a real failure mode.
- **Prompt cache** — Anthropic's 5-min ephemeral cache. Smaller per-(media, stage) prompts beat today's monolith on both miss and hit pricing, but `PromptAssembler` MUST produce deterministic output or every call becomes a cache miss.

**Where to add new rules / change existing rules:** edit the per-media fragments under [src/ai/prompts/claude/fragments/](src/ai/prompts/claude/fragments/), not the v7.16.4 monolith ([src/ai/prompts/claude/EIVU_METADATA_SKILL_v7_16_4_RUNTIME.md](src/ai/prompts/claude/EIVU_METADATA_SKILL_v7_16_4_RUNTIME.md)). The monolith is now only used for the `'other'` (non-media) fallback and as a spike-compatibility input — production comics/audio/video calls go through [src/ai/prompt-assembler.ts](src/ai/prompt-assembler.ts). After editing fragments, run `npx tsx src/ai/spike/phase1-equivalence.ts` (allow-list any intentional new content there) and update the snapshot via `npx jest src/ai/prompt-assembler.test.ts -u`.

## What this repo is

`eivu-upload-client` — an oclif-based Node 18+ CLI that does three things:

1. **Upload** media files (or a folder, or a remote URL) to an Eivu backend that stores assets in S3-compatible storage (Wasabi by default).
2. **Compress** comic archives (CBZ/CBR) into smaller CBZs whose pages are WebP, via the external `@eivu/ts-comic-compress` library.
3. **Generate metadata** for media files using Claude — produces `.eivu.yml` files via the Anthropic Messages Batches API with web search enabled, validates the YAML against a schema, retries on failure, and applies a post-processing rule pipeline.

```
                       ┌──────────────────────────────┐
   eivu upload   ────► │ Client.uploadFile/Folder/    │ ──► Eivu API ──► S3 (Wasabi)
                       │ uploadRemoteFile             │
                       │   + MetadataExtraction       │
                       │   + S3Uploader               │
                       └──────────────────────────────┘

   eivu compress ────► ComicProcessor (@eivu/ts-comic-compress)
                       cbz/cbr  ──►  cbz with WebP pages

   eivu gm:ai    ────► MetadataGenerator ──► ClaudeAgent
                       │                      └──► Anthropic Batches API + Web Search
                       │  ◄── retry up to 3x on YAML validation failure
                       └──► writes  *.eivu.yml   |   failures → logs/failure.csv

   eivu gm:pp    ────► PostProcessRules ──► normalized YAML to stdout
                       (engine fix, franchise hierarchy, award tags, mechanical rules)
```

## Commands you'll run

| Command | What it does |
|---|---|
| `npm run build` | `shx rm -rf dist tsconfig.tsbuildinfo && tsc -b && tsc-alias --resolve-full-paths`. Required before running the CLI from `bin/run.js`, since oclif loads commands from `dist/commands/`. |
| `npm test` | Jest with `ts-jest`. `posttest` chains `npm run lint`. |
| `npm run lint` / `npm run lint:fix` | ESLint with the oclif config. |
| `npm run prepack` | `oclif manifest && oclif readme`. Currently a no-op for `README.md` because the auto-gen markers were removed (see Gotchas). |

## Stack

- Node `>=18.0.0`, TypeScript 5
- ESM throughout (`"type": "module"` in [package.json](package.json)); imports use `.js` extensions
- Path aliases `@src/*` and `@test/*` via `tsc-alias` ([tsconfig.json](tsconfig.json))
- oclif v4 (`@oclif/core`, `@oclif/plugin-help`, `@oclif/plugin-plugins`)
- Anthropic SDK (`@anthropic-ai/sdk`), AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`)
- axios for the Eivu REST API
- Pino for logging (pretty in dev/test, JSON in prod)
- Jest + ts-jest, `nock` for HTTP mocking, `jest-extended` matchers
- ESLint 9 with `eslint-config-oclif` + `@oclif/prettier-config`

## Layout

- [bin/run.js](bin/run.js) — oclif entry; `await execute({dir: import.meta.url})`
- [src/commands/](src/commands/) — one file per CLI command, each extending `Command` from `@oclif/core`. oclif auto-discovers from `dist/commands/` after build.
  - [src/commands/upload.ts](src/commands/upload.ts) — file/folder/URL upload
  - [src/commands/compress.ts](src/commands/compress.ts) — comic compression wrapper
  - [src/commands/generate-metadata/ai.ts](src/commands/generate-metadata/ai.ts) — AI metadata generation (alias `gm:ai`)
  - [src/commands/generate-metadata/post-process.ts](src/commands/generate-metadata/post-process.ts) — post-process pipeline (aliases `gm:post-process`, `gm:pp`)
  - [src/commands/process.ts](src/commands/process.ts) — placeholder, not wired up; do not document or rely on
  - [src/commands/test/](src/commands/test/) — internal debug commands (upload-file, upload-folder, upload-remote-file, ai)
- [src/client.ts](src/client.ts) — `Client.uploadFile`, `uploadFolder`, `uploadRemoteFile`, `bulkUpdateCloudFiles`. Owns the upload state machine (reserve → transfer → complete) and skip rules (`SKIPPABLE_EXTENSIONS`, `SKIPPABLE_FOLDERS`).
- [src/cloud-file.ts](src/cloud-file.ts) — `CloudFile` entity (md5, state, content_type, asset, metadata).
- [src/s3-uploader.ts](src/s3-uploader.ts) — multipart S3 upload via `@aws-sdk/lib-storage`.
- [src/metadata-extraction.ts](src/metadata-extraction.ts) — multi-source metadata merge: associated `.eivu.yml`, embedded ID3/EXIF, filename pattern parsing (`((tag))`, `((p performer))`, `((s studio))`, `((y year))`, ratings).
- [src/comic-archive-path.ts](src/comic-archive-path.ts) — comic path validation; throws `IncorrectFileTypeError`.
- [src/ai/](src/ai/)
  - [base-agent.ts](src/ai/base-agent.ts) — abstract base + `postProcess(yaml, model)` pipeline
  - [claude-agent.ts](src/ai/claude-agent.ts) — Anthropic Messages Batches + web search; the only working agent
  - [gemini-agent.ts](src/ai/gemini-agent.ts), [openai-agent.ts](src/ai/openai-agent.ts) — stubs, not implemented
  - [metadata-generator.ts](src/ai/metadata-generator.ts) — agent factory, file iteration, retry-on-validation-failure (max 3), CSV failure logging
  - [postprocess-rules.ts](src/ai/postprocess-rules.ts), [validate-yaml.ts](src/ai/validate-yaml.ts), [award-tags.ts](src/ai/award-tags.ts), [franchise-hierarchy.ts](src/ai/franchise-hierarchy.ts)
  - [prompts/claude/](src/ai/prompts/claude/) — system prompts and skill content
- [src/services/api.config.ts](src/services/api.config.ts) — pre-auth axios instances (`api`, `check`) with `ECONNREFUSED` interceptor that throws "EIVU OFFLINE".
- [src/env.ts](src/env.ts) — `getEnv()` validates all required env vars on first call and caches; `resetEnv()` for tests.
- [src/logger.ts](src/logger.ts) — single shared pino logger.
- [src/utils.ts](src/utils.ts) — `validateFilePath`, `validateDirectoryPath`, MD5, `isOnline`, `isEivuYmlFile`, glob helpers, CSV writing.
- [src/types/](src/types/) — `cloud-file.ts`, `cloud-file-type.ts`, `artist.ts`, `release.ts`, `user.ts`.
- [test/](test/) — Jest tests; mostly flat (`test/<name>.test.ts`). Fixtures in [test/fixtures/](test/fixtures/). Some command tests under [test/commands/](test/commands/). HTTP mocked with `nock`.

## Conventions

- **ESM imports** use `.js` extensions even for `.ts` source files; `tsc-alias` rewrites `@src/*` paths post-build.
- **Path safety** — all user-supplied file paths flow through `validateFilePath` / `validateDirectoryPath` in [src/utils.ts](src/utils.ts) (rejects `..`, paths outside CWD, non-existent files). Preserve this perimeter when adding commands.
- **Concurrency** is bounded with `p-limit`. Don't fan out unbounded parallel uploads or AI calls.
- **Logging** uses the shared pino logger from [src/logger.ts](src/logger.ts). Don't `console.log` in `src/`. Inside oclif `Command.run`, `this.log` is fine for direct CLI output.
- **AI agents** follow a strategy pattern: extend `BaseAgent`, register in the factory in [src/ai/metadata-generator.ts](src/ai/metadata-generator.ts).
- **Env access** goes through `getEnv()` from [src/env.ts](src/env.ts), never direct `process.env.*` in `src/` (except in `env.ts` itself and the `ANTHROPIC_API_KEY` read in the `gm:ai` command, which is optional).

## Adding a new command

1. Create `src/commands/<name>.ts` (or a topic folder like `src/commands/<topic>/<name>.ts`).
2. Extend `Command` from `@oclif/core`. Declare `static args`, `static flags`, `static description`, `static examples`, optional `static aliases`, and an async `run()`.
3. Inside `run()`: `const {args, flags} = await this.parse(<ClassName>)` then implement the command.
4. Add a Jest test in `test/` (e.g. `test/<name>.test.ts`).
5. After `npm run build`, oclif auto-discovers the new command from `dist/commands/`.

## Testing

- Run `npm test` (Jest with coverage). `posttest` runs `npm run lint`.
- Tests live in [test/](test/) mirroring `src/`. Use `nock` for HTTP, `jest-extended` for matchers.
- CI matrix: `lts/-1`, `lts/*`, `latest` on Ubuntu — see [.github/workflows/test.yml](.github/workflows/test.yml). CI installs `libchromaprint-tools` (provides `fpcalc`), used by `music-metadata` for audio fingerprinting. Locally on macOS: `brew install chromaprint`.

## External services

- **Eivu upload server** — REST API at `${EIVU_UPLOAD_SERVER_HOST}/api/upload/v1/buckets/${EIVU_BUCKET_UUID}/`, auth header `Token ${EIVU_USER_TOKEN}`. See [src/services/api.config.ts](src/services/api.config.ts).
- **S3-compatible storage** — Wasabi by default, configured via `EIVU_ENDPOINT` / `EIVU_REGION` / `EIVU_ACCESS_KEY_ID` / `EIVU_SECRET_ACCESS_KEY` / `EIVU_BUCKET_NAME`.
- **Anthropic Claude** — model `claude-opus-4-6`, Messages Batches API + web search tool. Requires `ANTHROPIC_API_KEY` for the `gm:ai` command only.

## Gotchas

- `oclif readme` auto-generation has been intentionally disabled by removing the `<!-- toc -->` / `<!-- usage -->` / `<!-- commands -->` markers from [README.md](README.md). The README is hand-authored. Don't reintroduce those markers — `oclif readme` will rewrite them on `npm version` / `npm prepack`.
- [src/commands/process.ts](src/commands/process.ts) is a stub on the `feat-process` branch. Not wired to functionality.
- `GeminiAgent` and `OpenAIAgent` in [src/ai/](src/ai/) are skeletons. Only `ClaudeAgent` is functional.
- Top-level `rating` in `.eivu.yml` is **deprecated**. New AI generation emits `ai:rating` inside `metadata_list` instead.
- `getEnv()` validates **all** required env vars up front and throws if any are missing — there's no "lazy" path. When writing tests that don't need real env vars, mock the env or use [.env.test](.env.test).
- The `nsfw` flag on `eivu upload` auto-implies `secured` — see [src/commands/upload.ts](src/commands/upload.ts:23).
- `compress` command's positional arg is named `pathArg`, not `path` (the rest are `path`). If you're scripting against it, that matters.

## Deep dives

- [docs/client.md](docs/client.md) — `Client` class internals
- [docs/cloud-file.md](docs/cloud-file.md) — `CloudFile` entity
- [docs/metadata-generator.md](docs/metadata-generator.md) — AI metadata pipeline
- [EIVU_METADATA_AI_GUIDE.md](EIVU_METADATA_AI_GUIDE.md) — full `.eivu.yml` spec for AI generation (the source of truth for what AI agents emit)

## Persistent memory

A persistent memory store for this project lives at `~/.claude/projects/-Users-jinx-projects-eivu-client-typescript/memory/` with an index at `MEMORY.md`. Future Claude Code sessions auto-load it; check there for prior decisions, user preferences, and project context that aren't in this repo.
