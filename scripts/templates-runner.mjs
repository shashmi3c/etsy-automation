#!/usr/bin/env node
/**
 * templates-runner.mjs
 * Run Etsy Templates functional suite (TC_01–TC_44) and produce an
 * interactive HTML report at templates-functional-report.html.
 *
 * Usage:
 *   node scripts/templates-runner.mjs            # headed (default)
 *   node scripts/templates-runner.mjs --headless
 *   node scripts/templates-runner.mjs --grep TC_38
 */

import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const REPORT    = resolve(ROOT, 'templates-functional-report.html');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const headless = args.includes('--headless');
const grepIdx  = args.indexOf('--grep');
const grepVal  = grepIdx !== -1 ? args[grepIdx + 1] : null;

// ── TC definitions ────────────────────────────────────────────────────────────
const TC_DEFS = [
  { tc:  1, section: 'Shipping Templates',  title: 'Fetch from Etsy',
    steps: ['Navigate to /panel/template and open the Shipping Templates tab','Click the Fetch from Etsy button','Wait 3 s for the sync response','Assert the templates page is still visible (no crash or redirect)'] },
  { tc:  2, section: 'Shipping Templates',  title: 'Create first template',
    steps: ['Navigate to Shipping Templates tab','Click Create button','Enter template name Auto_Ship_1 in the name field','Click Save','Navigate back to Shipping Templates tab','Assert a row with name Auto_Ship_1 is visible in the list'] },
  { tc:  3, section: 'Shipping Templates',  title: 'Create second template',
    steps: ['Navigate to Shipping Templates tab','Click Create button','Enter template name Auto_Ship_2 in the name field','Click Save','Navigate back to Shipping Templates tab','Assert a row with name Auto_Ship_2 is visible in the list'] },
  { tc:  4, section: 'Shipping Templates',  title: 'Edit first template',
    steps: ['Navigate to Shipping Templates tab','Search for Auto_Ship_1','Click Edit on the first matching row','Update name to Auto_Ship_1_edit and change shipping field values (zip, numeric)','Click Save','Navigate back → assert updated name visible','Re-open the template and verify the changed field values are persisted','Click Cancel to close'] },
  { tc:  5, section: 'Shipping Templates',  title: 'Filter by name',
    steps: ['Navigate to Shipping Templates tab','Type Auto_Ship_2 in the search box','Assert at least one row matching Auto_Ship_2 is visible','Clear the search box and verify all rows return'] },
  { tc:  6, section: 'Shipping Templates',  title: 'Sort by column header',
    steps: ['Navigate to Shipping Templates tab','Click the Name column header to sort ascending','Assert templates page remains functional (no crash)'] },
  { tc:  7, section: 'Shipping Templates',  title: 'Delete one template',
    steps: ['Navigate to Shipping Templates tab','Search for Auto_Ship_2','Click Delete on the first matching row','Confirm deletion in the dialog','Navigate back and search for Auto_Ship_2 again','Assert zero rows match (template removed)'] },

  { tc:  8, section: 'Inventory Templates', title: 'Fetch from Etsy',
    steps: ['Navigate to /panel/template and open the Inventory Templates tab','Click the Fetch from Etsy button','Wait 2 s for the sync response','Assert the templates page is still visible'] },
  { tc:  9, section: 'Inventory Templates', title: 'Create first template',
    steps: ['Navigate to Inventory Templates tab','Click Create button','Enter template name Auto_Inv_1','Set Minimum Threshold Value = 5 (placeholder "0" input)','Set Maximum Inventory Level = 100 (placeholder "Enter value" input)','Click Save','Navigate back and assert row Auto_Inv_1 is visible'] },
  { tc: 10, section: 'Inventory Templates', title: 'Create second template',
    steps: ['Navigate to Inventory Templates tab','Click Create button','Enter template name Auto_Inv_2','Set Minimum Threshold Value = 5','Set Maximum Inventory Level = 100','Click Save','Navigate back and assert row Auto_Inv_2 is visible'] },
  { tc: 11, section: 'Inventory Templates', title: 'Edit first template',
    steps: ['Navigate to Inventory Templates tab','Search for Auto_Inv_1','Click Edit on the matching row','Update name to Auto_Inv_1_edit','Update threshold and max inventory fields','Click Save → navigate back → assert updated name visible','Re-open template and verify threshold/max values are persisted','Click Cancel'] },
  { tc: 12, section: 'Inventory Templates', title: 'Filter by name',
    steps: ['Navigate to Inventory Templates tab','Type Auto_Inv_2 in the search box','Assert at least one row matching Auto_Inv_2 is visible','Clear search'] },
  { tc: 13, section: 'Inventory Templates', title: 'Sort by column header',
    steps: ['Navigate to Inventory Templates tab','Click the Name column header','Assert page remains functional'] },
  { tc: 14, section: 'Inventory Templates', title: 'Delete one template',
    steps: ['Navigate to Inventory Templates tab','Search for Auto_Inv_2','Click Delete on the matching row','Confirm deletion','Navigate back → search Auto_Inv_2 → assert zero rows match'] },

  { tc: 15, section: 'Price Templates',     title: 'Fetch from Etsy',
    steps: ['Navigate to /panel/template and open the Price Templates tab','Click Fetch from Etsy','Wait 2 s','Assert templates page is still visible'] },
  { tc: 16, section: 'Price Templates',     title: 'Create first template',
    steps: ['Navigate to Price Templates tab','Click Create button','Enter template name Auto_Price_1','Optionally enable Compare at Price toggle','Set pricing value field','Click Save','Navigate back → assert row Auto_Price_1 visible'] },
  { tc: 17, section: 'Price Templates',     title: 'Create second template',
    steps: ['Navigate to Price Templates tab','Click Create button','Enter template name Auto_Price_2','Configure pricing fields','Click Save','Navigate back → assert row Auto_Price_2 visible'] },
  { tc: 18, section: 'Price Templates',     title: 'Edit first template',
    steps: ['Navigate to Price Templates tab','Search for Auto_Price_1','Click Edit','Update name to Auto_Price_1_edit and change pricing fields','Click Save → navigate back → assert updated name visible','Re-open and verify pricing field values persisted','Click Cancel'] },
  { tc: 19, section: 'Price Templates',     title: 'Filter by name',
    steps: ['Navigate to Price Templates tab','Type Auto_Price_2 in search box','Assert matching row is visible','Clear search'] },
  { tc: 20, section: 'Price Templates',     title: 'Sort by column header',
    steps: ['Navigate to Price Templates tab','Click Name column header','Assert page remains functional'] },
  { tc: 21, section: 'Price Templates',     title: 'Delete one template',
    steps: ['Navigate to Price Templates tab','Search for Auto_Price_2','Click Delete → Confirm','Navigate back → search again → assert zero rows match'] },

  { tc: 22, section: 'Policy Templates',    title: 'Fetch from Etsy',
    steps: ['Navigate to /panel/template and open the Policy Templates tab','Click Fetch from Etsy','Wait 2 s','Assert templates page is still visible'] },
  { tc: 23, section: 'Policy Templates',    title: 'Create first template',
    steps: ['Navigate to Policy Templates tab (no name field — identified by return-window days)','Click Create button','Select return-window days value (e.g., 7 days)','Fill required policy fields','Click Save','Navigate back → assert new policy row visible'] },
  { tc: 24, section: 'Policy Templates',    title: 'Create second template',
    steps: ['Navigate to Policy Templates tab','Click Create','Select a different return-window days value','Fill required fields','Click Save','Navigate back → assert second policy row visible'] },
  { tc: 25, section: 'Policy Templates',    title: 'Edit first template',
    steps: ['Navigate to Policy Templates tab','Locate first policy row','Click Edit','Change return-window days and/or other fields','Click Save → navigate back → assert change is visible','Re-open and verify values persisted','Click Cancel'] },
  { tc: 26, section: 'Policy Templates',    title: 'Filter by days',
    steps: ['Navigate to Policy Templates tab','Type a days value in the search box','Assert only matching rows are shown','Clear search'] },
  { tc: 27, section: 'Policy Templates',    title: 'Sort by column header',
    steps: ['Navigate to Policy Templates tab','Click a column header','Assert page remains functional'] },
  { tc: 28, section: 'Policy Templates',    title: 'Delete one template',
    steps: ['Navigate to Policy Templates tab','Locate a policy template row','Click Delete → Confirm','Navigate back → assert template no longer appears'] },

  { tc: 29, section: 'Shop Sections',       title: 'Fetch from Etsy',
    steps: ['Navigate to /panel/template and open the Shop Sections tab','Click Fetch from Etsy','Wait for sync','Assert page is still visible'] },
  { tc: 30, section: 'Shop Sections',       title: 'Create first section',
    steps: ['Navigate to Shop Sections tab','Click Add Section button','Shopify overlay modal appears — enter section title (max 24 chars)','Click Save in the modal','Navigate back → assert new section row is visible in list'] },
  { tc: 31, section: 'Shop Sections',       title: 'Create second section',
    steps: ['Navigate to Shop Sections tab','Click Add Section','Enter a second unique section title (max 24 chars)','Click Save','Navigate back → assert second section row visible'] },
  { tc: 32, section: 'Shop Sections',       title: 'Edit first section',
    steps: ['Navigate to Shop Sections tab','Search for first section','Click Edit','Update section name','Click Save','Navigate back → assert updated name visible'] },
  { tc: 33, section: 'Shop Sections',       title: 'Filter by name',
    steps: ['Navigate to Shop Sections tab','Type section name in search box','Assert matching row is visible','Clear search'] },
  { tc: 34, section: 'Shop Sections',       title: 'Sort by column header',
    steps: ['Navigate to Shop Sections tab','Click Name column header','Assert page remains functional'] },
  { tc: 35, section: 'Shop Sections',       title: 'Delete one section',
    steps: ['Navigate to Shop Sections tab','Search for target section','Click Delete → Confirm','Navigate back → search again → assert zero rows match'] },

  { tc: 36, section: 'Production Partners', title: 'Fetch from Etsy',
    steps: ['Navigate to /panel/template and open the Production Partners tab','Click Fetch from Etsy (or equivalent sync)','Wait for response','Assert page is still visible'] },
  { tc: 37, section: 'Production Partners', title: 'Filter (if data present)',
    skipReason: 'Skips automatically when no production partners exist in the test store',
    steps: ['Navigate to Production Partners tab','Skip test if no partner rows are present (data-dependent)','Type partner name in search box','Assert only matching rows are shown','Clear search'] },

  { tc: 38, section: 'Processing Profiles', title: 'Fetch from Etsy',
    steps: ['Navigate to /panel/template and open the Processing Profiles tab','Click Fetch from Etsy','Wait for sync response','Assert page is still visible'] },
  { tc: 39, section: 'Processing Profiles', title: 'Create first profile',
    steps: ['Navigate to Processing Profiles tab','Click Create button','Enter profile name Auto_Proc_1','Click Save','Navigate back → assert row Auto_Proc_1 is visible'] },
  { tc: 40, section: 'Processing Profiles', title: 'Create second profile',
    steps: ['Navigate to Processing Profiles tab','Click Create','Enter profile name Auto_Proc_2','Click Save','Navigate back → assert row Auto_Proc_2 visible'] },
  { tc: 41, section: 'Processing Profiles', title: 'Edit first profile',
    steps: ['Navigate to Processing Profiles tab','Search for Auto_Proc_1','Click Edit','Update profile name to Auto_Proc_1_edit','Click Save → navigate back → assert updated name visible'] },
  { tc: 42, section: 'Processing Profiles', title: 'Filter by name',
    steps: ['Navigate to Processing Profiles tab','Type Auto_Proc_2 in search box','Assert matching row is visible','Clear search'] },
  { tc: 43, section: 'Processing Profiles', title: 'Sort by column header',
    steps: ['Navigate to Processing Profiles tab','Click Name column header','Assert page remains functional'] },
  { tc: 44, section: 'Processing Profiles', title: 'Delete one profile',
    steps: ['Navigate to Processing Profiles tab','Search for Auto_Proc_2','Click Delete → Confirm','Navigate back → search again → assert zero rows match'] },
];

