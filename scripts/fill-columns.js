const xlsx = require('xlsx');
const fs = require('fs');

// ─── Column indices in the standardised sheet ──────────────────────────
const COL = {
  TEST_ID: 0, MODULE: 1, FUNCTIONALITY: 2, TEST_SCENARIO: 3,
  TC_DESC: 4, PRECONDITIONS: 5, STEP_NO: 6, TEST_DATA: 7,
  EXPECTED: 8, ACTUAL: 9, STATUS: 10, SEVERITY: 11,
  PRIORITY: 12, TEST_TYPE: 13, ENVIRONMENT: 14, AUTO_FEASIBLE: 15,
};

// ─── Keyword → Functionality ──────────────────────────────────────────
function getFunctionality(sheetName, scenario, desc) {
  const t = (scenario + ' ' + desc).toLowerCase();
  const s = sheetName.toLowerCase().trim();

  if (s.includes('onboarding')) {
    if (t.includes('search') || t.includes('install')) return 'App Installation';
    if (t.includes('auth') || t.includes('connect etsy') || t.includes('authentication')) return 'Etsy Authentication';
    if (t.includes('pricing plan') || t.includes('select') && t.includes('plan')) return 'Plan Selection';
    if (t.includes('payment') || t.includes('billing')) return 'Payment & Billing';
    if (t.includes('custom setting') || t.includes('product management') || t.includes('variation')) return 'Onboarding Settings';
    if (t.includes('conversion rate')) return 'Conversion Rate Setup';
    if (t.includes('sync') || t.includes('automatic sync')) return 'Auto Sync Setup';
    if (t.includes('order') && t.includes('manage')) return 'Order Management Setup';
    if (t.includes('tag')) return 'Tag Setup';
    if (t.includes('user guide') || t.includes('support')) return 'Help & Support';
    return 'Onboarding Flow';
  }

  if (s.includes('expired plan') || s.includes('license')) {
    if (t.includes('subscribe') || t.includes('subscription')) return 'Re-subscription';
    if (t.includes('upgrade') || t.includes('downgrade')) return 'Plan Change';
    if (t.includes('billing') || t.includes('shopify billing')) return 'Billing Flow';
    if (t.includes('ui') || t.includes('error') || t.includes('console')) return 'UI Validation';
    return 'License Management';
  }

  if (s.includes('sellers switching') || s.includes('migration')) {
    if (t.includes('warning banner') || t.includes('migration banner')) return 'Migration Banner';
    if (t.includes('coupon') || t.includes('discount')) return 'Migration Discount';
    if (t.includes('progress') || t.includes('checklist') || t.includes('step')) return 'Migration Progress';
    if (t.includes('translation') || t.includes('language') || t.includes('french') || t.includes('italian')) return 'Localisation';
    return 'App Migration';
  }

  if (s.includes('persnol') || s.includes('personali')) {
    if (t.includes('enable') || t.includes('disable') || t.includes('toggle')) return 'Personalisation Toggle';
    if (t.includes('character limit') || t.includes('limit')) return 'Character Limit Validation';
    if (t.includes('instruction')) return 'Personalisation Instructions';
    if (t.includes('save') || t.includes('validation')) return 'Save & Validation';
    if (t.includes('bulk')) return 'Bulk Upload with Personalisation';
    return 'Personalisation';
  }

  if (s === 'dashboard') {
    if (t.includes('profiling') || t.includes('create profiling')) return 'Profiling Banner';
    if (t.includes('product') && (t.includes('analysis') || t.includes('count') || t.includes('pie') || t.includes('badge') || t.includes('bifurcat'))) return 'Product Analysis';
    if (t.includes('top selling') || t.includes('top performing')) return 'Top Selling Products';
    if (t.includes('order') && (t.includes('analysis') || t.includes('count') || t.includes('badge') || t.includes('bifurcat'))) return 'Order Analysis';
    if (t.includes('revenue') || t.includes('bar chart') || t.includes('calendar filter')) return 'Revenue Analytics';
    if (t.includes('rating') || t.includes('feedback')) return 'Feedback & Rating';
    if (t.includes('pricing') || t.includes('plan') || t.includes('upgrade')) return 'Plan Overview';
    if (t.includes('etsy shop status') || t.includes('shop metric')) return 'Etsy Shop Status';
    return 'Dashboard Overview';
  }

  if (s.includes('csb')) {
    if (t.includes('product') && t.includes('edit')) return 'Unsaved Changes – Edit Product';
    if (t.includes('profile')) return 'Unsaved Changes – Profile';
    if (t.includes('shipping template') || (t.includes('template') && t.includes('shipping'))) return 'Unsaved Changes – Shipping Template';
    if (t.includes('inventory template') || (t.includes('template') && t.includes('inventory'))) return 'Unsaved Changes – Inventory Template';
    if (t.includes('price template') || (t.includes('template') && t.includes('price'))) return 'Unsaved Changes – Price Template';
    if (t.includes('policy') || t.includes('return policy')) return 'Unsaved Changes – Policy Template';
    if (t.includes('processing')) return 'Unsaved Changes – Processing Template';
    if (t.includes('settings') || t.includes('product management') || t.includes('order management') || t.includes('notification')) return 'Unsaved Changes – Settings';
    if (t.includes('account status')) return 'Unsaved Changes – Account Status';
    return 'Unsaved Changes (CSB)';
  }

  if (s.includes('webhooks') || s.includes('webhook')) {
    if (t.includes('create') && t.includes('product')) return 'Product Create Webhook';
    if (t.includes('update') && t.includes('product')) return 'Product Update Webhook';
    if (t.includes('delete') && t.includes('product')) return 'Product Delete Webhook';
    if (t.includes('title') || t.includes('tittle')) return 'Product Title Sync';
    if (t.includes('image')) return 'Product Image Sync';
    if (t.includes('inventory')) return 'Inventory Sync';
    if (t.includes('price')) return 'Price Sync';
    if (t.includes('description')) return 'Description Sync';
    if (t.includes('tag')) return 'Tag Sync';
    if (t.includes('weight')) return 'Weight Sync';
    if (t.includes('video')) return 'Video Sync';
    return 'Product Webhook Sync';
  }

  if (s.includes('location test') || s.includes('location ')) {
    if (t.includes('create') && t.includes('location')) return 'Location Create';
    if (t.includes('activate') && t.includes('location')) return 'Location Activation';
    if (t.includes('deactivate') && t.includes('location')) return 'Location Deactivation';
    if (t.includes('delete') && t.includes('location')) return 'Location Deletion';
    if (t.includes('update') && t.includes('location')) return 'Location Update';
    return 'Location Management';
  }

  if (s === 'settings') {
    if (t.includes('etsy shop status') || t.includes('shop status')) return 'Etsy Shop Status Settings';
    if (t.includes('reconnect') || t.includes('suspended') || t.includes('wrong connection') || t.includes('invalid token')) return 'Etsy Reconnection';
    if (t.includes('sync shopify meta') || t.includes('shopify meta')) return 'Shopify Meta Sync';
    if (t.includes('location') || t.includes('inventory location')) return 'Inventory Location Settings';
    if (t.includes('automatic product') || t.includes('auto sync') || t.includes('automatic sync')) return 'Auto Product Sync';
    if (t.includes('product detail') && t.includes('sync')) return 'Product Details Sync Settings';
    if (t.includes('variation management')) return 'Variation Management';
    if (t.includes('inactivate') || t.includes('inactive')) return 'Auto Inactivate Settings';
    if (t.includes('order') && (t.includes('sync') || t.includes('manage'))) return 'Order Sync Settings';
    if (t.includes('cancel') || t.includes('return')) return 'Cancel/Return Settings';
    if (t.includes('shipment') || t.includes('tracking')) return 'Shipment Settings';
    if (t.includes('tax')) return 'Tax Settings';
    if (t.includes('notification') || t.includes('email')) return 'Notification Settings';
    if (t.includes('timezone') || t.includes('time zone')) return 'Timezone Settings';
    if (t.includes('conversion rate')) return 'Conversion Rate';
    if (t.includes('inventory') && t.includes('sync')) return 'Inventory Sync Settings';
    return 'App Settings';
  }

  if (s === 'template') {
    if (t.includes('shipping')) return 'Shipping Template';
    if (t.includes('inventory')) return 'Inventory Template';
    if (t.includes('price') || t.includes('pricing')) return 'Price Template';
    if (t.includes('policy') || t.includes('return')) return 'Policy Template';
    return 'Template Management';
  }

  if (s === 'profiling') {
    if (t.includes('create') || t.includes('new profile')) return 'Create Profile';
    if (t.includes('edit') || t.includes('update')) return 'Edit Profile';
    if (t.includes('category') || t.includes('etsy category')) return 'Category Mapping';
    if (t.includes('variation') && t.includes('mapping')) return 'Variation Mapping';
    if (t.includes('attribute')) return 'Attribute Mapping';
    if (t.includes('delete')) return 'Delete Profile';
    return 'Profile Management';
  }

  if (s === 'product') {
    if (t.includes('upload') || t.includes('bulk upload')) return 'Bulk Product Upload';
    if (t.includes('publish') || t.includes('list')) return 'Product Publishing';
    if (t.includes('sync') && t.includes('product')) return 'Product Sync';
    if (t.includes('edit') || t.includes('update')) return 'Edit Product';
    if (t.includes('image') || t.includes('photo')) return 'Product Images';
    if (t.includes('variation')) return 'Variation Management';
    if (t.includes('price')) return 'Product Pricing';
    if (t.includes('inventory')) return 'Inventory Management';
    if (t.includes('search') || t.includes('filter')) return 'Product Search & Filter';
    if (t.includes('delete') || t.includes('remove')) return 'Delete Product';
    return 'Product Management';
  }

  if (s === 'pricing') {
    if (t.includes('upgrade') || t.includes('subscribe')) return 'Plan Upgrade';
    if (t.includes('downgrade')) return 'Plan Downgrade';
    if (t.includes('cancel') || t.includes('unsubscribe')) return 'Plan Cancellation';
    if (t.includes('billing') || t.includes('invoice')) return 'Billing & Invoice';
    if (t.includes('plan details') || t.includes('plan info')) return 'Plan Details';
    return 'Pricing & Plans';
  }

  if (s === 'activities') {
    if (t.includes('delete')) return 'Delete Activity';
    if (t.includes('filter') || t.includes('search')) return 'Activity Filter';
    return 'Activity Log';
  }

  if (s === 'order') {
    if (t.includes('sync')) return 'Order Sync';
    if (t.includes('cancel') || t.includes('return')) return 'Cancel/Return Order';
    if (t.includes('shipment') || t.includes('tracking') || t.includes('fulfil')) return 'Order Fulfilment';
    if (t.includes('filter') || t.includes('search')) return 'Order Filter & Search';
    if (t.includes('detail') || t.includes('view')) return 'Order Details';
    return 'Order Management';
  }

  if (s.includes('reviews')) {
    if (t.includes('sync')) return 'Review Sync';
    if (t.includes('display') || t.includes('visible')) return 'Review Display';
    return 'Review Management';
  }

  if (s.includes('bundle')) {
    if (t.includes('sync')) return 'Bundle Order Sync';
    if (t.includes('create')) return 'Bundle Order Creation';
    return 'Bundle Orders';
  }

  if (s === 'location') {
    if (t.includes('create')) return 'Location Creation';
    if (t.includes('activate')) return 'Location Activation';
    if (t.includes('deactivate')) return 'Location Deactivation';
    if (t.includes('delete')) return 'Location Deletion';
    if (t.includes('inventory')) return 'Location Inventory';
    return 'Location Management';
  }

  if (s.includes('processing profile') || s.includes('processing')) {
    if (t.includes('create')) return 'Create Processing Profile';
    if (t.includes('edit') || t.includes('update')) return 'Edit Processing Profile';
    if (t.includes('delete')) return 'Delete Processing Profile';
    if (t.includes('processing time')) return 'Processing Time Settings';
    return 'Processing Profile';
  }

  if (s.includes('20 images') || (t.includes('image') && t.includes('20'))) {
    return 'Product Images (20 Images)';
  }

  if (s.includes('coupon')) {
    if (t.includes('create') || t.includes('add')) return 'Create Coupon';
    if (t.includes('edit') || t.includes('update')) return 'Edit Coupon';
    if (t.includes('delete') || t.includes('remove')) return 'Delete Coupon';
    if (t.includes('apply') || t.includes('valid')) return 'Coupon Validation';
    return 'Coupon Code Management';
  }

  return 'General';
}

