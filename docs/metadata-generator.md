# MetadataGenerator

The **MetadataGenerator** class generates `.eivu.yml` metadata files for media files (comics, audio, video, etc.) using an AI agent. It supports multiple providers (Claude, Gemini, OpenAI) and can process many files in one run, optionally skipping files that already have metadata.

## Overview

- **Location:** `src/ai/metadata-generator.ts`
- **Import:** `import { MetadataGenerator } from '@src/ai/metadata-generator'` or `import { MetadataGenerator } from '@src/ai'`

The generator:

- Builds a list of requests (one per file) and optionally skips files that already have a `.eivu.yml` when `overwrite` is `false`.
- Sends requests to the configured AI agent (batch API where supported).
- Writes the returned YAML to `{filePath}.eivu.yml` and returns a result per file (success, skipped, or error).

## Basic usage

### Static method (no instance)

```ts
import { MetadataGenerator } from '@src/ai/metadata-generator'

const results = await MetadataGenerator.generate(
  ['/path/to/comic.cbr', '/path/to/song.mp3'],
  {
    apiKey: process.env.ANTHROPIC_API_KEY,
    agent: 'claude',
    overwrite: false,
  },
)

for (const r of results) {
  if (r.status === 'success') console.log('Wrote', r.outputPath)
  if (r.status === 'skipped') console.log('Skipped', r.filePath)
  if (r.status === 'error') console.error(r.filePath, r.error)
}
```

### Instance method

```ts
const generator = new MetadataGenerator({
  apiKey: process.env.ANTHROPIC_API_KEY,
  agent: 'claude',
  overwrite: false,
  skillContent: '# EIVU Metadata Runtime ...', // optional; or use skillPath
})

const results = await generator.generate([
  '/path/to/file1.cbr',
  '/path/to/file2.mp3',
])
```

## Options (MetadataGeneratorOptions)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agent` | `'claude' \| 'gemini' \| 'openai'` | `'claude'` | Which AI provider to use. |
| `overwrite` | `boolean` | `false` | If `false`, files that already have a `.eivu.yml` are skipped. |
| `apiKey` | `string` | — | API key for the chosen provider (e.g. Anthropic, OpenAI, Google). |
| `model` | `string` | provider-specific | Model name (e.g. `claude-sonnet-4-20250514` for Claude). |
| `maxTokens` | `number` | provider-specific | Max tokens per response. |
| `skillContent` | `string` | — | Full text of the EIVU metadata skill/runtime (system prompt). |
| `skillPath` | `string` | default path | Path to the skill markdown file (used if `skillContent` not set). |
| `onProgress` | `(progress: BatchProgress) => void` | — | Optional callback for batch progress (Claude batch API). |
| `pollIntervalMs` | `number` | — | Polling interval for batch completion (Claude). |

For Claude, if you don’t pass `skillContent`, the generator loads the skill from `skillPath` (defaults to a path under `src/ai/prompts/claude/`).

## Output

- **Output path:** For each input file path `filePath`, the metadata file is written to `filePath + '.eivu.yml'` (e.g. `comic.cbr` → `comic.cbr.eivu.yml`).
- **Return value:** `Promise<GenerationResult[]>` where each item has:
  - `filePath`: original path
  - `outputPath`: path of the `.eivu.yml` file
  - `status`: `'success'` | `'skipped'` | `'error'`
  - `yaml?`: generated YAML (when `status === 'success'`)
  - `error?`: error message (when `status === 'error'`)

## Skipping behavior

When `overwrite` is `false`:

- For each input path, the generator checks if `{filePath}.eivu.yml` already exists.
- If it exists, that file is not sent to the agent and the result is `{ status: 'skipped', filePath, outputPath }`.
- If it does not exist, the file is processed and the result is either success or error.

When `overwrite` is `true`, existing `.eivu.yml` files are overwritten.

## Agent types

- **claude**: Uses Anthropic Messages API (with batching where supported). Requires `apiKey` (Anthropic). Default model and skill path are set in `ClaudeAgent`.
- **openai**: OpenAI agent; `processRequests` may throw “not yet implemented” depending on the codebase.
- **gemini**: Google Gemini agent; same caveat as OpenAI for full support.

Use the `agent` option and the corresponding `apiKey` (and optionally `model` / `maxTokens`) for the provider you want.

## Errors

- Missing or invalid paths: the generator does not validate file existence for the *media* file; it only checks for existing `.eivu.yml` when `overwrite` is false. Write errors (e.g. permission, disk full) are reported in the result with `status: 'error'` and `error` message.
- Agent/API errors: per-request failures are returned as results with `status: 'error'` and `error` set; they don’t necessarily throw unless the whole flow fails.
- Unknown agent type: `createAgent` throws if `agent` is not one of the supported values.

## Example: integrate with Client

After generating metadata, you can update cloud files from the same folder using `Client.bulkUpdateCloudFiles`:

```ts
import { MetadataGenerator } from '@src/ai/metadata-generator'
import { Client } from '@src/client'

const filePaths = ['/queue/comic1.cbr', '/queue/comic2.cbr']
const results = await MetadataGenerator.generate(filePaths, {
  apiKey: process.env.ANTHROPIC_API_KEY,
  overwrite: false,
})

const successPaths = results.filter((r) => r.status === 'success').map((r) => r.outputPath)
// Then ensure the folder containing these .eivu.yml files is passed to bulkUpdateCloudFiles
await Client.bulkUpdateCloudFiles({ pathToFolder: '/queue' })
```
