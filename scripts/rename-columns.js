const xlsx = require('xlsx');

// Mapping: original column name → new column name
const RENAME = {
  // ID
  'Test case ID':   'Test ID',
  'Testcase ID':    'Test ID',
  'Test Case ID':   'Test ID',
  'TC ID':          'Test ID',

  // Module
  'Feature':        'Module',
  'Section':        'Module',

  // Test case text
  'Test cases':     'Test Case Description',
  'Test Case':      'Test Case Description',

  // Steps
  'Test steps':     'Step No',
  'Test Steps':     'Step No',

  // Pre-condition
  'Pre Condition':  'Preconditions',

  // Test data
  'Test data':      'Test Data',

  // Expected
  'Expected result': 'Expected Result',

  // Actual
  'Actual result':  'Actual Result',

  // Status
  'Result':         'Status',

  // Automation
  'Automated':      'Automation Feasible',

  // Test type
  'regression':     'Test Type',
  'Type of testing':'Test Type',

  // Severity stays as-is (already matches)
  // Test Scenario stays as-is
  // Status stays as-is
  // Preconditions stays as-is (20 images / Coupon code already have it)
  // Expected Result stays as-is
  // Actual Result stays as-is
  // Step No (from Test Steps) handled above
};

const srcPath = 'C:/Users/Sameera-2767/Downloads/Etsy new test cases (1).xlsx';
const outPath = 'C:/Users/Sameera-2767/Downloads/Etsy Test Cases - Updated.xlsx';

const wb = xlsx.readFile(srcPath);

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];

  // Get the range
  const range = xlsx.utils.decode_range(ws['!ref'] || 'A1');

  // Find the first non-empty row (header row)
  let headerRow = -1;
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = ws[xlsx.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v) { headerRow = R; break; }
    }
    if (headerRow !== -1) break;
  }

  if (headerRow === -1) return; // empty sheet

  // Rename each header cell
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = xlsx.utils.encode_cell({ r: headerRow, c: C });
    const cell = ws[addr];
    if (!cell || !cell.v) continue;

    const original = String(cell.v).trim();
    const renamed = RENAME[original];
    if (renamed) {
      cell.v = renamed;
      if (cell.w) cell.w = renamed; // update cached formatted text too
    }
  }
});

xlsx.writeFile(wb, outPath);
console.log('Done. Saved to:', outPath);

// Print a summary of what changed per sheet
const wb2 = xlsx.readFile(outPath);
wb2.SheetNames.forEach(name => {
  const ws = wb2.Sheets[name];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
  const header = data.find(r => r.some(c => c));
  console.log(name + ': ' + JSON.stringify(header));
});
