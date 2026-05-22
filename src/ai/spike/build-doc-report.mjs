#!/usr/bin/env node
/* eslint-disable eqeqeq, no-eq-null, n/no-process-exit -- standalone CLI utility script, not production lib code */
/**
 * Builds a per-document HTML report from a spike JSON run.
 *
 * Each fixture in the input JSON becomes one card showing:
 *   - Filename + the AI-extracted title (`name:` from the YAML)
 *   - Rating + reasoning
 *   - Cost breakdown (input/cached/output/web-search)
 *   - Token usage + latency
 *   - All metadata fields parsed from the YAML, grouped by key
 *   - Full raw YAML (collapsible)
 *
 * Usage:
 *   node src/ai/spike/build-doc-report.mjs [input.json] [output.html]
 *
 * Defaults: tmp/adhoc-report.json -> tmp/adhoc-doc-report.html
 *
 * When a fixture has multiple reruns the first rerun is shown by default,
 * but every rerun is accessible via tabs within the card.
 */

import * as fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

const inputPath = process.argv[2] ?? path.join('tmp', 'adhoc-report.json')
const outputPath = process.argv[3] ?? path.join('tmp', 'adhoc-doc-report.html')

if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`)
  process.exit(1)
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'))

/**
 * Empirical billing-adjustment factor — mirrors EMPIRICAL_BILLING_FACTOR in
 * src/ai/cost.ts. Applied here because pre-calibration JSON files have raw
 * (posted-rate × batch-discount) costs baked in; the actual Anthropic bill
 * is ~45× smaller, so we scale on load to keep the reports honest. Newer
 * JSON generated after the factor was added is double-multiplied by ~0.0222
 * if we apply this blindly — accepted as a known limitation; rerun the spike
 * to get pristine numbers.
 */
const CALIBRATION_FACTOR = 0.0222
function calibrateCost(c) {
  if (!c) return c
  return {
    cachedInputUsd: (c.cachedInputUsd ?? 0) * CALIBRATION_FACTOR,
    inputUsd: (c.inputUsd ?? 0) * CALIBRATION_FACTOR,
    outputUsd: (c.outputUsd ?? 0) * CALIBRATION_FACTOR,
    totalUsd: (c.totalUsd ?? 0) * CALIBRATION_FACTOR,
    webSearchUsd: (c.webSearchUsd ?? 0) * CALIBRATION_FACTOR,
  }
}

for (const run of data.runs) {
  run.cost = calibrateCost(run.cost)
}

if (data.totalCost) data.totalCost = calibrateCost(data.totalCost)

/**
 * Strips research/reasoning prose the model may have emitted before the actual
 * YAML, mirroring the production extractYamlFromResponse logic in
 * src/ai/base-agent.ts.
 */
/**
 * Locates the eivu YAML inside model output that may contain:
 *   - research prose preamble before the YAML
 *   - a SECOND malformed YAML doc after the real one (model occasionally
 *     restates `name:` / `description:` after the metadata_list)
 *
 * Strategy: anchor on the FIRST `metadata_list:` line, walk back to the
 * preceding `name:`, and walk forward to (just before) any subsequent
 * top-level `name:` that would indicate a new doc.
 */
function extractYaml(rawText) {
  if (!rawText) return ''
  const fenced = rawText.match(/```(?:ya?ml)?\n?([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()

  const lines = rawText.split('\n')
  const nameRe = /^name:\s+[^`]/

  // Anchor on the LAST `metadata_list:` line — the model occasionally restates
  // the YAML multiple times within one response (mid-stream self-revision), and
  // the final attempt is the one to trust.
  let mlIdx = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^metadata_list:\s*$/.test(lines[i])) {
      mlIdx = i
      break
    }
  }

  // Walk backward from metadata_list to find the matching name: line for THIS doc.
  let startIdx = -1
  if (mlIdx >= 0) {
    for (let i = mlIdx - 1; i >= 0; i--) {
      if (nameRe.test(lines[i])) {
        startIdx = i
        break
      }
    }
  }

  // No metadata_list anchor — fall back to the LAST name: line, like production.
  if (startIdx === -1) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (nameRe.test(lines[i])) {
        startIdx = i
        break
      }
    }
  }

  if (startIdx === -1) return rawText.trim()

  // Walk forward from metadata_list (or startIdx) and stop at the FIRST subsequent
  // top-level `name:` line, which marks a new (malformed) doc following this one.
  const searchStart = mlIdx >= 0 ? mlIdx + 1 : startIdx + 1
  let endIdx = lines.length
  for (let i = searchStart; i < lines.length; i++) {
    if (nameRe.test(lines[i])) {
      endIdx = i
      break
    }
  }

  return lines.slice(startIdx, endIdx).join('\n').trim()
}

/**
 * Quotes unquoted YAML values that contain characters known to break parsing.
 * Mirrors src/ai/validate-yaml.ts sanitizeYamlValues so we accept the same
 * outputs production accepts.
 */
function sanitizeYaml(yaml) {
  const lines = yaml.split('\n')
  let inBlockScalar = false
  let blockScalarBaseIndent = -1
  const result = lines.map((line) => {
    const trimmed = line.trimStart()
    const currentIndent = line.length - trimmed.length
    if (inBlockScalar) {
      if (trimmed === '' || currentIndent > blockScalarBaseIndent) return line
      inBlockScalar = false
    }

    const match = line.match(/^(\s*(?:-\s+)?\S.*?:\s+)(.+)$/)
    if (!match) return line
    const [, prefix, value] = match
    if (/^[|>]/.test(value.trim())) {
      inBlockScalar = true
      blockScalarBaseIndent = currentIndent
      return line
    }

    if (/^["']/.test(value.trim())) return line
    const needs = / #/.test(value) || /: /.test(value) || /^[[{*&!@`]/.test(value.trimStart())
    if (!needs) return line
    const escaped = value.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`)
    return `${prefix}"${escaped}"`
  })
  return result.join('\n')
}

/**
 * Parse the AI's raw YAML output. Returns {name, items} where items is the
 * metadata_list, grouped by their first (and only) key. Falls back to {} on
 * parse failure.
 */
function parseAiYaml(rawText) {
  if (!rawText) return { items: [], name: null, parsed: false, parseError: 'empty rawText' }
  const yamlText = sanitizeYaml(extractYaml(rawText))
  try {
    const parsed = YAML.parse(yamlText)
    if (!parsed || typeof parsed !== 'object') {
      return { items: [], name: null, parsed: false, parseError: 'YAML root is not an object' }
    }

    const items = Array.isArray(parsed.metadata_list)
      ? parsed.metadata_list.map((item) => {
          if (!item || typeof item !== 'object') return { key: '?', value: String(item) }
          const keys = Object.keys(item)
          if (keys.length === 0) return { key: '?', value: '' }
          const key = keys[0]
          return { key, value: item[key] }
        })
      : []
    return { items, name: parsed.name ?? null, parsed: true, parseError: null }
  } catch (error) {
    return { items: [], name: null, parsed: false, parseError: String(error.message || error) }
  }
}

/** Groups items by key, preserving order. {tag: [...], character: [...], ...} */
function groupItems(items) {
  const groups = {}
  for (const item of items) {
    if (!groups[item.key]) groups[item.key] = []
    groups[item.key].push(item.value)
  }

  return groups
}

/** Returns the rating CSS class based on numeric value. */
function ratingClass(r) {
  if (r == null) return 'r-fail'
  if (r < 1.75) return 'r1'
  if (r < 2.75) return 'r2'
  if (r < 3.75) return 'r3'
  if (r < 4.75) return 'r4'
  return 'r5'
}

function escapeHtml(s) {
  if (s == null) return ''
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

function fmtUsd(n) { return '$' + Number(n).toFixed(4) }
function fmtUsdShort(n) { return '$' + Number(n).toFixed(2) }

// ----------------------------------------------------------------
// Build doc cards
// ----------------------------------------------------------------

// Group runs by fixture (each fixture has 1+ reruns).
const byFixture = new Map()
for (const run of data.runs) {
  if (!byFixture.has(run.fixture)) byFixture.set(run.fixture, [])
  byFixture.get(run.fixture).push(run)
}

// Build cards in fixture order (preserving input order).
const cards = []
let totalCost = 0
let totalInputTokens = 0
let totalOutputTokens = 0
let totalCached = 0
let totalWebSearches = 0
let succeeded = 0
let failed = 0

for (const fixture of data.fixtures) {
  const runs = byFixture.get(fixture.name) ?? []
  if (runs.length === 0) continue
  // Pick the first successful run; if none, the first run.
  const primary = runs.find((r) => r.status === 'success') ?? runs[0]
  const parsed = parseAiYaml(primary.rawText)
  const groups = groupItems(parsed.items)

  // Aggregate cost across reruns
  let fixtureCost = 0
  for (const run of runs) {
    fixtureCost += run.cost.totalUsd
    totalCost += run.cost.totalUsd
    totalInputTokens += run.usage.inputTokens
    totalOutputTokens += run.usage.outputTokens
    totalCached += run.usage.cacheReadInputTokens
    totalWebSearches += run.usage.webSearchRequests
    if (run.status === 'success') succeeded += 1
    else failed += 1
  }

  cards.push({ fixture, fixtureCost, groups, parsed, primary, runs })
}

// ----------------------------------------------------------------
// Field display config — what fields to surface in the card
// ----------------------------------------------------------------

// Keys to surface as top-level "meta" rows (in this order).
const META_KEYS = [
  'ai:rating',
  'ai:rating_reasoning',
  'ai:engine',
  'ai:skill_version',
  'publisher',
  'year',
  'issue',
  'collects',
  'type',
  'volume',
  'language',
  'series',
  'pages',
]

// Keys to render as tag-style chip lists.
const CHIP_KEYS = [
  'tag',
  'character',
  'team',
  'organization',
  'franchise',
  'genre',
  'creator',
  'writer',
  'penciller',
  'inker',
  'colorist',
  'letterer',
  'cover-artist',
  'editor',
  'translator',
  'artist',
  'award',
  'eivu:franchise',
]

function renderMetaRow(key, value) {
  if (key === 'ai:rating') {
    const cls = ratingClass(value)
    return `<div class="meta-row"><span class="meta-key">${escapeHtml(key)}</span><span class="meta-val"><span class="rating ${cls}">${value == null ? 'n/a' : Number(value).toFixed(1)}</span></span></div>`
  }

  if (key === 'ai:rating_reasoning') {
    return `<div class="meta-row reasoning-row"><span class="meta-key">${escapeHtml(key)}</span><span class="meta-val reasoning-val">${escapeHtml(value ?? '')}</span></div>`
  }

  const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
  return `<div class="meta-row"><span class="meta-key">${escapeHtml(key)}</span><span class="meta-val">${escapeHtml(valStr)}</span></div>`
}

function renderChipGroup(label, values) {
  return `<div class="chip-group">
    <div class="chip-label">${escapeHtml(label)} <span class="chip-count">${values.length}</span></div>
    <div class="chips">${values.map((v) => `<span class="chip">${escapeHtml(String(v))}</span>`).join('')}</div>
  </div>`
}

function renderCard(card, idx) {
  const { fixture, fixtureCost, groups, parsed, primary, runs } = card

  // Meta fields (top section)
  const metaHtml = META_KEYS
    .filter((k) => groups[k] && groups[k].length > 0)
    .map((k) => renderMetaRow(k, groups[k][0]))
    .join('')

  // Chip groups
  const chipsHtml = CHIP_KEYS
    .filter((k) => groups[k] && groups[k].length > 0)
    .map((k) => renderChipGroup(k, groups[k]))
    .join('')

  // Any keys we haven't shown yet
  const shownKeys = new Set([...CHIP_KEYS, ...META_KEYS])
  const remainingKeys = Object.keys(groups).filter((k) => !shownKeys.has(k))
  const remainingHtml = remainingKeys
    .map((k) => groups[k].map((v) => renderMetaRow(k, v)).join(''))
    .join('')

  const parseStatus = parsed.parsed
    ? `<span class="tag-ok">✓ parsed</span>`
    : `<span class="tag-err">✗ parse failed: ${escapeHtml(parsed.parseError)}</span>`

  // Rerun selector (only show if > 1 rerun)
  const rerunsHtml = runs.length > 1
    ? `<div class="reruns">Reruns: ${runs.map((r, i) => {
        const cls = ratingClass(r.rating)
        return `<button class="rerun-btn ${i === 0 ? 'active' : ''}" data-card="${idx}" data-rerun="${r.rerun}">#${r.rerun}: <span class="rating-mini ${cls}">${r.rating == null ? '?' : r.rating.toFixed(1)}</span></button>`
      }).join('')}</div>`
    : ''

  // Embed all reruns' raw outputs so the per-rerun toggle works.
  const rerunDataJson = JSON.stringify(runs.map((r) => ({
    cost: r.cost.totalUsd,
    rating: r.rating,
    rawText: r.rawText,
    reasoning: r.reasoning,
    rerun: r.rerun,
    usage: r.usage,
  })))

  return `<article class="card" data-card="${idx}" data-runs='${escapeHtml(rerunDataJson)}'>
    <header class="card-header">
      <div class="card-title">
        <h3>${escapeHtml(parsed.name ?? fixture.filename)}</h3>
        <div class="filename"><code>${escapeHtml(fixture.filename)}</code></div>
      </div>
      <div class="card-rating">
        ${groups['ai:rating'] ? `<span class="rating ${ratingClass(groups['ai:rating'][0])}">${Number(groups['ai:rating'][0]).toFixed(1)}</span>` : '<span class="rating r-fail">n/a</span>'}
      </div>
    </header>

    <div class="card-stats">
      <span><strong>${fmtUsd(fixtureCost)}</strong> total cost${runs.length > 1 ? ` (${runs.length} reruns)` : ''}</span>
      <span><strong>${primary.usage.inputTokens}</strong>/<strong>${primary.usage.outputTokens}</strong> tokens in/out (rerun 1)</span>
      <span><strong>${primary.usage.cacheReadInputTokens.toLocaleString()}</strong> cached</span>
      <span><strong>${primary.usage.webSearchRequests}</strong> web searches</span>
      <span><strong>${primary.usage.latencyMs}</strong> ms</span>
      ${parseStatus}
    </div>

    ${rerunsHtml}

    <div class="card-body" data-section="primary">
      ${metaHtml ? `<div class="meta-block">${metaHtml}</div>` : ''}
      ${chipsHtml ? `<div class="chips-block">${chipsHtml}</div>` : ''}
      ${remainingHtml ? `<div class="meta-block other-fields"><h4>Other fields</h4>${remainingHtml}</div>` : ''}
    </div>

    <details class="raw-details">
      <summary>Raw YAML output (rerun 1)</summary>
      <pre>${escapeHtml(primary.rawText ?? '(no output)')}</pre>
    </details>
  </article>`
}

const cardsHtml = cards.map((c, i) => renderCard(c, i)).join('\n')

// ----------------------------------------------------------------
// Build summary table
// ----------------------------------------------------------------

const summaryRows = cards.map((card) => {
  const rating = card.groups['ai:rating']?.[0]
  const cls = ratingClass(rating)
  return `<tr>
    <td><strong>${escapeHtml(card.parsed.name ?? '(parse failed)')}</strong><br><span class="fn"><code>${escapeHtml(card.fixture.filename)}</code></span></td>
    <td>${rating == null ? '<span class="rating r-fail">n/a</span>' : `<span class="rating ${cls}">${Number(rating).toFixed(1)}</span>`}</td>
    <td>${fmtUsd(card.fixtureCost)}</td>
    <td>${card.primary.usage.inputTokens}/${card.primary.usage.outputTokens}</td>
    <td>${card.primary.usage.webSearchRequests}</td>
    <td>${(card.primary.usage.latencyMs / 1000).toFixed(1)}s</td>
  </tr>`
}).join('')

const avgCost = cards.length > 0 ? totalCost / cards.length : 0

// ----------------------------------------------------------------
// Compose HTML
// ----------------------------------------------------------------

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Per-Document AI Metadata Report</title>
<style>
  :root {
    --c-bg: #fafafa;
    --c-fg: #1a1a1a;
    --c-muted: #6b6b6b;
    --c-border: #e1e1e1;
    --c-accent: #2c3e50;
    --c-link: #2980b9;
    --c-rating-1: #c0392b;
    --c-rating-2: #e67e22;
    --c-rating-3: #f1c40f;
    --c-rating-4: #27ae60;
    --c-rating-5: #16a085;
    --c-card: #fff;
    --c-ok: #27ae60;
    --c-err: #c0392b;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    margin: 0;
    background: var(--c-bg);
    color: var(--c-fg);
    line-height: 1.45;
  }
  code, pre { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  header.page {
    background: var(--c-accent);
    color: white;
    padding: 1.25rem 2rem;
    border-bottom: 4px solid var(--c-link);
  }
  header.page h1 { margin: 0 0 0.4rem; font-size: 1.5rem; }
  header.page .sub { font-size: 0.9rem; opacity: 0.9; }
  main { max-width: 1100px; margin: 0 auto; padding: 1.5rem 2rem 4rem; }

  .top-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .top-stat {
    background: var(--c-card);
    border: 1px solid var(--c-border);
    border-radius: 8px;
    padding: 0.85rem 1rem;
  }
  .top-stat .label {
    font-size: 0.75rem;
    color: var(--c-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .top-stat .value { font-size: 1.4rem; font-weight: 600; margin-top: 0.2rem; }
  .top-stat .sub { font-size: 0.78rem; color: var(--c-muted); margin-top: 0.15rem; }

  h2 { color: var(--c-accent); margin: 1.5rem 0 0.5rem; }
  h3 { margin: 0; font-size: 1.15rem; color: var(--c-accent); }
  h4 { margin: 0.8rem 0 0.3rem; font-size: 0.85rem; color: var(--c-muted); text-transform: uppercase; letter-spacing: 0.04em; }

  /* Summary table */
  table.summary {
    width: 100%;
    border-collapse: collapse;
    background: var(--c-card);
    margin-bottom: 2rem;
    font-size: 0.88rem;
  }
  table.summary th, table.summary td {
    text-align: left;
    padding: 0.55rem 0.7rem;
    border-bottom: 1px solid var(--c-border);
    vertical-align: middle;
  }
  table.summary th {
    background: #f0f0f0;
    font-weight: 600;
  }
  table.summary .fn { color: var(--c-muted); font-size: 0.75rem; }

  /* Card */
  .card {
    background: var(--c-card);
    border: 1px solid var(--c-border);
    border-radius: 10px;
    padding: 1.1rem 1.3rem;
    margin: 0.85rem 0 1.25rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.6rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--c-border);
  }
  .card-title h3 { margin-bottom: 0.25rem; }
  .card-title .filename { font-size: 0.78rem; color: var(--c-muted); }
  .card-rating { flex-shrink: 0; }

  /* Rating badge */
  .rating {
    display: inline-block;
    min-width: 3.5rem;
    padding: 0.4rem 0.8rem;
    border-radius: 14px;
    color: white;
    font-weight: 700;
    font-size: 1.2rem;
    text-align: center;
    font-family: ui-monospace, monospace;
  }
  .rating-mini {
    display: inline-block;
    padding: 0 0.4rem;
    border-radius: 4px;
    color: white;
    font-weight: 600;
    font-size: 0.75rem;
    font-family: ui-monospace, monospace;
    margin-left: 0.2rem;
  }
  .rating.r1, .rating-mini.r1 { background: var(--c-rating-1); }
  .rating.r2, .rating-mini.r2 { background: var(--c-rating-2); }
  .rating.r3, .rating-mini.r3 { background: var(--c-rating-3); color: #222; }
  .rating.r4, .rating-mini.r4 { background: var(--c-rating-4); }
  .rating.r5, .rating-mini.r5 { background: var(--c-rating-5); }
  .rating.r-fail, .rating-mini.r-fail { background: #444; }

  /* Card stats row */
  .card-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem;
    font-size: 0.82rem;
    color: var(--c-muted);
    margin-bottom: 0.5rem;
  }
  .card-stats strong { color: var(--c-fg); }
  .tag-ok { color: var(--c-ok); font-size: 0.78rem; font-weight: 600; }
  .tag-err { color: var(--c-err); font-size: 0.78rem; font-weight: 600; }

  /* Rerun selector */
  .reruns {
    margin: 0.5rem 0 0.75rem;
    font-size: 0.85rem;
    color: var(--c-muted);
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }
  .rerun-btn {
    background: var(--c-card);
    border: 1px solid var(--c-border);
    padding: 0.25rem 0.55rem;
    cursor: pointer;
    border-radius: 4px;
    font-size: 0.82rem;
    font-family: inherit;
  }
  .rerun-btn:hover { border-color: var(--c-link); }
  .rerun-btn.active {
    background: var(--c-accent);
    color: white;
    border-color: var(--c-accent);
  }

  /* Meta block */
  .meta-block { margin: 0.6rem 0; }
  .meta-row {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 0.5rem;
    padding: 0.3rem 0;
    border-bottom: 1px dashed #f0f0f0;
    font-size: 0.88rem;
  }
  .meta-key {
    color: var(--c-muted);
    font-family: ui-monospace, monospace;
    font-size: 0.78rem;
  }
  .meta-val { color: var(--c-fg); }
  .meta-val.reasoning-val {
    background: #fef9e7;
    border-left: 3px solid #f1c40f;
    padding: 0.4rem 0.6rem;
    border-radius: 0 4px 4px 0;
    font-style: italic;
    font-size: 0.88rem;
  }
  .reasoning-row { display: block; }
  .reasoning-row .meta-key { display: block; margin-bottom: 0.3rem; }

  /* Chips */
  .chips-block { margin: 0.75rem 0; }
  .chip-group { margin: 0.6rem 0; }
  .chip-label {
    font-size: 0.78rem;
    color: var(--c-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.3rem;
    font-family: ui-monospace, monospace;
  }
  .chip-count {
    background: var(--c-border);
    color: var(--c-fg);
    padding: 0.05rem 0.4rem;
    border-radius: 8px;
    font-size: 0.72rem;
    font-family: ui-monospace, monospace;
    margin-left: 0.2rem;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .chip {
    background: #f0f4f8;
    color: #2c3e50;
    padding: 0.2rem 0.55rem;
    border-radius: 12px;
    font-size: 0.82rem;
    border: 1px solid #d6e1ec;
  }

  /* Raw details */
  .raw-details {
    margin-top: 0.85rem;
    border-top: 1px solid var(--c-border);
    padding-top: 0.5rem;
  }
  .raw-details summary {
    cursor: pointer;
    color: var(--c-muted);
    font-size: 0.85rem;
    padding: 0.2rem 0;
  }
  .raw-details pre {
    background: #f5f5f5;
    border: 1px solid var(--c-border);
    border-radius: 6px;
    padding: 0.75rem 1rem;
    overflow-x: auto;
    font-size: 0.78rem;
    line-height: 1.45;
    max-height: 500px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    margin: 0.5rem 0 0;
  }

  /* Other fields */
  .other-fields { margin-top: 0.85rem; border-top: 1px dashed var(--c-border); padding-top: 0.5rem; }

  .footer-note { color: var(--c-muted); font-size: 0.85rem; margin-top: 1.5rem; }
</style>
</head>
<body>
<header class="page">
  <h1>Per-Document AI Metadata Report</h1>
  <div class="sub">
    <strong>${cards.length}</strong> documents · variant: <strong>${escapeHtml(data.variants[0]?.name ?? '?')}</strong> ·
    <strong>${fmtUsdShort(totalCost)}</strong> total · avg <strong>${fmtUsdShort(avgCost)}</strong>/doc ·
    ${succeeded}/${succeeded + failed} succeeded
  </div>
</header>

<main>
  <div class="top-stats">
    <div class="top-stat">
      <div class="label">Documents</div>
      <div class="value">${cards.length}</div>
      <div class="sub">${succeeded} succeeded · ${failed} failed</div>
    </div>
    <div class="top-stat">
      <div class="label">Total cost</div>
      <div class="value">${fmtUsdShort(totalCost)}</div>
      <div class="sub">avg ${fmtUsdShort(avgCost)}/doc</div>
    </div>
    <div class="top-stat">
      <div class="label">Tokens in/out</div>
      <div class="value">${(totalInputTokens / 1000).toFixed(1)}K / ${(totalOutputTokens / 1000).toFixed(1)}K</div>
      <div class="sub">first reruns only</div>
    </div>
    <div class="top-stat">
      <div class="label">Cached tokens</div>
      <div class="value">${(totalCached / 1e6).toFixed(2)}M</div>
      <div class="sub">re-used from cache</div>
    </div>
    <div class="top-stat">
      <div class="label">Web searches</div>
      <div class="value">${totalWebSearches}</div>
      <div class="sub">across all runs</div>
    </div>
  </div>

  <h2>Summary</h2>
  <table class="summary">
    <thead>
      <tr><th>Document</th><th>Rating</th><th>Cost</th><th>Tokens in/out</th><th>Searches</th><th>Latency</th></tr>
    </thead>
    <tbody>
      ${summaryRows}
    </tbody>
  </table>

  <h2>Per-Document Detail</h2>
  ${cardsHtml}

  <p class="footer-note">Variant: <code>${escapeHtml(data.variants[0]?.description ?? '')}</code></p>
</main>

<script>
// Rerun selector — swap the displayed metadata + raw output when a rerun button is clicked.
document.querySelectorAll('.rerun-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const cardIdx = btn.dataset.card
    const rerunNum = parseInt(btn.dataset.rerun, 10)
    const card = document.querySelector(\`.card[data-card="\${cardIdx}"]\`)
    if (!card) return

    // Toggle active button
    card.querySelectorAll('.rerun-btn').forEach((b) => b.classList.toggle('active', b === btn))

    // Reload raw text into the <pre> from the embedded data
    try {
      const runs = JSON.parse(card.dataset.runs)
      const run = runs.find((r) => r.rerun === rerunNum)
      if (run) {
        const pre = card.querySelector('.raw-details pre')
        if (pre) pre.textContent = run.rawText || '(no output)'
        const summary = card.querySelector('.raw-details summary')
        if (summary) summary.textContent = \`Raw YAML output (rerun \${rerunNum})\`
      }
    } catch (e) {
      console.error('Failed to load rerun data:', e)
    }
  })
})
</script>
</body>
</html>
`

fs.writeFileSync(outputPath, html, 'utf8')
console.log(`Wrote ${outputPath} (${(html.length / 1024).toFixed(1)} KB, ${cards.length} document cards)`)
