/**
 * Activities Test Runner
 * Runs all TC_38–TC_56 activities test cases, parses results, and updates the HTML report.
 *
 * Usage:  node scripts/activities-runner.mjs
 */

import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'activities-test-report.html');

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
log(`${C.bold}${C.cyan}  Etsy Activities · Test Runner${C.reset}`);
log(line());
log(`${C.dim}  Running TC_38–TC_56 against live store…${C.reset}\n`);

const proc = spawnSync(
  'npx',
  ['playwright', 'test', 'tests/activities.spec.js',
   '--project=etsy-authenticated', '--reporter=json'],
  { cwd: ROOT, encoding: 'utf8', timeout: 1_200_000, shell: true }
);

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
const resultMap = {};

function walkSuites(suites) {
  if (!suites) return;
  for (const suite of suites) {
    walkSuites(suite.suites);
    for (const spec of (suite.specs || [])) {
      const match = spec.title.match(/^(TC_\d+)/);
      if (!match) continue;
      const tcId = match[1];
      const t    = spec.tests?.[0];
      if (!t) continue;
      const status = t.results?.[0]?.status || t.status || 'unknown';
      if (status === 'passed')       resultMap[tcId] = 'pass';
      else if (status === 'skipped') resultMap[tcId] = 'skip';
      else                           resultMap[tcId] = 'fail';
    }
  }
}

walkSuites(playwrightData.suites);

// ── Print summary table ───────────────────────────────────
const pass  = Object.values(resultMap).filter(r => r === 'pass').length;
const skip  = Object.values(resultMap).filter(r => r === 'skip').length;
const fail  = Object.values(resultMap).filter(r => r === 'fail').length;
const total = pass + skip + fail;

log('\n' + line());
log(`${C.bold}  Results${C.reset}`);
log(line());

for (const [tc, result] of Object.entries(resultMap)) {
  const icon  = result === 'pass' ? `${C.green}✓` : result === 'skip' ? `${C.yellow}⊘` : `${C.red}✕`;
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

const tcResultJs = Object.entries(resultMap)
  .map(([tc, r]) => `"${tc}":"${r}"`)
  .join(',');

const patch = `// ── Auto-patched by runner ────────────────────────────────
  (function applyRunResults() {
    const RUN_RESULTS = {${tcResultJs}};
    const RUN_DATE    = "${new Date().toISOString()}";
    const RUN_PASS    = ${pass};
    const RUN_SKIP    = ${skip};
    const RUN_FAIL    = ${fail};
    const RUN_TOTAL   = ${total};

    for (const t of TESTS) {
      if (RUN_RESULTS[t.tc] !== undefined) t.result = RUN_RESULTS[t.tc];
    }

    document.getElementById('cnt-all').textContent  = RUN_TOTAL;
    document.getElementById('cnt-pass').textContent = RUN_PASS;
    document.getElementById('cnt-skip').textContent = RUN_SKIP;
    document.getElementById('cnt-fail').textContent = RUN_FAIL;
    document.getElementById('prog-pass').style.width = (RUN_PASS/RUN_TOTAL*100).toFixed(1)+'%';
    document.getElementById('prog-skip').style.width = (RUN_SKIP/RUN_TOTAL*100).toFixed(1)+'%';
    document.getElementById('prog-fail').style.width = (RUN_FAIL/RUN_TOTAL*100).toFixed(1)+'%';

    const d = new Date(RUN_DATE);
    document.getElementById('run-date').textContent =
      d.toLocaleDateString('en-US', { weekday:'short', year:'numeric', month:'short', day:'numeric' }) +
      '  ' + d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });

    const banner = document.getElementById('not-run-notice');
    if (banner) banner.style.display = 'none';

    setFilter('all');
  })();
// <!--RUNNER_INJECT-->`;

// Replace everything between the stable marker comments (idempotent on re-runs)
html = html.replace(/\/\/ <!--RUNNER_INJECT-->[\s\S]*?\/\/ <!--RUNNER_INJECT-->/, patch);
// First run — marker exists once; just replace it
html = html.replace(/\/\/ <!--RUNNER_INJECT-->/, patch);

writeFileSync(HTML_PATH, html, 'utf8');
log(`  ${C.green}✓ Report updated:${C.reset} activities-test-report.html`);

const open = process.platform === 'win32' ? 'start' :
             process.platform === 'darwin' ? 'open' : 'xdg-open';
spawnSync(open, [HTML_PATH], { shell: true, detached: true });
log(`  ${C.green}✓ Report opened in browser.${C.reset}\n`);

process.exit(fail > 0 ? 1 : 0);
