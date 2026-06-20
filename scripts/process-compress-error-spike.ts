/**
 * Manual spike: verify the `eivu process` compress stage handles a comic that FAILS to compress.
 *
 * Uses the real `@eivu/ts-comic-compress` compressor (too slow for the unit suite) against the
 * `comic_raises_exception.cbr` fixture, with the metadata + upload stages disabled (no API/env
 * needed). Confirms both `--on-compress-error` policies:
 *   - upload-original → the original is kept as the upload target
 *   - skip           → the file is dropped from the pipeline
 *
 * Usage:
 *   npx tsx scripts/process-compress-error-spike.ts
 */
import {config as loadDotenv} from 'dotenv'
import * as fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// Importing the orchestrator pulls in Client → api.config, which validates EIVU env vars at load.
// The upload stage is disabled in this spike, so dummy creds from .env.test are sufficient; real
// env (if already exported) is left untouched.
loadDotenv({path: '.env.test'})

// Dynamic import so the dotenv load above runs BEFORE the env-validating module graph is evaluated.
const {ProcessOrchestrator} = await import('../src/process-orchestrator.js')
type OnCompressError = import('../src/process-orchestrator.js').OnCompressError

const FIXTURE = 'test/fixtures/samples/comics/comic_raises_exception.cbr'

async function runCase(mode: OnCompressError): Promise<boolean> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), `proc-spike-${mode}-`))
  const copy = path.join(dir, path.basename(FIXTURE))
  await fsp.copyFile(FIXTURE, copy)

  const started = Date.now()
  // keepOriginals so a failed/zero-output run leaves the original untouched for inspection.
  const orchestrator = new ProcessOrchestrator({
    keepOriginals: true,
    metadata: false,
    onCompressError: mode,
    upload: false,
  })
  const result = await orchestrator.run(dir)
  const elapsed = Date.now() - started

  const expectedTargets = mode === 'upload-original' ? [copy] : []
  const expectedDropped = mode === 'upload-original' ? [] : [copy]
  const ok =
    JSON.stringify(result.targets) === JSON.stringify(expectedTargets) &&
    JSON.stringify(result.droppedOnError) === JSON.stringify(expectedDropped) &&
    result.compressed.length === 0

  console.log(
    `[${ok ? 'PASS' : 'FAIL'}] on-compress-error=${mode} (${elapsed}ms)\n` +
      `        targets=${JSON.stringify(result.targets.map((p) => path.basename(p)))}` +
      ` dropped=${JSON.stringify(result.droppedOnError.map((p) => path.basename(p)))}` +
      ` compressed=${result.compressed.length}`,
  )

  await fsp.rm(dir, {force: true, recursive: true})
  return ok
}

if (!fs.existsSync(FIXTURE)) {
  throw new Error(`Fixture not found: ${FIXTURE} (run from the repo root)`)
}

const results: boolean[] = []
for (const mode of ['upload-original', 'skip'] as const) {
  // eslint-disable-next-line no-await-in-loop -- sequential is fine for a 2-case spike
  results.push(await runCase(mode))
}

const allPassed = results.every(Boolean)
console.log(allPassed ? '\nAll spike cases passed ✅' : '\nSpike FAILED ❌')
process.exitCode = allPassed ? 0 : 1