const SECTION_META = {
  'Shipping Templates':  { icon: '📦', color: '#6366f1' },
  'Inventory Templates': { icon: '📋', color: '#0ea5e9' },
  'Price Templates':     { icon: '💰', color: '#f59e0b' },
  'Policy Templates':    { icon: '📜', color: '#8b5cf6' },
  'Shop Sections':       { icon: '🏪', color: '#ec4899' },
  'Production Partners': { icon: '🤝', color: '#14b8a6' },
  'Processing Profiles': { icon: '⚙️', color: '#f97316' },
};

// ── Run ───────────────────────────────────────────────────────────────────────
const JSON_OUT = resolve(ROOT, 'templates-results.json');
// Clean up any previous result file
if (existsSync(JSON_OUT)) try { unlinkSync(JSON_OUT); } catch { /**/ }

const pwArgs = [
  'playwright', 'test',
  'tests/templates-functional.spec.js',
  '--project=etsy-authenticated',
  '--workers=1',
  '--reporter=json',
];
if (!headless) pwArgs.push('--headed');
if (grepVal)   pwArgs.push('--grep', grepVal);

console.log('\n  Etsy Templates — Functional Suite');
console.log('  ' + '─'.repeat(38));
console.log(`  Mode   : ${headless ? 'headless' : 'headed'}`);
if (grepVal) console.log(`  Filter : ${grepVal}`);
console.log('  Running… (~15–18 min)\n');