// ─── Preconditions by module ──────────────────────────────────────────
function getPreconditions(sheetName, existing) {
  if (existing && existing.trim() && existing.toLowerCase() !== 'n/a') return existing;

  const s = sheetName.toLowerCase().trim();

  if (s.includes('onboarding')) return 'Shopify store is set up and accessible.\nCedCommerce Etsy Integration App is being installed for the first time.\nSeller has a valid Etsy account.';
  if (s.includes('expired plan') || s.includes('license')) return 'User is onboarded to CedCommerce Etsy Integration App.\nUser\'s subscription/license has expired.\nUser is logged in.';
  if (s.includes('sellers switching') || s.includes('migration')) return 'User is installing CedCommerce Etsy Integration App while previously using another Etsy app.\nApp is accessible on Shopify App Store.';
  if (s.includes('persnol') || s.includes('personali')) return 'User is logged into CedCommerce Etsy Integration App.\nAt least one profiling profile exists.\nUser is on the Profile section.';
  if (s === 'dashboard') return 'User is logged into CedCommerce Etsy Integration App.\nApp is installed and Etsy store is connected.\nDashboard page is accessible.';
  if (s.includes('csb')) return 'User is logged into CedCommerce Etsy Integration App.\nUser is on a page with editable fields (product, profile, template, or settings).';
  if (s.includes('webhooks') || s.includes('webhook')) return 'User is logged into CedCommerce Etsy Integration App.\nMulti-account setup is configured.\nShopify store is connected and active.';
  if (s.includes('location test') || s.includes('location ')) return 'User is logged into CedCommerce Etsy Integration App.\nMulti-account setup is configured.\nShopify store has at least one active location.';
  if (s === 'settings') return 'User is logged into CedCommerce Etsy Integration App.\nApp is installed and Etsy store is connected.\nUser navigates to the Settings section.';
  if (s === 'template') return 'User is logged into CedCommerce Etsy Integration App.\nApp is installed and Etsy store is connected.\nUser is on the Templates page.';
  if (s === 'profiling') return 'User is logged into CedCommerce Etsy Integration App.\nApp is installed and Etsy store is connected.\nUser is on the Profiling section.';
  if (s === 'product') return 'User is logged into CedCommerce Etsy Integration App.\nApp is installed and Etsy store is connected.\nProducts exist in the Shopify store.';
  if (s === 'pricing') return 'User is logged into CedCommerce Etsy Integration App.\nApp is installed and user is on the Pricing page.';
  if (s === 'activities') return 'User is logged into CedCommerce Etsy Integration App.\nAt least one activity/sync event has been triggered.';
  if (s === 'order') return 'User is logged into CedCommerce Etsy Integration App.\nApp is installed and Etsy store is connected.\nOrders exist in the connected Etsy store.';
  if (s.includes('reviews')) return 'User is logged into CedCommerce Etsy Integration App.\nEtsy store is connected.\nReviews exist on the Etsy store.';
  if (s.includes('bundle')) return 'User is logged into CedCommerce Etsy Integration App.\nEtsy store is connected.\nBundle orders exist in the Etsy store.';
  if (s === 'location') return 'User is logged into CedCommerce Etsy Integration App.\nShopify store has multiple locations configured.';
  if (s.includes('processing')) return 'User is logged into CedCommerce Etsy Integration App.\nApp is installed and Etsy store is connected.\nUser is on the Processing Profiles page.';
  if (s.includes('20 images')) return 'User is logged into CedCommerce Etsy Integration App.\nProducts with images exist in Shopify.\nUser is on the Product section.';
  if (s.includes('coupon')) return 'User is logged into CedCommerce Etsy Integration App.\nEtsy store is connected.\nUser is on the Coupon/Discount section.';

  return 'User is logged into CedCommerce Etsy Integration App.\nApp is installed and Etsy store is connected.';
}

