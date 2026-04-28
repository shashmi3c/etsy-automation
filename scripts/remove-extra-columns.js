const xlsx = require('xlsx');

const ALLOWED = new Set([
  'Test ID', 'Module', 'Functionality', 'Test Scenario', 'Test Case Description',
  'Preconditions', 'Step No', 'Test Data', 'Expected Result', 'Actual Result',
  'Status', 'Severity', 'Priority', 'Test Type', 'Environment', 'Automation Feasible'
]);

const srcPath = 'C:/Users/Sameera-2767/Downloads/Etsy Test Cases - Updated.xlsx';
const outPath = 'C:/Users/Sameera-2767/Downloads/Etsy Test Cases - Updated.xlsx';

const wb = xlsx.readFile(srcPath);

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  if (!ws['!ref']) return;

  // Read as array of arrays
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!data.length) return;

  // Find header row index (first row with any content)
  let headerRowIdx = data.findIndex(r => r.some(c => c !== ''));
  if (headerRowIdx === -1) return;

  const headers = data[headerRowIdx].map(h => (h ? String(h).trim() : ''));

  // Determine which column indices to keep
  const keepCols = headers
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => ALLOWED.has(h))
    .map(({ i }) => i);

  // If nothing to remove, skip
  if (keepCols.length === headers.length) {
    const removed = headers.filter(h => h && !ALLOWED.has(h));
    if (removed.length === 0) return;
  }

  // Filter every row to only kept columns
  const filtered = data.map(row => keepCols.map(i => row[i] !== undefined ? row[i] : ''));

  // Replace sheet
  const newWs = xlsx.utils.aoa_to_sheet(filtered);
  wb.Sheets[sheetName] = newWs;

  const removed = headers.filter(h => h && !ALLOWED.has(h));
  if (removed.length) console.log(`${sheetName}: removed [${removed.join(', ')}]`);
});

xlsx.writeFile(wb, outPath);
console.log('\nDone. Saved to:', outPath);

// Print final headers per sheet
const wb2 = xlsx.readFile(outPath);
wb2.SheetNames.forEach(name => {
  const ws = wb2.Sheets[name];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
  const header = data.find(r => r.some(c => c));
  console.log(name + ': ' + JSON.stringify(header));
});