const start  = Date.now();
// Write JSON to a file via env var — avoids Windows stdout-pipe issues
spawnSync('npx', pwArgs, {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
  timeout: 25 * 60 * 1000,
  shell: true,
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: JSON_OUT },
});
const elapsed = Date.now() - start;

// ── Parse JSON ────────────────────────────────────────────────────────────────
let jsonData = null;
try { jsonData = JSON.parse(readFileSync(JSON_OUT, 'utf8')); } catch { /**/ }
if (!jsonData) {
  console.error('\n  ❌ Could not read Playwright JSON output from ' + JSON_OUT);
  process.exit(1);
}

function collectSpecs(node) {
  const s = [];
  if (node.specs)  s.push(...node.specs);
  if (node.suites) node.suites.forEach(n => s.push(...collectSpecs(n)));
  return s;
}
const resultMap = new Map();
for (const spec of collectSpecs({ suites: jsonData.suites ?? [] })) {
  const m = spec.title.match(/TC_(\d+)/i);
  if (!m) continue;
  const res = spec.tests?.[0]?.results?.[0] ?? {};
  resultMap.set(parseInt(m[1]), {
    status:   res.status ?? spec.tests?.[0]?.status ?? 'unknown',
    duration: res.duration ?? 0,
    error:    res.error?.message ?? res.error?.value ?? '',
  });
}

