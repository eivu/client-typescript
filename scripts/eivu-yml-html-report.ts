/**
 * Render a folder of .eivu.yml files as a single HTML review page.
 *
 * Usage:
 *   npx tsx scripts/eivu-yml-html-report.ts <folder> [--out <path>] [--run-id <uuid>]
 *
 * The optional --run-id pulls cost/token/web-search totals from logs/metadata-runs.csv
 * for the matching files and surfaces them at the top of the page.
 */
import * as fastCsv from 'fast-csv'
import * as fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

import {TELEMETRY_COLUMNS, type TelemetryRow} from '../src/ai/telemetry.js'
import {validateEivuYaml} from '../src/ai/validate-yaml.js'

type RenderedFile = {
  fileName: string
  parsed: Record<string, unknown> | null
  rawYaml: string
  validationCodes: string[]
}

function readArgs(argv: string[]): {folder: string; out: string; runId: string | undefined} {
  const args = argv.slice(2)
  const positional: string[] = []
  let out = ''
  let runId: string | undefined
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--out') {
      out = args[++i]
    } else if (a === '--run-id') {
      runId = args[++i]
    } else {
      positional.push(a)
    }
  }

  if (positional.length === 0) {
    throw new Error('usage: eivu-yml-html-report.ts <folder> [--out path] [--run-id uuid]')
  }

  const folder = path.resolve(positional[0])
  return {
    folder,
    out: out || path.join(folder, 'report.html'),
    runId,
  }
}

function collectYmlFiles(folder: string): string[] {
  return fs
    .readdirSync(folder)
    .filter((f) => f.endsWith('.eivu.yml'))
    .map((f) => path.join(folder, f))
    .sort()
}

function loadYmlFiles(paths: string[]): RenderedFile[] {
  return paths.map((p) => {
    const rawYaml = fs.readFileSync(p, 'utf8')
    const fileName = path.basename(p).replace(/\.eivu\.yml$/, '')
    const result = validateEivuYaml(rawYaml)
    const validationCodes = 'errors' in result ? result.errors.map((e) => e.code) : []
    let parsed: Record<string, unknown> | null = null
    try {
      const p = YAML.parse(rawYaml)
      if (p && typeof p === 'object' && !Array.isArray(p)) parsed = p as Record<string, unknown>
    } catch {
      parsed = null
    }

    return {fileName, parsed, rawYaml, validationCodes}
  })
}

async function readTelemetryForRun(
  logPath: string,
  runId: string,
): Promise<Map<string, TelemetryRow[]>> {
  if (!fs.existsSync(logPath)) return new Map()
  const content = await fs.promises.readFile(logPath, 'utf8')
  const cellRows: string[][] = await new Promise((resolve, reject) => {
    const acc: string[][] = []
    fastCsv
      .parseString(content, {headers: false})
      .on('data', (row: string[]) => acc.push(row))
      .on('end', () => resolve(acc))
      .on('error', reject)
  })

  const get = (cells: string[], col: keyof TelemetryRow): string =>
    cells[TELEMETRY_COLUMNS.indexOf(col)] ?? ''

  const byFile = new Map<string, TelemetryRow[]>()
  for (const cells of cellRows) {
    if (cells.length < TELEMETRY_COLUMNS.length - 1) continue
    if (get(cells, 'runId') !== runId) continue
    const row: TelemetryRow = {
      attempt: Number(get(cells, 'attempt')),
      cachedInputTokens: Number(get(cells, 'cachedInputTokens')),
      cacheWriteTokens: Number(get(cells, 'cacheWriteTokens')),
      costUsd: Number(get(cells, 'costUsd')),
      file: get(cells, 'file'),
      latencyMs: Number(get(cells, 'latencyMs')),
      model: get(cells, 'model'),
      pipeline: get(cells, 'pipeline'),
      runId: get(cells, 'runId'),
      stage: Number(get(cells, 'stage')),
      status: get(cells, 'status') as TelemetryRow['status'],
      timestamp: get(cells, 'timestamp'),
      tokensIn: Number(get(cells, 'tokensIn')),
      tokensOut: Number(get(cells, 'tokensOut')),
      validationCodes: get(cells, 'validationCodes'),
      webSearches: Number(get(cells, 'webSearches')),
    }
    const arr = byFile.get(row.file) ?? []
    arr.push(row)
    byFile.set(row.file, arr)
  }

  return byFile
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * metadata_list is `Array<{key: value}>` — collect by key for grouped display
 * (multiple `tag:` entries roll up into one tag list).
 */
function groupMetadata(items: unknown): Record<string, string[]> {
  if (!Array.isArray(items)) return {}
  const out: Record<string, string[]> = {}
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    for (const [k, v] of Object.entries(item)) {
      if (v === null || v === undefined) continue
      const arr = out[k] ?? []
      arr.push(String(v))
      out[k] = arr
    }
  }

  return out
}

