#!/usr/bin/env node
/* eslint-disable n/no-process-exit -- standalone CLI utility script, not production lib code */
/**
 * Builds a self-contained HTML explorer for a Phase 0 spike report.
 *
 * Usage:
 *   node src/ai/spike/build-explorer.mjs [input.json] [output.html]
 *
 * Defaults: tmp/spike-report.json → tmp/spike-explorer.html
 *
 * The output is a single HTML file with the spike's raw JSON embedded,
 * so it works offline and is fully portable.
 */

import * as fs from 'node:fs'
import path from 'node:path'

const inputPath = process.argv[2] ?? path.join('tmp', 'spike-report.json')
const outputPath = process.argv[3] ?? path.join('tmp', 'spike-explorer.html')

if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`)
  process.exit(1)
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'))

/**
 * Cost calibration is applied INSIDE `src/ai/cost.ts:computeCost()` before
 * costs land in the JSON, so this script does NOT scale costs again. A
 * previous version applied a 0.0222 factor here on top of the already-calibrated
 * JSON values, double-discounting Opus 4.6 costs by ~45×.
 *
 * If you need to re-render an OLD pre-calibration JSON (anything generated
 * before src/ai/cost.ts started applying EMPIRICAL_BILLING_FACTOR), multiply
 * the loaded costs by the JSON's-era factor manually before passing to this
 * script.
 */

const dataJson = JSON.stringify(data)

if (dataJson.includes('</script>')) {
  console.error('Refusing to embed: JSON contains </script> sequence that would break the page.')
  process.exit(1)
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Phase 0 Spike Explorer</title>
<style>
  :root {
    --c-bg: #fafafa;
    --c-fg: #1a1a1a;
    --c-muted: #6b6b6b;
    --c-border: #e1e1e1;
    --c-accent: #2c3e50;
    --c-link: #2980b9;
    --c-success: #16a085;
    --c-rating-1: #c0392b;
    --c-rating-2: #e67e22;
    --c-rating-3: #f1c40f;
    --c-rating-4: #27ae60;
    --c-rating-5: #16a085;
    --c-err: #c0392b;
    --c-warn: #e67e22;
    --c-ok: #27ae60;
    --c-card: #fff;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    margin: 0;
    background: var(--c-bg);
    color: var(--c-fg);
    line-height: 1.5;
  }
  code, pre, .mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  header {
    background: var(--c-accent);
    color: white;
    padding: 1.25rem 2rem;
    border-bottom: 4px solid var(--c-link);
  }
  header h1 { margin: 0 0 0.25rem; font-size: 1.5rem; }
  header .sub { font-size: 0.9rem; opacity: 0.85; }
  header .sub strong { color: #fff; }
  nav.tabs {
    display: flex;
    background: var(--c-card);
    border-bottom: 1px solid var(--c-border);
    padding: 0 2rem;
    overflow-x: auto;
  }
  nav.tabs button {
    background: none;
    border: none;
    padding: 0.85rem 1.1rem;
    cursor: pointer;
    font-size: 0.95rem;
    color: var(--c-muted);
    border-bottom: 3px solid transparent;
    font-family: inherit;
    white-space: nowrap;
  }
  nav.tabs button:hover { color: var(--c-fg); }
  nav.tabs button.active {
    color: var(--c-accent);
    border-bottom-color: var(--c-link);
    font-weight: 600;
  }
  main { padding: 1.5rem 2rem 4rem; max-width: 1400px; margin: 0 auto; }
  .panel { display: none; }
  .panel.active { display: block; }

  h2 { margin: 0 0 0.75rem; font-size: 1.3rem; color: var(--c-accent); }
  h3 { margin: 1.25rem 0 0.5rem; font-size: 1.05rem; color: var(--c-accent); }

  /* Stat grid */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
    margin: 1rem 0 1.5rem;
  }
  .stat {
    background: var(--c-card);
    border: 1px solid var(--c-border);
    border-radius: 8px;
    padding: 0.9rem 1rem;
  }
  .stat .label { font-size: 0.78rem; color: var(--c-muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .stat .value { font-size: 1.5rem; font-weight: 600; margin-top: 0.25rem; }
  .stat .sub { font-size: 0.8rem; color: var(--c-muted); margin-top: 0.2rem; }

  /* Variant cards */
  .variant-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 0.85rem;
    margin: 0.75rem 0 1.5rem;
  }
  .variant-card {
    background: var(--c-card);
    border: 1px solid var(--c-border);
    border-radius: 8px;
    padding: 0.9rem 1rem;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .variant-card:hover {
    border-color: var(--c-link);
    box-shadow: 0 2px 8px rgba(41, 128, 185, 0.1);
  }
  .variant-card .name { font-weight: 600; color: var(--c-link); margin-bottom: 0.25rem; }
  .variant-card .desc { font-size: 0.85rem; color: var(--c-muted); margin-bottom: 0.5rem; }
  .variant-card .metrics { display: flex; gap: 0.5rem; flex-wrap: wrap; font-size: 0.8rem; }
  .variant-card .metric { background: #f3f3f3; padding: 0.15rem 0.4rem; border-radius: 4px; }
  .variant-card.winner { border-color: var(--c-success); border-width: 2px; }
  .variant-card.winner::after { content: "✓ winner"; color: var(--c-success); font-size: 0.75rem; float: right; font-weight: 600; }

  /* Fixture picker */
  .picker {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin: 0.5rem 0 1rem;
  }
  .picker button {
    background: var(--c-card);
    border: 1px solid var(--c-border);
    padding: 0.4rem 0.7rem;
    cursor: pointer;
    border-radius: 16px;
    font-size: 0.82rem;
    color: var(--c-fg);
    font-family: inherit;
  }
  .picker button:hover { border-color: var(--c-link); }
  .picker button.active {
    background: var(--c-accent);
    color: white;
    border-color: var(--c-accent);
  }

  /* Rating badge */
  .rating {
    display: inline-block;
    min-width: 2.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    color: white;
    font-weight: 600;
    font-size: 0.85rem;
    text-align: center;
    font-family: ui-monospace, monospace;
  }
  .rating.r1 { background: var(--c-rating-1); }
  .rating.r2 { background: var(--c-rating-2); }
  .rating.r3 { background: var(--c-rating-3); color: #222; }
  .rating.r4 { background: var(--c-rating-4); }
  .rating.r5 { background: var(--c-rating-5); }
  .rating.r-fail { background: #444; }

  /* Per-fixture grid */
  .compare-grid {
    display: grid;
    grid-template-columns: 180px repeat(3, 1fr);
    gap: 0.4rem;
    margin: 0.75rem 0 1.5rem;
  }
  .compare-grid > div {
    background: var(--c-card);
    border: 1px solid var(--c-border);
    border-radius: 6px;
    padding: 0.5rem 0.7rem;
    font-size: 0.85rem;
  }
  .compare-grid .header-cell {
    background: var(--c-accent);
    color: white;
    text-align: center;
    font-weight: 600;
  }
  .compare-grid .variant-label {
    background: #f0f0f0;
    font-weight: 600;
    color: var(--c-accent);
    display: flex;
    align-items: center;
  }
  .compare-grid .run-cell {
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .compare-grid .run-cell:hover { border-color: var(--c-link); }
  .compare-grid .run-cell .top { display: flex; justify-content: space-between; align-items: center; }
  .compare-grid .run-cell .samples { font-size: 0.7rem; color: var(--c-muted); margin-top: 0.25rem; }

  /* Reasoning compare */
  .reasoning-compare {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 0.85rem;
    margin: 1rem 0;
  }
  .reasoning-block {
    background: var(--c-card);
    border: 1px solid var(--c-border);
    border-radius: 6px;
    padding: 0.7rem 0.9rem;
    font-size: 0.85rem;
  }
  .reasoning-block .variant-name {
    font-weight: 600;
    color: var(--c-link);
    margin-bottom: 0.4rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .reasoning-block .text {
    color: var(--c-fg);
    max-height: 200px;
    overflow-y: auto;
    border-top: 1px solid var(--c-border);
    padding-top: 0.5rem;
  }

  /* Variant detail table */
  table.runs {
    width: 100%;
    border-collapse: collapse;
    background: var(--c-card);
    margin: 0.75rem 0 1.5rem;
    font-size: 0.85rem;
  }
  table.runs th, table.runs td {
    text-align: left;
    padding: 0.55rem 0.7rem;
    border-bottom: 1px solid var(--c-border);
  }
  table.runs th { background: #f0f0f0; font-weight: 600; }
  table.runs td.r { cursor: pointer; }
  table.runs td.r:hover { background: #f7f7f7; }
  table.runs .fix-name { color: var(--c-muted); font-size: 0.78rem; }

  /* Agreement matrix */
  table.matrix {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background: var(--c-card);
    margin: 0.75rem 0 1.5rem;
    font-size: 0.85rem;
  }
  table.matrix th, table.matrix td {
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid var(--c-border);
    border-right: 1px solid var(--c-border);
    text-align: center;
  }
  table.matrix th { background: #f0f0f0; }
  table.matrix th:first-child, table.matrix td:first-child {
    text-align: left;
    background: #fafafa;
    font-weight: 500;
    border-right: 2px solid var(--c-border);
  }
  table.matrix td.agree { background: rgba(39, 174, 96, 0.08); }
  table.matrix td.disagree-small { background: rgba(241, 196, 15, 0.18); }
  table.matrix td.disagree-large { background: rgba(192, 57, 43, 0.18); }
  table.matrix td.last-col, table.matrix td.summary-col { font-weight: 600; }

  /* Diff cards */
  .diff-card {
    background: var(--c-card);
    border: 1px solid var(--c-border);
    border-radius: 8px;
    padding: 1rem 1.2rem;
    margin: 0.85rem 0;
  }
  .diff-card h3 { margin-top: 0; }
  .diff-card .spread { color: var(--c-warn); font-weight: 600; font-size: 0.85rem; }
  .diff-card .quick-ratings { display: flex; gap: 0.5rem; margin: 0.5rem 0 1rem; flex-wrap: wrap; }
  .diff-card .vrb { display: flex; flex-direction: column; align-items: center; min-width: 90px; }
  .diff-card .vrb .vname { font-size: 0.72rem; color: var(--c-muted); margin-bottom: 0.2rem; }

  /* Detail drawer */
  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    width: min(720px, 100vw);
    height: 100vh;
    background: var(--c-card);
    border-left: 1px solid var(--c-border);
    box-shadow: -8px 0 24px rgba(0,0,0,0.08);
    transform: translateX(100%);
    transition: transform 0.2s;
    overflow-y: auto;
    z-index: 1000;
  }
  .drawer.open { transform: translateX(0); }
  .drawer-inner { padding: 1.25rem 1.5rem 2rem; }
  .drawer-close {
    position: absolute;
    top: 0.5rem;
    right: 0.75rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--c-muted);
  }
  .drawer h2 { margin-bottom: 0.25rem; }
  .drawer .drawer-meta { display: flex; gap: 0.75rem; flex-wrap: wrap; margin: 0.5rem 0 1rem; font-size: 0.85rem; color: var(--c-muted); }
  .drawer .drawer-meta strong { color: var(--c-fg); }
  .drawer pre {
    background: #f5f5f5;
    border: 1px solid var(--c-border);
    border-radius: 6px;
    padding: 0.75rem 1rem;
    overflow-x: auto;
    font-size: 0.78rem;
    line-height: 1.4;
    max-height: 60vh;
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .drawer .section-label {
    font-size: 0.78rem;
    color: var(--c-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 1rem 0 0.4rem;
  }
  .drawer .reasoning-text {
    background: #fff8e1;
    border-left: 3px solid var(--c-warn);
    padding: 0.6rem 0.85rem;
    border-radius: 0 4px 4px 0;
    font-size: 0.88rem;
    line-height: 1.45;
  }

  /* Misc */
  .tag {
    display: inline-block;
    background: #f0f0f0;
    color: var(--c-muted);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-size: 0.72rem;
    margin-right: 0.3rem;
  }
  .tag.tier-obscure { background: #ecf0f1; color: #555; }
  .tag.tier-mid-tier { background: #fef5e7; color: #b9770e; }
  .tag.tier-award-winner { background: #eafaf1; color: #1e8449; }
  .tag.cat-comic { background: #e8f0fc; color: #2874a6; }
  .tag.cat-audio { background: #f4ecf7; color: #6c3483; }
  .tag.cat-video { background: #fdedec; color: #c0392b; }

  .helper-text { color: var(--c-muted); font-size: 0.85rem; margin: 0.25rem 0 0.75rem; }
  .legend { display: flex; gap: 0.5rem; align-items: center; font-size: 0.78rem; color: var(--c-muted); margin: 0.5rem 0 1rem; }
  .legend .lg { display: inline-block; width: 14px; height: 14px; border-radius: 3px; margin-right: 0.2rem; vertical-align: middle; }

  /* Insights box */
  .insights {
    background: #fef9e7;
    border-left: 4px solid var(--c-warn);
    padding: 0.85rem 1.1rem;
    border-radius: 0 6px 6px 0;
    margin: 0.5rem 0 1.5rem;
    font-size: 0.92rem;
  }
  .insights h3 { margin-top: 0; color: #7d6608; }
  .insights ul { margin: 0.4rem 0; padding-left: 1.3rem; }
  .insights li { margin: 0.2rem 0; }
</style>
</head>
<body>
<header>
  <h1>Phase 0 Spike Explorer</h1>
  <p class="sub" id="hdr-sub"></p>
</header>

<nav class="tabs">
  <button data-tab="summary" class="active">Summary</button>
  <button data-tab="fixture">By Fixture</button>
  <button data-tab="variant">By Variant</button>
  <button data-tab="agreement">Agreement Matrix</button>
  <button data-tab="diffs">Notable Disagreements</button>
  <button data-tab="raw">All Runs</button>
</nav>

<main>
  <section id="summary" class="panel active">
    <h2>Headline numbers</h2>
    <div class="stat-grid" id="stat-grid"></div>

    <div class="insights" id="insights"></div>

    <h2>Variants</h2>
    <p class="helper-text">Click a card to jump to that variant's detail view.</p>
    <div class="variant-cards" id="variant-cards"></div>
  </section>

  <section id="fixture" class="panel">
    <h2>By Fixture</h2>
    <p class="helper-text">Pick a fixture to compare what each variant produced for it across all 3 reruns. Click any rating cell to see the raw model output.</p>
    <div class="picker" id="fixture-picker"></div>
    <div id="fixture-detail"></div>
  </section>

  <section id="variant" class="panel">
    <h2>By Variant</h2>
    <p class="helper-text">Pick a variant to see all its runs (8 fixtures × 3 reruns = 24 runs). Click any row to see the raw model output.</p>
    <div class="picker" id="variant-picker"></div>
    <div id="variant-detail"></div>
  </section>

  <section id="agreement" class="panel">
    <h2>Agreement Matrix</h2>
    <p class="helper-text">Each cell shows the consensus rating for (fixture, variant), with color indicating how much the 3 reruns agreed:</p>
    <div class="legend">
      <span><span class="lg" style="background: rgba(39,174,96,0.4)"></span>All 3 reruns identical</span>
      <span><span class="lg" style="background: rgba(241,196,15,0.4)"></span>Stddev ≤ 0.5</span>
      <span><span class="lg" style="background: rgba(192,57,43,0.4)"></span>Stddev > 0.5</span>
    </div>
    <div id="matrix-content"></div>
  </section>

  <section id="diffs" class="panel">
    <h2>Notable Disagreements</h2>
    <p class="helper-text">Fixtures where variants disagreed on the median rating by ≥ 0.5 are shown below, with each variant's reasoning side-by-side so you can see <em>why</em> they reached different conclusions.</p>
    <div id="diffs-content"></div>
  </section>

  <section id="raw" class="panel">
    <h2>All Runs</h2>
    <p class="helper-text">Full table of all 120 runs. Click any row to inspect.</p>
    <table class="runs" id="all-runs-table">
      <thead>
        <tr>
          <th>Variant</th><th>Fixture</th><th>Rerun</th><th>Status</th><th>Rating</th>
          <th>In/Out (cached)</th><th>Web</th><th>Latency</th><th>Cost</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  </section>
</main>

<div class="drawer" id="drawer">
  <div class="drawer-inner">
    <button class="drawer-close" id="drawer-close">×</button>
    <div id="drawer-content"></div>
  </div>
</div>

<script>
const DATA = ${dataJson};

// ============================================================
// Utilities
// ============================================================

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ratingClass(r) {
  if (r == null) return 'r-fail';
  if (r < 1.75) return 'r1';
  if (r < 2.75) return 'r2';
  if (r < 3.75) return 'r3';
  if (r < 4.75) return 'r4';
  return 'r5';
}

function ratingHtml(r) {
  const txt = r == null ? 'fail' : r.toFixed(1);
  return \`<span class="rating \${ratingClass(r)}">\${txt}</span>\`;
}

function mean(xs) {
  const valid = xs.filter(x => typeof x === 'number');
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function stddev(xs) {
  const valid = xs.filter(x => typeof x === 'number');
  if (valid.length < 2) return null;
  const m = mean(valid);
  const v = valid.reduce((a, b) => a + (b - m) ** 2, 0) / (valid.length - 1);
  return Math.sqrt(v);
}

function median(xs) {
  const valid = xs.filter(x => typeof x === 'number').sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
}

function fmtUsd(n) { return '$' + n.toFixed(4); }
function fmtUsdShort(n) { return '$' + n.toFixed(2); }

// ============================================================
// Indexing
// ============================================================

const RUNS = DATA.runs;
const FIXTURES = DATA.fixtures;
const VARIANTS = DATA.variants;

function runsFor(variantName, fixtureName) {
  return RUNS.filter(r => r.variant === variantName && r.fixture === fixtureName)
    .sort((a, b) => a.rerun - b.rerun);
}

function variantSummary(variantName) {
  const my = RUNS.filter(r => r.variant === variantName);
  const totalCost = my.reduce((a, r) => a + r.cost.totalUsd, 0);
  const failures = my.filter(r => r.status !== 'success').length;
  const fixtureStddevs = FIXTURES.map(f => {
    const ratings = runsFor(variantName, f.name).map(r => r.rating);
    return stddev(ratings);
  });
  const validStddevs = fixtureStddevs.filter(s => s !== null);
  const meanStddev = validStddevs.length ? validStddevs.reduce((a, b) => a + b, 0) / validStddevs.length : null;
  const lowVarianceCount = fixtureStddevs.filter(s => s !== null && s <= 0.5).length;
  return { totalCost, failures, meanStddev, lowVarianceCount, totalRuns: my.length };
}

// ============================================================
// Tab switching
// ============================================================

document.querySelectorAll('nav.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ============================================================
// Drawer
// ============================================================

const drawer = document.getElementById('drawer');
const drawerContent = document.getElementById('drawer-content');
document.getElementById('drawer-close').addEventListener('click', () => drawer.classList.remove('open'));

function openDrawer(run) {
  const samplesHtml = run.perSampleRatings
    ? \`<div class="section-label">Per-sample ratings (multi-sample variant)</div>
       <div>\${run.perSampleRatings.map(r => ratingHtml(r)).join(' ')}</div>\`
    : '';

  const reasoningHtml = run.reasoning
    ? \`<div class="section-label">Reasoning</div><div class="reasoning-text">\${escapeHtml(run.reasoning)}</div>\`
    : '<div class="section-label">Reasoning</div><div class="reasoning-text"><em>none captured</em></div>';

  const errorHtml = run.errorMessage
    ? \`<div class="section-label">Error / status note</div><div style="color: var(--c-err); font-size: 0.88rem;">\${escapeHtml(run.errorMessage)}</div>\`
    : '';

  drawerContent.innerHTML = \`
    <h2>\${escapeHtml(run.variant)} / \${escapeHtml(run.fixture)} / rerun \${run.rerun}</h2>
    <div class="drawer-meta">
      <span><strong>Status:</strong> \${run.status}</span>
      <span><strong>Rating:</strong> \${ratingHtml(run.rating)}</span>
      <span><strong>Cost:</strong> \${fmtUsd(run.cost.totalUsd)}</span>
      <span><strong>Tokens in/out:</strong> \${run.usage.inputTokens.toLocaleString()} / \${run.usage.outputTokens.toLocaleString()}</span>
      <span><strong>Cached:</strong> \${run.usage.cacheReadInputTokens.toLocaleString()} read · \${run.usage.cacheCreationInputTokens.toLocaleString()} write</span>
      <span><strong>Web searches:</strong> \${run.usage.webSearchRequests}</span>
      <span><strong>Latency:</strong> \${run.usage.latencyMs} ms</span>
    </div>
    \${samplesHtml}
    \${reasoningHtml}
    \${errorHtml}
    <div class="section-label">Raw model output</div>
    <pre>\${escapeHtml(run.rawText ?? '(no output)')}</pre>
  \`;
  drawer.classList.add('open');
}

// ============================================================
// Summary tab
// ============================================================

function renderSummary() {
  // Header sub
  document.getElementById('hdr-sub').innerHTML =
    \`<strong>\${RUNS.length} runs</strong> · \${VARIANTS.length} variants × \${FIXTURES.length} fixtures × \${DATA.reruns} reruns · <strong>\${fmtUsdShort(DATA.totalCost.totalUsd)}</strong> total · <strong>\${RUNS.filter(r => r.status === 'success').length}</strong>/\${RUNS.length} succeeded · generated \${new Date().toISOString().slice(0, 10)}\`;

  // Stat grid
  const totalCost = DATA.totalCost;
  const successCount = RUNS.filter(r => r.status === 'success').length;
  const totalWebSearches = RUNS.reduce((a, r) => a + r.usage.webSearchRequests, 0);
  const totalLatencyMs = RUNS.reduce((a, r) => a + r.usage.latencyMs, 0);
  const totalCachedTokens = RUNS.reduce((a, r) => a + r.usage.cacheReadInputTokens, 0);

  document.getElementById('stat-grid').innerHTML = \`
    <div class="stat"><div class="label">Total runs</div><div class="value">\${RUNS.length}</div><div class="sub">\${successCount} succeeded · \${RUNS.length - successCount} failed</div></div>
    <div class="stat"><div class="label">Total cost</div><div class="value">\${fmtUsdShort(totalCost.totalUsd)}</div><div class="sub">cached \${fmtUsdShort(totalCost.cachedInputUsd)} · out \${fmtUsdShort(totalCost.outputUsd)} · web \${fmtUsdShort(totalCost.webSearchUsd)}</div></div>
    <div class="stat"><div class="label">Web searches</div><div class="value">\${totalWebSearches}</div><div class="sub">across all runs</div></div>
    <div class="stat"><div class="label">Total cached tokens</div><div class="value">\${(totalCachedTokens / 1e6).toFixed(1)}M</div><div class="sub">re-used from prompt cache</div></div>
  \`;

  // Insights
  const insights = computeInsights();
  document.getElementById('insights').innerHTML = \`
    <h3>What the data says</h3>
    <ul>\${insights.map(i => \`<li>\${i}</li>\`).join('')}</ul>
  \`;

  // Variant cards
  const winnerName = bestConsistencyVariant();
  document.getElementById('variant-cards').innerHTML = VARIANTS.map(v => {
    const s = variantSummary(v.name);
    const isWinner = v.name === winnerName;
    return \`
      <div class="variant-card \${isWinner ? 'winner' : ''}" data-jump="\${escapeHtml(v.name)}">
        <div class="name">\${escapeHtml(v.name)}</div>
        <div class="desc">\${escapeHtml(v.description)}</div>
        <div class="metrics">
          <span class="metric">stddev \${s.meanStddev != null ? s.meanStddev.toFixed(3) : '—'}</span>
          <span class="metric">\${fmtUsdShort(s.totalCost)}</span>
          <span class="metric">\${s.failures}/\${s.totalRuns} failed</span>
          <span class="metric">\${s.lowVarianceCount}/\${FIXTURES.length} fixtures ≤0.5 stddev</span>
        </div>
      </div>\`;
  }).join('');

  document.querySelectorAll('.variant-card').forEach(card => {
    card.addEventListener('click', () => {
      const name = card.dataset.jump;
      document.querySelector('nav.tabs button[data-tab="variant"]').click();
      const btn = document.querySelector(\`#variant-picker button[data-name="\${name}"]\`);
      if (btn) btn.click();
    });
  });
}

function bestConsistencyVariant() {
  let best = null, bestStddev = Infinity;
  for (const v of VARIANTS) {
    const s = variantSummary(v.name);
    if (s.meanStddev !== null && s.meanStddev < bestStddev) {
      bestStddev = s.meanStddev;
      best = v.name;
    }
  }
  return best;
}

function computeInsights() {
  const out = [];
  const baseline = variantSummary('baseline');
  const winner = bestConsistencyVariant();

  if (winner) {
    const w = variantSummary(winner);
    if (w.meanStddev !== null && baseline.meanStddev !== null && w.meanStddev < baseline.meanStddev) {
      const ratio = (baseline.meanStddev / w.meanStddev).toFixed(1);
      out.push(\`<strong>\${winner}</strong> halved (or better) the rating variance vs. baseline — stddev \${w.meanStddev.toFixed(3)} vs. \${baseline.meanStddev.toFixed(3)} (\${ratio}× tighter).\`);
    }
  }

  // FallbackProfile decision
  const overallFailRate = RUNS.filter(r => r.status !== 'success').length / RUNS.length;
  if (overallFailRate <= 0.05) {
    out.push(\`<strong>FallbackProfile: don't ship.</strong> End-to-end failure rate is \${(overallFailRate * 100).toFixed(1)}% across all 120 runs — well below the 5% threshold.\`);
  } else {
    out.push(\`Failure rate is \${(overallFailRate * 100).toFixed(1)}% — consider shipping FallbackProfile and validating recovery.\`);
  }

  // Cost extremes
  const sorted = VARIANTS.map(v => ({name: v.name, cost: variantSummary(v.name).totalCost})).sort((a, b) => a.cost - b.cost);
  const cheapest = sorted[0], priciest = sorted[sorted.length - 1];
  out.push(\`Cheapest variant: <strong>\${cheapest.name}</strong> at \${fmtUsd(cheapest.cost)}. Priciest: <strong>\${priciest.name}</strong> at \${fmtUsd(priciest.cost)} (\${(priciest.cost / cheapest.cost).toFixed(1)}×).\`);

  // Agreement
  const agreeCount = FIXTURES.filter(f => {
    const allRatings = VARIANTS.map(v => median(runsFor(v.name, f.name).map(r => r.rating))).filter(r => r != null);
    return new Set(allRatings).size === 1;
  }).length;
  out.push(\`Cross-variant agreement: <strong>\${agreeCount}/\${FIXTURES.length}</strong> fixtures had identical median ratings across all variants (the obvious cases — clear extremes of the rubric).\`);

  return out;
}

// ============================================================
// Fixture tab
// ============================================================

function renderFixtureTab() {
  const picker = document.getElementById('fixture-picker');
  picker.innerHTML = FIXTURES.map(f => \`
    <button data-name="\${escapeHtml(f.name)}">\${escapeHtml(f.name)}</button>
  \`).join('');

  picker.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      picker.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderFixtureDetail(btn.dataset.name);
    });
  });

  picker.querySelector('button').click();
}

function renderFixtureDetail(fixtureName) {
  const fixture = FIXTURES.find(f => f.name === fixtureName);
  const container = document.getElementById('fixture-detail');

  const allVariantRatings = VARIANTS.map(v => {
    const runs = runsFor(v.name, fixtureName);
    return { variant: v.name, runs, median: median(runs.map(r => r.rating)) };
  });
  const medians = allVariantRatings.map(x => x.median).filter(r => r != null);
  const variantSpread = medians.length ? Math.max(...medians) - Math.min(...medians) : 0;

  // Grid header
  let html = \`
    <div style="margin-bottom: 0.75rem;">
      <strong>\${escapeHtml(fixture.filename)}</strong>
      <div style="margin: 0.4rem 0;">
        <span class="tag cat-\${fixture.category}">\${fixture.category}</span>
        <span class="tag tier-\${fixture.tier}">\${fixture.tier}</span>
      </div>
      <div style="color: var(--c-muted); font-size: 0.88rem;">\${escapeHtml(fixture.expectation || '')}</div>
      <div style="margin-top: 0.5rem;">
        <span class="tag">cross-variant median spread: \${variantSpread.toFixed(1)}</span>
      </div>
    </div>
  \`;

  // 5×3 grid
  html += '<div class="compare-grid">';
  html += '<div class="header-cell">Variant</div>';
  html += '<div class="header-cell">Rerun 1</div>';
  html += '<div class="header-cell">Rerun 2</div>';
  html += '<div class="header-cell">Rerun 3</div>';

  for (const v of VARIANTS) {
    const runs = runsFor(v.name, fixtureName);
    html += \`<div class="variant-label">\${escapeHtml(v.name)}</div>\`;
    for (const run of runs) {
      const sampleStr = run.perSampleRatings
        ? \`samples: [\${run.perSampleRatings.map(r => r == null ? 'fail' : r.toFixed(1)).join(', ')}]\`
        : '';
      html += \`
        <div class="run-cell" data-rid="\${escapeHtml(v.name + '|' + fixtureName + '|' + run.rerun)}">
          <div class="top">\${ratingHtml(run.rating)} <span style="color: var(--c-muted); font-size: 0.75rem;">\${fmtUsd(run.cost.totalUsd)}</span></div>
          <div class="samples">\${sampleStr}</div>
        </div>\`;
    }
  }
  html += '</div>';

  // Reasoning compare
  html += '<h3>Reasoning compared (rerun 1 of each variant)</h3>';
  html += '<div class="reasoning-compare">';
  for (const v of VARIANTS) {
    const run = runsFor(v.name, fixtureName)[0];
    if (!run) continue;
    html += \`
      <div class="reasoning-block">
        <div class="variant-name">\${escapeHtml(v.name)} \${ratingHtml(run.rating)}</div>
        <div class="text">\${escapeHtml(run.reasoning || '(no reasoning captured)')}</div>
      </div>\`;
  }
  html += '</div>';

  container.innerHTML = html;

  // Attach click handlers for cells
  container.querySelectorAll('.run-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const [vName, fName, rerunStr] = cell.dataset.rid.split('|');
      const rerun = parseInt(rerunStr, 10);
      const run = RUNS.find(r => r.variant === vName && r.fixture === fName && r.rerun === rerun);
      if (run) openDrawer(run);
    });
  });
}

// ============================================================
// Variant tab
// ============================================================

function renderVariantTab() {
  const picker = document.getElementById('variant-picker');
  picker.innerHTML = VARIANTS.map(v => \`
    <button data-name="\${escapeHtml(v.name)}">\${escapeHtml(v.name)}</button>
  \`).join('');

  picker.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      picker.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderVariantDetail(btn.dataset.name);
    });
  });

  picker.querySelector('button').click();
}

function renderVariantDetail(variantName) {
  const variant = VARIANTS.find(v => v.name === variantName);
  const summary = variantSummary(variantName);
  const container = document.getElementById('variant-detail');

  let html = \`
    <div style="margin-bottom: 1rem;">
      <strong>\${escapeHtml(variant.name)}</strong>
      <div style="color: var(--c-muted); font-size: 0.88rem; margin: 0.4rem 0;">\${escapeHtml(variant.description)}</div>
      <div>
        <span class="tag">total cost \${fmtUsd(summary.totalCost)}</span>
        <span class="tag">mean stddev \${summary.meanStddev != null ? summary.meanStddev.toFixed(3) : '—'}</span>
        <span class="tag">\${summary.failures}/\${summary.totalRuns} failed</span>
        <span class="tag">\${summary.lowVarianceCount}/\${FIXTURES.length} fixtures ≤0.5 stddev</span>
      </div>
    </div>
  \`;

  html += '<table class="runs"><thead><tr><th>Fixture</th><th>Tier</th><th>Rerun 1</th><th>Rerun 2</th><th>Rerun 3</th><th>Mean</th><th>Stddev</th><th>Total cost</th></tr></thead><tbody>';

  for (const f of FIXTURES) {
    const runs = runsFor(variantName, f.name);
    const ratings = runs.map(r => r.rating);
    const m = mean(ratings);
    const s = stddev(ratings);
    const tot = runs.reduce((a, r) => a + r.cost.totalUsd, 0);
    html += \`<tr>
      <td><span class="fix-name">\${escapeHtml(f.name)}</span></td>
      <td><span class="tag tier-\${f.tier}">\${f.tier}</span> <span class="tag cat-\${f.category}">\${f.category}</span></td>
      \${runs.map(r => \`<td class="r" data-rid="\${escapeHtml(variantName + '|' + f.name + '|' + r.rerun)}">\${ratingHtml(r.rating)}</td>\`).join('')}
      <td>\${m != null ? m.toFixed(2) : '—'}</td>
      <td>\${s != null ? s.toFixed(3) : '—'}</td>
      <td>\${fmtUsd(tot)}</td>
    </tr>\`;
  }

  html += '</tbody></table>';
  container.innerHTML = html;

  container.querySelectorAll('td.r').forEach(td => {
    td.addEventListener('click', () => {
      const [vName, fName, rerunStr] = td.dataset.rid.split('|');
      const rerun = parseInt(rerunStr, 10);
      const run = RUNS.find(r => r.variant === vName && r.fixture === fName && r.rerun === rerun);
      if (run) openDrawer(run);
    });
  });
}

// ============================================================
// Agreement matrix
// ============================================================

function renderMatrix() {
  let html = '<table class="matrix"><thead><tr><th>Fixture</th>';
  for (const v of VARIANTS) html += \`<th>\${escapeHtml(v.name)}</th>\`;
  html += '<th class="summary-col">Cross-variant median</th><th class="summary-col">Spread</th></tr></thead><tbody>';

  for (const f of FIXTURES) {
    html += \`<tr><td><strong>\${escapeHtml(f.name)}</strong><br><span class="tag tier-\${f.tier}">\${f.tier}</span></td>\`;
    const variantMedians = [];
    for (const v of VARIANTS) {
      const ratings = runsFor(v.name, f.name).map(r => r.rating);
      const med = median(ratings);
      const s = stddev(ratings);
      variantMedians.push(med);
      let cls = '';
      if (s === 0) cls = 'agree';
      else if (s !== null && s <= 0.5) cls = 'disagree-small';
      else if (s !== null && s > 0.5) cls = 'disagree-large';
      html += \`<td class="\${cls}">\${ratingHtml(med)}<br><span style="font-size: 0.7rem; color: var(--c-muted);">σ=\${s != null ? s.toFixed(2) : '—'}</span></td>\`;
    }
    const validMedians = variantMedians.filter(r => r != null);
    const overallMedian = median(variantMedians);
    const spread = validMedians.length ? Math.max(...validMedians) - Math.min(...validMedians) : 0;
    html += \`<td class="summary-col last-col">\${ratingHtml(overallMedian)}</td>\`;
    html += \`<td class="summary-col last-col" style="\${spread > 0.5 ? 'color: var(--c-err);' : ''}">\${spread.toFixed(1)}</td>\`;
    html += '</tr>';
  }
  html += '</tbody></table>';

  // Bottom stats
  const allAgreedCount = FIXTURES.filter(f => {
    const meds = VARIANTS.map(v => median(runsFor(v.name, f.name).map(r => r.rating))).filter(r => r != null);
    return new Set(meds).size === 1;
  }).length;

  html += \`<div class="insights" style="margin-top: 1rem;">
    <h3>Agreement summary</h3>
    <ul>
      <li><strong>\${allAgreedCount}/\${FIXTURES.length}</strong> fixtures had identical median ratings across all 5 variants.</li>
      <li>The remaining \${FIXTURES.length - allAgreedCount} fixtures show where variants disagreed — see the <em>Notable Disagreements</em> tab.</li>
    </ul>
  </div>\`;

  document.getElementById('matrix-content').innerHTML = html;
}

// ============================================================
// Diffs tab
// ============================================================

function renderDiffs() {
  // Find fixtures where cross-variant median spread > 0
  const diffs = FIXTURES.map(f => {
    const variantData = VARIANTS.map(v => {
      const runs = runsFor(v.name, f.name);
      return {
        variant: v.name,
        median: median(runs.map(r => r.rating)),
        firstReasoning: runs[0] ? runs[0].reasoning : null,
        firstRawText: runs[0] ? runs[0].rawText : null,
        firstRun: runs[0],
      };
    });
    const meds = variantData.map(x => x.median).filter(r => r != null);
    const spread = meds.length ? Math.max(...meds) - Math.min(...meds) : 0;
    return { fixture: f, variantData, spread };
  }).filter(d => d.spread > 0).sort((a, b) => b.spread - a.spread);

  if (diffs.length === 0) {
    document.getElementById('diffs-content').innerHTML = '<p>No notable disagreements — all 5 variants converged on the same median rating for every fixture.</p>';
    return;
  }

  let html = '';
  for (const d of diffs) {
    html += \`<div class="diff-card">
      <h3>\${escapeHtml(d.fixture.name)} <span class="tag tier-\${d.fixture.tier}">\${d.fixture.tier}</span> <span class="tag cat-\${d.fixture.category}">\${d.fixture.category}</span></h3>
      <div style="color: var(--c-muted); font-size: 0.85rem; margin-bottom: 0.5rem;"><code>\${escapeHtml(d.fixture.filename)}</code></div>
      <div class="spread">Cross-variant spread: \${d.spread.toFixed(1)} rating points</div>
      <div class="quick-ratings">\`;
    for (const vd of d.variantData) {
      html += \`<div class="vrb">
        <div class="vname">\${escapeHtml(vd.variant)}</div>
        \${ratingHtml(vd.median)}
      </div>\`;
    }
    html += '</div>';
    html += '<div class="reasoning-compare">';
    for (const vd of d.variantData) {
      html += \`<div class="reasoning-block">
        <div class="variant-name">\${escapeHtml(vd.variant)} <span>\${ratingHtml(vd.median)}</span></div>
        <div class="text">\${escapeHtml(vd.firstReasoning || '(no reasoning)')}</div>
      </div>\`;
    }
    html += '</div></div>';
  }

  document.getElementById('diffs-content').innerHTML = html;
}

// ============================================================
// All runs table
// ============================================================

function renderAllRuns() {
  const tbody = document.querySelector('#all-runs-table tbody');
  tbody.innerHTML = RUNS.map(r => \`
    <tr data-rid="\${escapeHtml(r.variant + '|' + r.fixture + '|' + r.rerun)}">
      <td>\${escapeHtml(r.variant)}</td>
      <td>\${escapeHtml(r.fixture)}</td>
      <td>\${r.rerun}</td>
      <td>\${r.status}</td>
      <td>\${ratingHtml(r.rating)}</td>
      <td class="mono" style="font-size: 0.75rem;">\${r.usage.inputTokens}/\${r.usage.outputTokens} (\${r.usage.cacheReadInputTokens})</td>
      <td>\${r.usage.webSearchRequests}</td>
      <td>\${r.usage.latencyMs} ms</td>
      <td>\${fmtUsd(r.cost.totalUsd)}</td>
    </tr>\`).join('');

  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => {
      const [vName, fName, rerunStr] = tr.dataset.rid.split('|');
      const rerun = parseInt(rerunStr, 10);
      const run = RUNS.find(r => r.variant === vName && r.fixture === fName && r.rerun === rerun);
      if (run) openDrawer(run);
    });
  });
}

// ============================================================
// Boot
// ============================================================

renderSummary();
renderFixtureTab();
renderVariantTab();
renderMatrix();
renderDiffs();
renderAllRuns();

// Close drawer on Esc
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') drawer.classList.remove('open');
});
</script>
</body>
</html>
`

fs.writeFileSync(outputPath, html, 'utf8')
console.log(`Wrote ${outputPath} (${(html.length / 1024).toFixed(1)} KB, JSON payload ${(dataJson.length / 1024).toFixed(1)} KB)`)