// ── Merge ─────────────────────────────────────────────────────────────────────
const runDate = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const tests = TC_DEFS.map(def => {
  const r = resultMap.get(def.tc);
  return { ...def, status: r?.status ?? 'pending', duration: r?.duration ?? 0, error: r?.error ?? '' };
});

const total    = tests.length;
const passed   = tests.filter(t => t.status === 'passed').length;
const failed   = tests.filter(t => t.status === 'failed').length;
const skipped  = tests.filter(t => t.status === 'skipped').length;
const pending  = tests.filter(t => t.status === 'pending').length;
const passRate = total ? Math.round(passed / total * 100) : 0;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtMs = ms => {
  if (!ms) return '—';
  if (ms < 1000)  return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
};
const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pill = status => {
  const map = {
    passed:   ['✓ passed',    'pill-pass'],
    failed:   ['✕ failed',    'pill-fail'],
    skipped:  ['⊘ skipped',   'pill-skip'],
    timedOut: ['⏱ timed out', 'pill-fail'],
    pending:  ['– pending',   'pill-pend'],
  };
  const [label, cls] = map[status] ?? ['? unknown', 'pill-pend'];
  return `<span class="pill ${cls}">${label}</span>`;
};

// ── Build HTML ────────────────────────────────────────────────────────────────
const passW = total ? (passed  / total * 100).toFixed(1) : 0;
const skipW = total ? (skipped / total * 100).toFixed(1) : 0;
const failW = total ? (failed  / total * 100).toFixed(1) : 0;
const pendW = total ? (pending / total * 100).toFixed(1) : 0;

const sections = [...new Set(TC_DEFS.map(d => d.section))];
const sectionChips = sections.map(s => {
  const meta    = SECTION_META[s] ?? { icon: '●', color: '#64748b' };
  const sTests  = tests.filter(t => t.section === s);
  const sFailed = sTests.filter(t => t.status === 'failed').length;
  const dot = sFailed > 0 ? `<span style="color:#ef4444">●</span>` : `<span style="color:#22c55e">●</span>`;
  return `<button class="sec-chip" data-section="${esc(s)}" onclick="filterSection(this)">${dot} ${meta.icon} ${s} <span class="sec-cnt">${sTests.length}</span></button>`;
}).join('');