const PEOPLE_KEYS = [
  'writer',
  'penciller',
  'penciler',
  'inker',
  'colorist',
  'letterer',
  'cover artist',
  'cover_artist',
  'editor',
  'director',
  'producer',
  'composer',
  'conductor',
  'performer',
  'artist',
  'introduction',
]
const ORG_KEYS = ['publisher', 'studio', 'label', 'distributor']
const CLASS_KEYS = ['franchise', 'universe', 'genre', 'series', 'format', 'collects', 'pages', 'isbn']

function renderTagPills(items: string[], cls = 'pill'): string {
  return items.map((s) => `<span class="${cls}">${escapeHtml(s)}</span>`).join(' ')
}

function renderCard(f: RenderedFile, telemetry: TelemetryRow[]): string {
  const grouped = groupMetadata(f.parsed?.metadata_list)
  const name = (f.parsed?.name as string) ?? f.fileName
  const year = f.parsed?.year as number | undefined
  const description = f.parsed?.description as string | undefined
  const infoUrl = f.parsed?.info_url as string | undefined
  const collects = f.parsed?.collects as string | undefined

  const rating = grouped['ai:rating']?.[0]
  const reasoning = grouped['ai:rating_reasoning']?.[0]
  const skillVer = grouped['ai:skill_version']?.[0]
  const engine = grouped['ai:engine']?.[0]
  const cost = grouped['ai:cost']?.[0]
  const costAll = grouped['ai:cost_all']?.[0]
  const tokensIn = grouped['ai:tokens_in']?.[0]
  const tokensOut = grouped['ai:tokens_out']?.[0]

  const characters = grouped.character ?? []
  const tags = grouped.tag ?? []
  const people: Array<{role: string; name: string}> = []
  for (const k of PEOPLE_KEYS) {
    for (const name of grouped[k] ?? []) people.push({role: k.replace('_', ' '), name})
  }

  const orgs: Array<{role: string; name: string}> = []
  for (const k of ORG_KEYS) {
    for (const name of grouped[k] ?? []) orgs.push({role: k, name})
  }

  const classFields: Array<{label: string; value: string}> = []
  for (const k of CLASS_KEYS) {
    const vals = grouped[k] ?? []
    if (vals.length > 0) classFields.push({label: k, value: vals.join(', ')})
  }

  const fileTotalCost = telemetry.reduce((acc, r) => acc + r.costUsd, 0)
  const fileTotalTokens = telemetry.reduce((acc, r) => acc + r.tokensIn + r.tokensOut, 0)
  const fileWebSearches = telemetry.reduce((acc, r) => acc + r.webSearches, 0)
  const attempts = telemetry.length || 0
  const finalStatus =
    telemetry.find((r) => r.status === 'success')?.status ?? telemetry.at(-1)?.status ?? 'unknown'

  const hasValidationFailure = f.validationCodes.length > 0
  const statusBadge = hasValidationFailure
    ? `<span class="badge bad">FAIL: ${escapeHtml(f.validationCodes.join(', '))}</span>`
    : `<span class="badge ok">OK</span>`

  const ratingDisplay = rating
    ? `<div class="rating-row">
         <span class="rating-num">${escapeHtml(rating)}</span>
         <span class="rating-stars">${renderStars(Number(rating))}</span>
       </div>`
    : '<div class="rating-row muted">no ai:rating</div>'

  const reasoningBlock = reasoning
    ? `<details><summary>ai:rating_reasoning</summary><p class="reasoning">${escapeHtml(reasoning)}</p></details>`
    : ''

  const telemetrySection =
    telemetry.length > 0
      ? `<div class="telemetry">
           <span title="${attempts} API call(s)">attempts: <b>${attempts}</b></span>
           <span>final: <b>${escapeHtml(finalStatus)}</b></span>
           <span>cost: <b>$${fileTotalCost.toFixed(4)}</b></span>
           <span>tokens: <b>${fileTotalTokens.toLocaleString()}</b></span>
           <span>web searches: <b>${fileWebSearches}</b></span>
         </div>`
      : ''

  return `<article class="card" id="card-${escapeHtml(f.fileName.slice(0, 50))}">
    <header>
      <h2>${escapeHtml(name)}${year ? ` <span class="year">(${year})</span>` : ''}</h2>
      <div class="file-name">${escapeHtml(f.fileName)}</div>
      <div class="status-line">${statusBadge}${engine ? `<span class="muted">${escapeHtml(engine)}${skillVer ? ` · skill ${escapeHtml(skillVer)}` : ''}</span>` : ''}</div>
    </header>

    ${ratingDisplay}
    ${reasoningBlock}

    ${description ? `<section><h3>Description</h3><p class="description">${escapeHtml(description)}</p></section>` : ''}

    ${collects ? `<section><h3>Collects</h3><p class="muted">${escapeHtml(collects)}</p></section>` : ''}

    ${
      classFields.length > 0
        ? `<section><h3>Classification</h3>
           <dl>${classFields.map((f) => `<dt>${escapeHtml(f.label)}</dt><dd>${escapeHtml(f.value)}</dd>`).join('')}</dl>
         </section>`
        : ''
    }

    ${
      people.length > 0
        ? `<section><h3>Creators (${people.length})</h3>
           <ul class="creators">${people.map((p) => `<li><span class="role">${escapeHtml(p.role)}</span> ${escapeHtml(p.name)}</li>`).join('')}</ul>
         </section>`
        : ''
    }

    ${
      orgs.length > 0
        ? `<section><h3>Organizations</h3>
           <ul class="creators">${orgs.map((p) => `<li><span class="role">${escapeHtml(p.role)}</span> ${escapeHtml(p.name)}</li>`).join('')}</ul>
         </section>`
        : ''
    }

    ${
      characters.length > 0
        ? `<section><h3>Characters (${characters.length})</h3>
           <div class="pills">${renderTagPills(characters, 'pill char')}</div>
         </section>`
        : ''
    }

    ${
      tags.length > 0
        ? `<section><h3>Tags (${tags.length})</h3>
           <div class="pills">${renderTagPills(tags, 'pill tag')}</div>
         </section>`
        : ''
    }

    ${infoUrl ? `<section><h3>Info URL</h3><a href="${escapeHtml(infoUrl)}" target="_blank" rel="noopener">${escapeHtml(infoUrl)}</a></section>` : ''}

    ${telemetrySection}

    ${cost ? `<div class="ai-cost muted">ai:cost $${escapeHtml(cost)}${costAll && costAll !== cost ? ` · ai:cost_all $${escapeHtml(costAll)}` : ''} · tokens ${escapeHtml(tokensIn ?? '?')}/${escapeHtml(tokensOut ?? '?')}</div>` : ''}

    <details class="raw-yaml"><summary>Raw .eivu.yml</summary><pre>${escapeHtml(f.rawYaml)}</pre></details>
  </article>`
}

