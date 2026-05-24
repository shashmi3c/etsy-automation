/**
 * Etsy Dashboard Test Runner
 * Runs all 37 dashboard test cases, parses results, and updates the HTML report.
 *
 * Usage:  node scripts/etsy-dashboard-runner.mjs
 */

import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'dashboard-test-report.html');

// ── Colours for terminal output ───────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  dim:    '\x1b[2m',
};

function log(msg)  { process.stdout.write(msg + '\n'); }
function line(c=60){ return C.dim + '─'.repeat(c) + C.reset; }

// ── Run playwright, capture JSON output ───────────────────
log('\n' + line());
log(`${C.bold}${C.cyan}  Etsy Dashboard · Test Runner${C.reset}`);
log(line());
log(`${C.dim}  Running 37 test cases against live store…${C.reset}\n`);

const proc = spawnSync(
  'npx',
  ['playwright', 'test', 'tests/etsy-dashboard.spec.js',
   '--project=etsy-authenticated', '--reporter=json', '--headed'],
  { cwd: ROOT, encoding: 'utf8', timeout: 1_200_000, shell: true }
);

// stdout = JSON, stderr = human-readable progress
if (proc.stderr) process.stderr.write(proc.stderr);

let playwrightData;
try {
  playwrightData = JSON.parse(proc.stdout || '{}');
} catch {
  log(`\n${C.red}  ERROR: Could not parse Playwright JSON output.${C.reset}`);
  log(`${C.dim}  Make sure auth session is valid. Run: node scripts/shopify-auth.mjs${C.reset}\n`);
  process.exit(1);
}

// ── Extract per-test results ──────────────────────────────
const resultMap = {}; // { 'TC_01': 'pass' | 'skip' | 'fail' }

function walkSuites(suites) {
  if (!suites) return;
  for (const suite of suites) {
    walkSuites(suite.suites);
    for (const spec of (suite.specs || [])) {
      // title like "TC_19: Clicking "Not Published"..."
      const match = spec.title.match(/^(TC_\d+)/);
      if (!match) continue;
      const tcId = match[1];
      const test  = spec.tests?.[0];
      if (!test) continue;
      const status = test.results?.[0]?.status || test.status || 'unknown';
      // Playwright statuses: passed, failed, skipped, timedOut, interrupted
      if (status === 'passed')  resultMap[tcId] = 'pass';
      else if (status === 'skipped') resultMap[tcId] = 'skip';
      else                      resultMap[tcId] = 'fail';
    }
  }
}

walkSuites(playwrightData.suites);

// ── Print summary table ───────────────────────────────────
const pass = Object.values(resultMap).filter(r => r === 'pass').length;
const skip = Object.values(resultMap).filter(r => r === 'skip').length;
const fail = Object.values(resultMap).filter(r => r === 'fail').length;
const total = pass + skip + fail;

log('\n' + line());
log(`${C.bold}  Results${C.reset}`);
log(line());

for (const [tc, result] of Object.entries(resultMap)) {
  const icon = result === 'pass' ? `${C.green}✓` : result === 'skip' ? `${C.yellow}⊘` : `${C.red}✕`;
  const label = result === 'pass' ? 'Pass' : result === 'skip' ? 'Skip' : 'FAIL';
  log(`  ${icon} ${tc.padEnd(6)} ${label}${C.reset}`);
}

log('\n' + line());
log(
  `  ${C.green}${C.bold}${pass} passed${C.reset}  ` +
  `${C.yellow}${skip} skipped${C.reset}  ` +
  (fail > 0 ? `${C.red}${C.bold}${fail} failed${C.reset}  ` : '') +
  `${C.dim}(${total} total)${C.reset}`
);
log(line() + '\n');

// ── Patch the HTML report ─────────────────────────────────
let html = readFileSync(HTML_PATH, 'utf8');

// Build updated TESTS array with real results
const tcResultJs = Object.entries(resultMap)
  .map(([tc, r]) => `"${tc}":"${r}"`)
  .join(',');

const runDate = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
const passRate = total > 0 ? (pass / total * 100).toFixed(1) : '0.0';
const passWidth = total > 0 ? (pass / total * 100).toFixed(1) : '0';
const skipWidth = total > 0 ? (skip / total * 100).toFixed(1) : '0';
const failWidth = total > 0 ? (fail / total * 100).toFixed(1) : '0';

// ── Patch static HTML stats ───────────────────────────────
// Header run date + pass rate
html = html.replace(/(<div>Run: ).*?(<\/div>)/, `$1${runDate}$2`);
html = html.replace(/(<div class="pass-rate">).*?(<\/div>)/, `$1${passRate}% pass rate$2`);

// Stat cards
html = html.replace(/(<div class="sc sc-pass"><div class="num">)\d+(<\/div>)/, `$1${pass}$2`);
html = html.replace(/(<div class="sc sc-skip"><div class="num">)\d+(<\/div>)/, `$1${skip}$2`);
html = html.replace(/(<div class="sc sc-fail"><div class="num">)\d+(<\/div>)/, `$1${fail}$2`);
html = html.replace(/(<div class="sc sc-rate"><div class="num">)[\d.]+%(<\/div>)/, `$1${passRate}%$2`);

// Progress bar widths
html = html.replace(/(id="pp"\s+style="width:)[\d.]+%(")/,  `$1${passWidth}%$2`);
html = html.replace(/(id="psk"\s+style="width:)[\d.]+%(")/,`$1${skipWidth}%$2`);
html = html.replace(/(id="pf"\s+style="width:)[\d.]+%(")/,  `$1${failWidth}%$2`);

// Legend labels
html = html.replace(/(Passed \()\d+(\))/, `$1${pass}$2`);
html = html.replace(/(Skipped \()\d+(\))/, `$1${skip}$2`);
html = html.replace(/(Failed \()\d+(\))/, `$1${fail}$2`);

// Footer date
html = html.replace(/(Generated )[\d]+ \w+ \d{4}/, `$1${runDate}`);

// ── Patch TESTS array results in the script block ─────────
const results = { ...resultMap }; // TC_01 → 'pass'|'skip'|'fail'
for (const [tc, res] of Object.entries(results)) {
  // Match:  tc:'TC_XX', ..., result:'whatever', reason:'...',
  const escaped = tc.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const newReason = res === 'skip' ? '' : '';
  html = html.replace(
    new RegExp(`(tc:'${escaped}',[^}]*result:)'(?:pass|skip|fail|pend)'(, reason:)'[^']*'`),
    `$1'${res}'$2'${newReason}'`
  );
}

writeFileSync(HTML_PATH, html, 'utf8');
log(`  ${C.green}✓ Report updated:${C.reset} dashboard-test-report.html`);

// ── Open report ───────────────────────────────────────────
const open = process.platform === 'win32' ? 'start' :
             process.platform === 'darwin' ? 'open' : 'xdg-open';
spawnSync(open, [HTML_PATH], { shell: true, detached: true });
log(`  ${C.green}✓ Report opened in browser.${C.reset}\n`);

process.exit(fail > 0 ? 1 : 0);