const tableRows = tests.map(t => {
  const meta = SECTION_META[t.section] ?? { icon: '●', color: '#64748b' };
  const tcLabel = `TC_${String(t.tc).padStart(2, '0')}`;
  const stepsHtml = (t.steps ?? []).length
    ? `<ol class="steps-list">${(t.steps).map(s => `<li>${esc(s)}</li>`).join('')}</ol>`
    : '';
  const detailContent = `<div class="detail-box">
      <div class="detail-heading">Test Steps</div>
      <div class="dm-row">
        <span class="dm"><strong>Duration:</strong> ${fmtMs(t.duration)}</span>
        <span class="dm"><strong>Section:</strong> ${esc(t.section)}</span>
        <span class="dm"><strong>Status:</strong> ${t.status}</span>
      </div>
      ${stepsHtml}
      ${t.status === 'skipped' && t.skipReason ? `<div class="skip-note" style="margin-top:10px">⊘ ${esc(t.skipReason)}</div>` : ''}
      ${t.error ? `<div class="detail-heading" style="margin-top:12px;color:#f87171">Error Details</div><pre class="err-pre">${esc(t.error.slice(0, 1500))}</pre>` : ''}
     </div>`;

  return `
<tr class="dr" data-status="${t.status}" data-section="${esc(t.section)}" data-tc="${t.tc}" onclick="toggleRow(this)">
  <td class="td-tc">${tcLabel}</td>
  <td class="td-title">${esc(t.title)}<span class="chevron">▼</span></td>
  <td class="td-sec"><span class="sec-label">${meta.icon} ${esc(t.section)}</span></td>
  <td>${pill(t.status)}</td>
  <td class="td-dur">${fmtMs(t.duration)}</td>
</tr>
<tr class="detr" style="display:none" data-status="${t.status}" data-section="${esc(t.section)}" data-tc="${t.tc}">
  <td colspan="5"><div class="detail-inner">${detailContent}</div></td>
</tr>`;
}).join('');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Etsy Templates — Functional QA Report</title>
<style>
  :root{--bg:#0f1117;--surface:#1a1d27;--card:#20232e;--border:#2d3142;
    --pass:#22c55e;--skip:#f59e0b;--fail:#ef4444;--pend:#64748b;
    --text:#e2e8f0;--muted:#64748b;--accent:#10b981;--r:10px}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,sans-serif;font-size:14px}

  /* Header */
  header{background:linear-gradient(135deg,#0f1f1a,#0d3326 50%,#0f1f1a);
    padding:28px 40px 22px;border-bottom:1px solid #065f46;position:relative;overflow:hidden}
  header::before{content:'';position:absolute;inset:0;
    background:radial-gradient(ellipse at 70% 50%,rgba(16,185,129,.13),transparent 70%);pointer-events:none}
  .hi{position:relative;z-index:1}
  .ht{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px}
  header h1{font-size:20px;font-weight:700;display:flex;align-items:center;gap:10px}
  .bm{background:rgba(16,185,129,.25);border:1px solid rgba(16,185,129,.45);border-radius:6px;
    padding:2px 10px;font-size:11px;font-weight:600;color:#6ee7b7;letter-spacing:.5px}
  .bc{background:rgba(34,197,94,.2);border:1px solid rgba(34,197,94,.4);border-radius:6px;
    padding:2px 10px;font-size:11px;font-weight:600;color:#86efac}
  header p.sub{margin-top:6px;color:#6ee7b7;font-size:13px}
  .run-meta{margin-top:14px;display:flex;gap:10px;flex-wrap:wrap}
  .chip{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;
    padding:4px 12px;font-size:11.5px;color:#a7f3d0}
  .chip strong{color:#d1fae5}

  /* Main */
  main{max-width:1140px;margin:0 auto;padding:26px 22px}

  /* Stats */
  .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}
  .sc{background:var(--card);border:1px solid var(--border);border-radius:var(--r);
    padding:16px 14px;text-align:center;transition:transform .15s,box-shadow .15s;cursor:default}
  .sc:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.4)}
  .sc .num{font-size:36px;font-weight:800;line-height:1;letter-spacing:-1px}
  .sc .lbl{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:var(--muted);margin-top:6px}
  .sc-all {border-top:3px solid #6366f1}.sc-all  .num{color:var(--text)}
  .sc-pass{border-top:3px solid var(--pass)}.sc-pass .num{color:var(--pass)}
  .sc-skip{border-top:3px solid var(--skip)}.sc-skip .num{color:var(--skip)}
  .sc-fail{border-top:3px solid var(--fail)}.sc-fail .num{color:var(--fail)}
  .sc-rate{border-top:3px solid var(--accent)}.sc-rate .num{color:var(--accent);font-size:28px}

  /* Progress */
  .pw{background:var(--card);border:1px solid var(--border);border-radius:var(--r);
    padding:16px 20px;margin-bottom:18px}
  .pl{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px}
  .pb{height:9px;border-radius:6px;background:var(--border);overflow:hidden;display:flex}
  .ps{height:100%;transition:width .6s cubic-bezier(.4,0,.2,1)}
  #pp{background:var(--pass)}#psk{background:var(--skip)}#pf{background:var(--fail)}#ppend{background:var(--pend)}
  .pl2{display:flex;gap:18px;margin-top:10px;font-size:12px;flex-wrap:wrap}
  .li{display:flex;align-items:center;gap:6px}
  .ld{width:8px;height:8px;border-radius:50%;flex-shrink:0}
  .li span{color:var(--muted)}

  /* Section chips */
  .sec-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
  .sec-chip{background:var(--card);border:1px solid var(--border);border-radius:20px;
    padding:5px 14px;font-size:12px;color:var(--muted);cursor:pointer;transition:all .15s;
    display:flex;align-items:center;gap:6px}
  .sec-chip:hover{border-color:var(--accent);color:var(--text)}
  .sec-chip.active{background:rgba(16,185,129,.15);border-color:var(--accent);color:#6ee7b7}
  .sec-cnt{background:rgba(255,255,255,.1);border-radius:10px;padding:1px 7px;font-size:10px}

  /* Controls */
  .ctrl{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}
  .fbtns{display:flex;gap:6px}
  .fb{background:var(--card);border:1px solid var(--border);color:var(--muted);
    border-radius:6px;padding:6px 14px;font-size:12px;cursor:pointer;transition:all .15s}
  .fb:hover{border-color:var(--accent);color:var(--text)}
  .fb.active{background:#059669;border-color:#059669;color:#fff;font-weight:600}
  .sb{flex:1;min-width:200px;background:var(--card);border:1px solid var(--border);
    color:var(--text);border-radius:6px;padding:6px 12px;font-size:13px;outline:none}
  .sb:focus{border-color:var(--accent);box-shadow:0 0 0 2px rgba(16,185,129,.2)}
  .sb::placeholder{color:var(--muted)}
  .rc{font-size:12px;color:var(--muted);white-space:nowrap}

  /* Table */
  .tw{background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
  table{width:100%;border-collapse:collapse}
  thead tr{background:var(--surface)}
  thead th{padding:11px 16px;text-align:left;font-size:10.5px;text-transform:uppercase;
    letter-spacing:.9px;color:var(--muted);border-bottom:1px solid var(--border);
    cursor:pointer;user-select:none;white-space:nowrap;transition:color .15s}
  thead th:hover{color:var(--text)}
  thead th.sorted{color:var(--accent)}
  .sa{display:inline-block;margin-left:4px;opacity:.5;font-size:10px}
  thead th.sorted .sa{opacity:1}
  tbody tr.dr{border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s}
  tbody tr.dr:hover{background:rgba(16,185,129,.07)}
  tbody tr.dr.expanded{background:rgba(16,185,129,.05)}
  td{padding:11px 16px;vertical-align:middle}
  .td-tc{font-weight:700;font-size:12.5px;color:var(--accent);white-space:nowrap;font-family:monospace}
  .td-title{color:var(--text);line-height:1.4}
  .td-sec{font-size:11.5px;color:var(--muted)}
  .sec-label{display:inline-flex;align-items:center;gap:5px}
  .td-dur{font-size:11.5px;color:var(--muted);white-space:nowrap;font-family:monospace}
  .chevron{display:inline-block;margin-left:6px;font-size:10px;color:var(--muted);transition:transform .2s}
  .expanded .chevron{transform:rotate(180deg)}

  /* Pills */
  .pill{display:inline-flex;align-items:center;gap:5px;border-radius:20px;
    padding:3px 11px;font-size:11px;font-weight:600;white-space:nowrap}
  .pill-pass{background:rgba(34,197,94,.12);color:var(--pass);border:1px solid rgba(34,197,94,.3)}
  .pill-skip{background:rgba(245,158,11,.12);color:var(--skip);border:1px solid rgba(245,158,11,.3)}
  .pill-fail{background:rgba(239,68,68,.12);color:var(--fail);border:1px solid rgba(239,68,68,.3)}
  .pill-pend{background:rgba(100,116,139,.1);color:var(--muted);border:1px solid rgba(100,116,139,.2)}

  /* Detail rows */
  tr.detr td{padding:0;border-bottom:1px solid var(--border)}
  .detail-inner{padding:14px 16px 16px 52px;background:rgba(15,17,23,.5);border-top:1px solid var(--border)}
  .detail-box{background:var(--surface);border:1px solid var(--border);border-radius:8px;
    padding:14px 16px;font-size:12.5px;line-height:1.75;color:#94a3b8}
  .detail-heading{font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px}
  .dm-row{display:flex;gap:16px;margin-bottom:10px;flex-wrap:wrap}
  .dm{font-size:11px;color:var(--muted)}
  .dm strong{color:#94a3b8}
  .skip-note{padding:8px 12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);
    border-radius:6px;font-size:11.5px;color:#fcd34d}
  .err-pre{white-space:pre-wrap;word-break:break-word;font-size:12px;
    color:#f87171;font-family:'Cascadia Code','Courier New',monospace;margin-top:8px}

  /* Steps list */
  .steps-list{margin:10px 0 4px 18px;padding:0;display:flex;flex-direction:column;gap:5px}
  .steps-list li{font-size:12.5px;color:#94a3b8;line-height:1.6;padding-left:4px}
  .steps-list li::marker{color:var(--accent);font-weight:700}

  .empty{text-align:center;padding:48px 24px;color:var(--muted)}
  footer{text-align:center;padding:24px;color:var(--muted);font-size:11.5px;
    border-top:1px solid var(--border);margin-top:36px}
  .hidden{display:none!important}
  @media(max-width:680px){
    .stats{grid-template-columns:repeat(2,1fr)}
    header{padding:18px}
    main{padding:18px 12px}
    .td-sec,.td-dur{display:none}
  }
</style>
</head>
<body>

<header>
  <div class="hi">
    <div class="ht">
      <div>
        <h1>Etsy Templates <span class="bm">Functional</span> <span class="bc">44 TCs</span></h1>
        <p class="sub">TC_01 – TC_44 &nbsp;·&nbsp; /panel/template &nbsp;·&nbsp; store: etsy-test-gp7o90bx</p>
      </div>
      <div style="text-align:right;font-size:12px;color:#6ee7b7">
        <div>${runDate}</div>
        <div style="margin-top:4px;color:#4ade80;font-weight:600">${passRate}% pass rate</div>
      </div>
    </div>
    <div class="run-meta">
      <span class="chip"><strong>Spec:</strong> tests/templates-functional.spec.js</span>
      <span class="chip"><strong>Project:</strong> etsy-authenticated</span>
      <span class="chip"><strong>Mode:</strong> ${headless ? 'headless' : 'headed'}</span>
      <span class="chip"><strong>Runtime:</strong> ${fmtMs(elapsed)}</span>
    </div>
  </div>
</header>

<main>
  <div class="stats">
    <div class="sc sc-all">  <div class="num">${total}</div>   <div class="lbl">Total</div></div>
    <div class="sc sc-pass"> <div class="num">${passed}</div>  <div class="lbl">Passed</div></div>
    <div class="sc sc-skip"> <div class="num">${skipped}</div> <div class="lbl">Skipped</div></div>
    <div class="sc sc-fail"> <div class="num">${failed}</div>  <div class="lbl">Failed</div></div>
    <div class="sc sc-rate"> <div class="num">${passRate}%</div><div class="lbl">Pass Rate</div></div>
  </div>

  <div class="pw">
    <div class="pl">Coverage Breakdown</div>
    <div class="pb">
      <div class="ps" id="pp"    style="width:${passW}%"></div>
      <div class="ps" id="psk"   style="width:${skipW}%"></div>
      <div class="ps" id="pf"    style="width:${failW}%"></div>
      <div class="ps" id="ppend" style="width:${pendW}%"></div>
    </div>
    <div class="pl2">
      <div class="li"><div class="ld" style="background:var(--pass)"></div><span>Passed (${passed})</span></div>
      <div class="li"><div class="ld" style="background:var(--skip)"></div><span>Skipped (${skipped})</span></div>
      <div class="li"><div class="ld" style="background:var(--fail)"></div><span>Failed (${failed})</span></div>
      <div class="li"><div class="ld" style="background:var(--pend)"></div><span>Pending (${pending})</span></div>
    </div>
  </div>

  <div class="sec-bar">${sectionChips}</div>

  <div class="ctrl">
    <div class="fbtns">
      <button class="fb active" data-f="all"     onclick="setF(this)">All</button>
      <button class="fb"        data-f="passed"  onclick="setF(this)">Passed</button>
      <button class="fb"        data-f="skipped" onclick="setF(this)">Skipped</button>
      <button class="fb"        data-f="failed"  onclick="setF(this)">Failed</button>
    </div>
    <input class="sb" type="text" placeholder="Search TC or title…" oninput="applyAll()">
    <span class="rc" id="rc"></span>
  </div>

  <div class="tw">
    <table>
      <thead><tr>
        <th style="width:80px"  onclick="srt('tc')"  id="th-tc">     TC # <span class="sa">↕</span></th>
        <th                     onclick="srt('ttl')" id="th-ttl">    Title <span class="sa">↕</span></th>
        <th style="width:185px" onclick="srt('sec')" id="th-sec">  Section <span class="sa">↕</span></th>
        <th style="width:115px" onclick="srt('st')"  id="th-st">   Status <span class="sa">↕</span></th>
        <th style="width:85px"  onclick="srt('dur')" id="th-dur"> Duration <span class="sa">↕</span></th>
      </tr></thead>
      <tbody id="tb">${tableRows}</tbody>
    </table>
    <div class="empty hidden" id="empty">🔍 No test cases match your filters.</div>
  </div>
</main>

<footer>Etsy QA Automation · Templates Functional Suite · TC_01–TC_44 · store: etsy-test-gp7o90bx · ${runDate}</footer>

<script>
  let aF='all', aSec=null, aQ='', sCol='tc', sDir=1;

  function toggleRow(r){
    const d=r.nextElementSibling;
    if(!d||!d.classList.contains('detr'))return;
    const o=d.style.display!=='none';
    d.style.display=o?'none':'table-row';
    r.classList.toggle('expanded',!o);
  }

  function filterSection(c){
    const cs=document.querySelectorAll('.sec-chip');
    if(c.classList.contains('active')){c.classList.remove('active');aSec=null;}
    else{cs.forEach(x=>x.classList.remove('active'));c.classList.add('active');aSec=c.dataset.section;}
    applyAll();
  }

  function setF(b){
    document.querySelectorAll('.fb').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');aF=b.dataset.f;applyAll();
  }

  function applyAll(){
    aQ=document.querySelector('.sb').value.toLowerCase();
    const drs=[...document.querySelectorAll('tr.dr')];
    const dtrs=[...document.querySelectorAll('tr.detr')];
    let vis=0;
    drs.forEach((r,i)=>{
      const okF  = aF==='all'||r.dataset.status===aF;
      const okS  = !aSec||r.dataset.section===aSec;
      const txt  = (r.querySelector('.td-tc')?.textContent+' '+r.querySelector('.td-title')?.textContent).toLowerCase();
      const okQ  = !aQ||txt.includes(aQ);
      const show = okF&&okS&&okQ;
      r.classList.toggle('hidden',!show);
      if(dtrs[i]){
        if(!show){dtrs[i].style.display='none';r.classList.remove('expanded');}
        dtrs[i].classList.toggle('hidden',!show);
      }
      if(show)vis++;
    });
    document.getElementById('rc').textContent=vis===drs.length?'':vis+' of '+drs.length;
    document.getElementById('empty').classList.toggle('hidden',vis>0);
  }

  function srt(col){
    if(sCol===col)sDir*=-1;else{sCol=col;sDir=1;}
    document.querySelectorAll('thead th').forEach(h=>{
      h.classList.remove('sorted');
      const a=h.querySelector('.sa');if(a)a.textContent='↕';
    });
    const th=document.getElementById('th-'+col);
    if(th){th.classList.add('sorted');const a=th.querySelector('.sa');if(a)a.textContent=sDir===1?'↑':'↓';}
    const tb=document.getElementById('tb');
    const pairs=[...document.querySelectorAll('tr.dr')].map(r=>[r,r.nextElementSibling?.classList.contains('detr')?r.nextElementSibling:null]);
    pairs.sort(([a],[b])=>{
      if(col==='tc') return sDir*(parseInt(a.dataset.tc)-parseInt(b.dataset.tc));
      if(col==='dur'){
        const va=parseFloat(a.querySelector('.td-dur')?.textContent)||0;
        const vb=parseFloat(b.querySelector('.td-dur')?.textContent)||0;
        return sDir*(va-vb);
      }
      const map={ttl:'.td-title',sec:'.td-sec',st:'[class^="pill"]'};
      const va=a.querySelector(map[col])?.textContent??'';
      const vb=b.querySelector(map[col])?.textContent??'';
      return sDir*va.localeCompare(vb,undefined,{numeric:true});
    });
    pairs.forEach(([r,d])=>{tb.appendChild(r);if(d)tb.appendChild(d);});
  }
</script>
</body>
</html>`;

writeFileSync(REPORT, html);
console.log(`\n  ✅ Report → ${REPORT}`);
const { exec } = await import('child_process');
exec(`start "" "${REPORT}"`);


console.log(`\n  ${'─'.repeat(38)}`);
console.log(`  ${runDate}  |  Runtime: ${fmtMs(elapsed)}`);
console.log(`  ✓ ${passed} passed  ✕ ${failed} failed  ⊘ ${skipped} skipped  (${passRate}% pass rate)`);
if (failed > 0) {
  console.log('\n  Failed:');
  tests.filter(t => t.status === 'failed').forEach(t =>
    console.log(`    ✕ TC_${String(t.tc).padStart(2,'0')} — ${t.title}\n      ${t.error.split('\n')[0].slice(0,110)}`)
  );
}
console.log(`  ${'─'.repeat(38)}\n`);
