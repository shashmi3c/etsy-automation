import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'templates-results.json'), 'utf8'));

const testDetails = [];
function walk(suite) {
  if (suite.specs) {
    for (const spec of suite.specs) {
      for (const test of spec.tests) {
        testDetails.push({
          name: spec.title,
          status: test.results[0]?.status || 'unknown',
          duration: test.results[0]?.duration || 0,
        });
      }
    }
  }
  if (suite.suites) suite.suites.forEach(s => walk(s));
}
(data.suites || []).forEach(s => walk(s));

const total = testDetails.length;
const passed = testDetails.filter(t => t.status === 'passed').length;
const failed = testDetails.filter(t => t.status === 'failed').length;
const skipped = testDetails.filter(t => t.status === 'skipped').length;
const totalDurationSec = (testDetails.reduce((a, t) => a + t.duration, 0) / 1000).toFixed(1);
const totalDurationMin = (totalDurationSec / 60).toFixed(1);

const reportDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const wb = XLSX.utils.book_new();

// ── Sheet 1: Summary ──────────────────────────────────────────────
const summaryData = [
  ['QA Test Execution Report – Etsy Templates (Functional)'],
  [],
  ['Module', 'Etsy Integration App – Templates'],
  ['Tested By', 'Sameera (QA Automation)'],
  ['Test Date', reportDate],
  ['Test File', 'templates-functional.spec.js'],
  ['Execution Type', 'Automated – Playwright'],
  [],
  ['SUMMARY', ''],
  ['Total Test Cases', total],
  ['Passed', passed],
  ['Failed', failed],
  ['Skipped', skipped],
  ['Pass Rate', `${((passed / total) * 100).toFixed(1)}%`],
  ['Total Duration', `${totalDurationMin} min (${totalDurationSec}s)`],
  [],
  ['MODULES COVERED', ''],
  ['Shipping Templates', 'Create, Edit, Filter, Sort, Fetch from Etsy, Delete'],
  ['Inventory Templates', 'Create, Edit, Filter, Sort, Fetch from Etsy, Delete'],
  ['Price Templates', 'Create, Edit, Filter, Sort, Fetch from Etsy, Delete'],
  ['Policy Templates', 'Create, Edit, Filter by Days, Sort, Fetch from Etsy, Delete'],
  ['Shop Sections', 'Create, Edit, Filter, Sort, Fetch from Etsy, Delete'],
  ['Production Partners', 'Fetch from Etsy, Filter'],
  ['Processing Profiles', 'Create, Edit, Filter, Sort, Fetch from Etsy, Delete'],
];

const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
wsSummary['!cols'] = [{ wch: 30 }, { wch: 55 }];
wsSummary['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

// ── Sheet 2: Test Case Results ────────────────────────────────────
const headers = ['#', 'Test Case ID', 'Test Case Title', 'Module', 'Status', 'Duration (s)'];

function getModule(name) {
  if (name.includes('Shipping')) return 'Shipping Templates';
  if (name.includes('Inventory')) return 'Inventory Templates';
  if (name.includes('Price')) return 'Price Templates';
  if (name.includes('Policy')) return 'Policy Templates';
  if (name.includes('Shop Sections')) return 'Shop Sections';
  if (name.includes('Production Partners')) return 'Production Partners';
  if (name.includes('Processing Profiles')) return 'Processing Profiles';
  return 'Other';
}

const tcRows = testDetails.map((t, i) => {
  const idMatch = t.name.match(/^(TC_\d+):/);
  const tcId = idMatch ? idMatch[1] : `TC_${String(i + 1).padStart(2, '0')}`;
  const titleClean = t.name.replace(/^TC_\d+:\s*/, '');
  return [
    i + 1,
    tcId,
    titleClean,
    getModule(t.name),
    t.status.toUpperCase(),
    (t.duration / 1000).toFixed(1),
  ];
});

const wsResults = XLSX.utils.aoa_to_sheet([headers, ...tcRows]);
wsResults['!cols'] = [
  { wch: 5 },
  { wch: 12 },
  { wch: 50 },
  { wch: 25 },
  { wch: 10 },
  { wch: 14 },
];
XLSX.utils.book_append_sheet(wb, wsResults, 'Test Results');

// ── Sheet 3: Module-wise Breakdown ────────────────────────────────
const modules = [
  'Shipping Templates',
  'Inventory Templates',
  'Price Templates',
  'Policy Templates',
  'Shop Sections',
  'Production Partners',
  'Processing Profiles',
];

const breakdownHeaders = ['Module', 'Total TCs', 'Passed', 'Failed', 'Skipped', 'Duration (s)'];
const breakdownRows = modules.map(mod => {
  const modTests = testDetails.filter(t => getModule(t.name) === mod);
  return [
    mod,
    modTests.length,
    modTests.filter(t => t.status === 'passed').length,
    modTests.filter(t => t.status === 'failed').length,
    modTests.filter(t => t.status === 'skipped').length,
    (modTests.reduce((a, t) => a + t.duration, 0) / 1000).toFixed(1),
  ];
});
breakdownRows.push([
  'TOTAL',
  total,
  passed,
  failed,
  skipped,
  totalDurationSec,
]);

const wsBreakdown = XLSX.utils.aoa_to_sheet([breakdownHeaders, ...breakdownRows]);
wsBreakdown['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
XLSX.utils.book_append_sheet(wb, wsBreakdown, 'Module Breakdown');

const outputPath = path.join(__dirname, '..', 'Templates_QA_Report.xlsx');
XLSX.writeFile(wb, outputPath);
console.log(`Report generated: ${outputPath}`);
console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed} | Duration: ${totalDurationMin} min`);