// ─── Severity logic ───────────────────────────────────────────────────
function getSeverity(sheetName, func, desc) {
  const t = (func + ' ' + desc).toLowerCase();
  const s = sheetName.toLowerCase().trim();

  // Critical
  if (t.includes('install') || t.includes('authentication') || t.includes('connect etsy') ||
      t.includes('subscription') || t.includes('license') || t.includes('billing') ||
      t.includes('product sync') || t.includes('order sync') || t.includes('publish') ||
      t.includes('webhook')) return 'Critical';

  // High
  if (t.includes('order') || t.includes('product') || t.includes('profile') ||
      t.includes('settings') || t.includes('sync') || t.includes('redirect') ||
      t.includes('navigation') || t.includes('dashboard') || t.includes('plan') ||
      t.includes('pricing') || t.includes('template') || t.includes('variation') ||
      t.includes('inventory') || t.includes('location') || t.includes('migration') ||
      t.includes('csb') || t.includes('unsaved') || s === 'order' || s === 'product') return 'High';

  // Medium
  if (t.includes('filter') || t.includes('search') || t.includes('display') ||
      t.includes('banner') || t.includes('badge') || t.includes('count') ||
      t.includes('review') || t.includes('activity') || t.includes('coupon') ||
      t.includes('processing') || t.includes('bundle') || t.includes('feedback') ||
      t.includes('image') || t.includes('video') || t.includes('email')) return 'Medium';

  // Low
  if (t.includes('tooltip') || t.includes('alignment') || t.includes('ui') ||
      t.includes('translation') || t.includes('language') || t.includes('color') ||
      t.includes('font') || t.includes('console error')) return 'Low';

  // Sheet-based fallback
  if (s === 'dashboard' || s === 'settings' || s === 'product' || s === 'order') return 'High';
  if (s === 'profiling' || s === 'template' || s === 'pricing') return 'Medium';
  return 'Medium';
}

