const xlsx = require('xlsx');

// Required columns in exact order
const REQUIRED = [
  'Test ID',
  'Module',
  'Functionality',
  'Test Scenario',
  'Test Case Description',
  'Preconditions',
  'Step No',
  'Test Data',
  'Expected Result',
  'Actual Result',
  'Status',
  'Severity',
  'Priority',
  'Test Type',
  'Environment',
  'Automation Feasible',
];

const srcPath = 'C:/Users/Sameera-2767/Downloads/Etsy Test Cases - Updated.xlsx';
const outPath = 'C:/Users/Sameera-2767/Downloads/Etsy Test Cases - Updated.xlsx';

const wb = xlsx.readFile(srcPath);

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  if (!ws['!ref']) return;

  const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!data.length) return;

  // Find header row (first row with any content)
  const headerRowIdx = data.findIndex(r => r.some(c => c !== ''));
  if (headerRowIdx === -1) return;

  const existingHeaders = data[headerRowIdx].map(h => (h ? String(h).trim() : ''));

  // Build index map: column name → index in existing data
  const existingMap = {};
  existingHeaders.forEach((h, i) => { if (h) existingMap[h] = i; });

  // Rebuild every row with REQUIRED column order
  const newData = data.map((row, rowIdx) => {
    if (rowIdx === headerRowIdx) {
      // Header row: write the required column names
      return REQUIRED;
    }
    // Data rows: map existing values, empty string for missing columns
    return REQUIRED.map(col => {
      const idx = existingMap[col];
      return idx !== undefined ? (row[idx] !== undefined ? row[idx] : '') : '';
    });
  });

  // Prepend any rows before the header row unchanged (edge case)
  // (headerRowIdx is almost always 0, but handle it anyway)
  const finalData = [
    ...data.slice(0, headerRowIdx).map(() => Array(REQUIRED.length).fill('')),
    ...newData.slice(headerRowIdx),
  ];

  const newWs = xlsx.utils.aoa_to_sheet(finalData);

  // Set column widths
  newWs['!cols'] = [
    {wch:10}, // Test ID
    {wch:14}, // Module
    {wch:20}, // Functionality
    {wch:35}, // Test Scenario
    {wch:50}, // Test Case Description
    {wch:40}, // Preconditions
    {wch:50}, // Step No
    {wch:20}, // Test Data
    {wch:50}, // Expected Result
    {wch:30}, // Actual Result
    {wch:10}, // Status
    {wch:10}, // Severity
    {wch:10}, // Priority
    {wch:15}, // Test Type
    {wch:12}, // Environment
    {wch:20}, // Automation Feasible
  ];

  wb.Sheets[sheetName] = newWs;
  console.log(`${sheetName}: done`);
});

xlsx.writeFile(wb, outPath);
console.log('\nSaved to:', outPath);

// Verify
const wb2 = xlsx.readFile(outPath);
wb2.SheetNames.forEach(name => {
  const ws = wb2.Sheets[name];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
  const header = data.find(r => r.some(c => c));
  const missing = REQUIRED.filter(c => !header.includes(c));
  if (missing.length) console.log(`  MISSING in ${name}: ${missing.join(', ')}`);
});
console.log('All sheets verified.');