function renderStars(rating: number): string {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5 ? 1 : 0
  const empty = 5 - full - half
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty)
}

function renderPage(files: RenderedFile[], telemetryByFile: Map<string, TelemetryRow[]>, runId: string | undefined): string {
  const totalCost = [...telemetryByFile.values()]
    .flat()
    .reduce((acc, r) => acc + r.costUsd, 0)
  const totalTokens = [...telemetryByFile.values()]
    .flat()
    .reduce((acc, r) => acc + r.tokensIn + r.tokensOut, 0)
  const failed = files.filter((f) => f.validationCodes.length > 0).length
  const passed = files.length - failed

  const codeCounts: Record<string, number> = {}
  for (const f of files) {
    for (const c of f.validationCodes) codeCounts[c] = (codeCounts[c] ?? 0) + 1
  }

  const codeBreakdown =
    Object.keys(codeCounts).length > 0
      ? `<div class="code-breakdown"><strong>Validation codes:</strong> ${Object.entries(codeCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([c, n]) => `<span class="pill bad">${escapeHtml(c)} × ${n}</span>`)
          .join(' ')}</div>`
      : ''

  const toc = files
    .map(
      (f) =>
        `<li><a href="#card-${escapeHtml(f.fileName.slice(0, 50))}">${escapeHtml((f.parsed?.name as string) ?? f.fileName)}</a>${
          f.validationCodes.length > 0 ? ' <span class="pill bad">FAIL</span>' : ''
        }</li>`,
    )
    .join('')

  // Look up telemetry by either the absolute filepath or the basename fallback.
  function telemetryFor(file: RenderedFile): TelemetryRow[] {
    const fileNameWithExt = file.fileName // basename without .eivu.yml suffix
    for (const [k, v] of telemetryByFile.entries()) {
      if (k.endsWith(fileNameWithExt)) return v
    }

    return []
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>eivu metadata review — ${files.length} files</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #fbfaf7;
    --fg: #1d1d1f;
    --muted: #6b6b6f;
    --card: #ffffff;
    --border: #e6e3dc;
    --pill-bg: #f0eee8;
    --pill-char: #e4ecf7;
    --pill-tag: #fff3e0;
    --pill-bad: #fce4e4;
    --pill-ok: #e0f3e0;
    --link: #1968d0;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1a1a1d;
      --fg: #f4f3ef;
      --muted: #9b9ba0;
      --card: #232327;
      --border: #34343a;
      --pill-bg: #2e2e34;
      --pill-char: #1f3550;
      --pill-tag: #4a3210;
      --pill-bad: #5b1b1b;
      --pill-ok: #1f3f1f;
      --link: #7ab3ff;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); font: 14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  header.top { padding: 24px 32px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--bg); z-index: 10; }
  header.top h1 { margin: 0 0 8px 0; font-size: 20px; }
  header.top .summary { color: var(--muted); font-size: 13px; }
  header.top .code-breakdown { margin-top: 10px; }
  .layout { display: grid; grid-template-columns: 260px 1fr; gap: 0; min-height: calc(100vh - 96px); }
  nav.toc { padding: 16px; border-right: 1px solid var(--border); font-size: 13px; overflow-y: auto; position: sticky; top: 96px; max-height: calc(100vh - 96px); }
  nav.toc ol { padding-left: 20px; margin: 0; }
  nav.toc li { margin-bottom: 4px; }
  nav.toc a { color: var(--link); text-decoration: none; }
  nav.toc a:hover { text-decoration: underline; }
  main { padding: 24px 32px; max-width: 980px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 20px 24px; margin-bottom: 24px; }
  .card header { border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px; }
  .card h2 { margin: 0 0 4px 0; font-size: 18px; }
  .card h2 .year { color: var(--muted); font-weight: normal; }
  .file-name { color: var(--muted); font-size: 12px; font-family: ui-monospace,SFMono-Regular,Menlo,monospace; word-break: break-all; }
  .status-line { display: flex; gap: 10px; align-items: center; margin-top: 6px; font-size: 12px; }
  .card h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 16px 0 8px 0; }
  .card section { margin-bottom: 12px; }
  .description, .reasoning { margin: 0; white-space: pre-wrap; }
  .reasoning { color: var(--muted); font-size: 13px; padding: 8px 12px; background: var(--pill-bg); border-radius: 4px; margin-top: 6px; }
  details summary { cursor: pointer; color: var(--link); font-size: 13px; }
  details[open] summary { margin-bottom: 6px; }
  dl { display: grid; grid-template-columns: 130px 1fr; gap: 4px 12px; margin: 0; }
  dt { color: var(--muted); }
  ul.creators { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill,minmax(220px,1fr)); gap: 4px 12px; }
  ul.creators li { font-size: 13px; }
  ul.creators .role { color: var(--muted); display: inline-block; min-width: 90px; font-size: 12px; }
  .pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill { display: inline-block; padding: 3px 10px; background: var(--pill-bg); border-radius: 12px; font-size: 12px; }
  .pill.char { background: var(--pill-char); }
  .pill.tag { background: var(--pill-tag); }
  .pill.bad { background: var(--pill-bad); }
  .pill.ok { background: var(--pill-ok); }
  .badge { padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .badge.ok { background: var(--pill-ok); color: #2a5a2a; }
  .badge.bad { background: var(--pill-bad); color: #8a1f1f; }
  @media (prefers-color-scheme: dark) {
    .badge.ok { color: #b6e0b6; }
    .badge.bad { color: #f4b4b4; }
  }
  .muted { color: var(--muted); }
  .rating-row { display: flex; align-items: baseline; gap: 12px; margin: 6px 0; }
  .rating-num { font-size: 28px; font-weight: 700; }
  .rating-stars { color: #f6a500; font-size: 18px; letter-spacing: 2px; }
  .telemetry { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: var(--muted); padding: 8px 0; border-top: 1px solid var(--border); margin-top: 12px; }
  .ai-cost { font-size: 11px; margin-top: 6px; font-family: ui-monospace,SFMono-Regular,Menlo,monospace; }
  pre { background: var(--pill-bg); padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 11px; }
  a { color: var(--link); }
</style>
</head>
<body>
<header class="top">
  <h1>eivu metadata review — ${files.length} files</h1>
  <div class="summary">
    <span class="pill ok">${passed} passed</span>
    ${failed > 0 ? `<span class="pill bad">${failed} failed</span>` : ''}
    ${totalCost > 0 ? `· total cost <b>$${totalCost.toFixed(4)}</b>` : ''}
    ${totalTokens > 0 ? `· total tokens <b>${totalTokens.toLocaleString()}</b>` : ''}
    ${runId ? `· run <code>${escapeHtml(runId)}</code>` : ''}
  </div>
  ${codeBreakdown}
</header>
<div class="layout">
  <nav class="toc">
    <strong>Files</strong>
    <ol>${toc}</ol>
  </nav>
  <main>
    ${files.map((f) => renderCard(f, telemetryFor(f))).join('\n')}
  </main>
</div>
</body>
</html>`
}

async function main(): Promise<void> {
  const {folder, out, runId} = readArgs(process.argv)
  const ymlPaths = collectYmlFiles(folder)
  if (ymlPaths.length === 0) {
    console.error(`No .eivu.yml files found in ${folder}`)
    process.exit(1)
  }

  const files = loadYmlFiles(ymlPaths)
  const telemetryByFile = runId
    ? await readTelemetryForRun(path.join('logs', 'metadata-runs.csv'), runId)
    : new Map<string, TelemetryRow[]>()

  const html = renderPage(files, telemetryByFile, runId)
  fs.writeFileSync(out, html, 'utf8')
  console.log(`Wrote ${out} (${files.length} files, ${files.filter((f) => f.validationCodes.length > 0).length} failed validation)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