function getPriority(severity) {
  if (severity === 'Critical') return 'P1';
  if (severity === 'High') return 'P1';
  if (severity === 'Medium') return 'P2';
  return 'P3';
}

// ─── Test Type logic ──────────────────────────────────────────────────
function getTestType(sheetName, desc, existing) {
  // Fix numeric dates (regression dates stored as Excel serial numbers)
  if (typeof existing === 'number' || (typeof existing === 'string' && /^\d{5}$/.test(existing.trim()))) {
    return 'Regression';
  }
  if (existing && typeof existing === 'string' && existing.trim() &&
      !existing.toLowerCase().includes('pending')) {
    return existing.trim();
  }

  const t = (desc || '').toLowerCase();
  const s = sheetName.toLowerCase().trim();

  if (t.includes('install') || t.includes('search') && t.includes('app') || t.includes('load') || t.includes('visible')) return 'Smoke';
  if (t.includes('redirect') || t.includes('navigation') || t.includes('click') || t.includes('verify') || t.includes('submit') || t.includes('save')) return 'Functional';
  if (t.includes('display') || t.includes('ui') || t.includes('alignment') || t.includes('appear')) return 'UI';
  if (t.includes('api') || t.includes('webhook') || t.includes('sync')) return 'Functional';

  if (s.includes('csb')) return 'Functional';
  if (s.includes('webhooks') || s.includes('location test')) return 'Functional';
  if (s.includes('sellers switching') || s.includes('migration')) return 'Functional';
  return 'Functional';
}

// ─── Automation Feasible logic ────────────────────────────────────────
function getAutoFeasible(desc, existing) {
  if (existing && typeof existing === 'string' &&
      (existing.toLowerCase() === 'yes' || existing.toLowerCase() === 'no')) {
    return existing;
  }

  const t = (desc || '').toLowerCase();

  // Manual / not automatable
  if (t.includes('console error') || t.includes('alignment') || t.includes('translation') ||
      t.includes('language') || t.includes('color') || t.includes('font') ||
      t.includes('copy to clipboard') || t.includes('support') || t.includes('user guide') ||
      t.includes('polling') || t.includes('video')) return 'No';

  // Automatable
  if (t.includes('redirect') || t.includes('navigation') || t.includes('visible') ||
      t.includes('display') || t.includes('click') || t.includes('save') ||
      t.includes('verify') || t.includes('subscribe') || t.includes('sync') ||
      t.includes('delete') || t.includes('create') || t.includes('update') ||
      t.includes('toggle') || t.includes('filter') || t.includes('search') ||
      t.includes('install') || t.includes('auth')) return 'Yes';

  return 'Yes';
}

// ─── Main fill logic ──────────────────────────────────────────────────
const srcPath = 'C:/Users/Sameera-2767/Downloads/Etsy Test Cases - Updated.xlsx';
const outPath = 'C:/Users/Sameera-2767/Downloads/Etsy Test Cases - Updated.xlsx';

const wb = xlsx.readFile(srcPath);
const changeLog = [];

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  if (!ws['!ref']) return;

  const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!data.length) return;

  const headerRowIdx = data.findIndex(r => r.some(c => c !== ''));
  if (headerRowIdx === -1) return;

  let sheetChanges = 0;

  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row.some(c => c !== '')) continue; // skip fully empty rows

    const testId = row[COL.TEST_ID];
    if (!testId) continue; // skip rows without a test ID

    const scenario = String(row[COL.TEST_SCENARIO] || '');
    const desc     = String(row[COL.TC_DESC] || '');

    // Functionality
    if (!row[COL.FUNCTIONALITY] || row[COL.FUNCTIONALITY] === '') {
      row[COL.FUNCTIONALITY] = getFunctionality(sheetName, scenario, desc);
      sheetChanges++;
    }

    // Preconditions
    const existingPre = String(row[COL.PRECONDITIONS] || '');
    if (!existingPre || existingPre.toLowerCase() === 'n/a' || existingPre.trim() === '') {
      row[COL.PRECONDITIONS] = getPreconditions(sheetName, existingPre);
      sheetChanges++;
    }

    // Severity
    if (!row[COL.SEVERITY] || row[COL.SEVERITY] === '') {
      const func = String(row[COL.FUNCTIONALITY] || '');
      row[COL.SEVERITY] = getSeverity(sheetName, func, desc);
      sheetChanges++;
    }

    // Priority
    if (!row[COL.PRIORITY] || row[COL.PRIORITY] === '') {
      row[COL.PRIORITY] = getPriority(String(row[COL.SEVERITY]));
      sheetChanges++;
    }

    // Test Type — also fix date serial numbers
    const existingTT = row[COL.TEST_TYPE];
    if (!existingTT || existingTT === '' || typeof existingTT === 'number' ||
        (typeof existingTT === 'string' && /^\d{5}$/.test(existingTT.trim()))) {
      row[COL.TEST_TYPE] = getTestType(sheetName, desc, existingTT);
      sheetChanges++;
    }

    // Environment
    if (!row[COL.ENVIRONMENT] || row[COL.ENVIRONMENT] === '') {
      row[COL.ENVIRONMENT] = 'QA';
      sheetChanges++;
    }

    // Automation Feasible — also fix "Pending"
    const existingAF = String(row[COL.AUTO_FEASIBLE] || '');
    if (!existingAF || existingAF.toLowerCase() === 'pending' || existingAF === '') {
      row[COL.AUTO_FEASIBLE] = getAutoFeasible(desc, existingAF);
      sheetChanges++;
    }
  }

  const newWs = xlsx.utils.aoa_to_sheet(data);
  newWs['!cols'] = [
    {wch:10},{wch:14},{wch:28},{wch:40},{wch:60},
    {wch:50},{wch:60},{wch:20},{wch:60},{wch:30},
    {wch:10},{wch:10},{wch:10},{wch:15},{wch:12},{wch:20},
  ];
  wb.Sheets[sheetName] = newWs;
  changeLog.push({ sheet: sheetName, cells: sheetChanges });
  console.log(`${sheetName}: ${sheetChanges} cells filled`);
});

xlsx.writeFile(wb, outPath);
console.log('\nSaved to:', outPath);
console.log('\n── Summary ──');
let total = 0;
changeLog.forEach(({ sheet, cells }) => {
  console.log(`  ${sheet}: ${cells} cells`);
  total += cells;
});
console.log(`  TOTAL: ${total} cells filled across ${changeLog.length} sheets`);
