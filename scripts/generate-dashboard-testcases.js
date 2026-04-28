const xlsx = require('xlsx');

const srcPath = 'C:/Users/Sameera-2767/Downloads/Etsy Test Cases - Updated.xlsx';
const wb = xlsx.readFile(srcPath);

const PRE = 'User is logged into CedCommerce Etsy Integration App.\nApp is installed and connected to Etsy store.\nDashboard page is accessible.';
const PRE_PROFILE = 'User is logged in.\nApp is installed.\nNo profiling profile created yet.';
const PRE_PROFILE_EXISTS = 'User is logged in.\nApp is installed.\nAt least one profiling profile already exists.';
const PRE_ORDERS = 'User is logged in.\nOrders exist in the connected Etsy store.';
const PRE_ACTIVITIES = 'User is logged in.\nAt least one sync or app action has been triggered in the current session.';

const rows = [
  ['Test ID','Module','Functionality','Test Scenario','Test Case Description','Preconditions','Step No','Test Data','Expected Result','Actual Result','Status','Severity','Priority','Test Type','Environment','Automation Feasible'],

  // ─── Profiling Banner ───
  ['TC_001','Dashboard','Profiling Banner','Create Profiling option is displayed on Dashboard',
   'Verify that the dashboard displays the Create Profiling option when no profile exists.',
   PRE_PROFILE,
   '1. Log in to CedCommerce Etsy Integration App.\n2. Navigate to the dashboard.\n3. Check if the Create Profiling option is visible.',
   'N/A','The Create Profiling option is displayed on the dashboard.','','Pass','Medium','P2','Functional','QA','No'],

  ['TC_002','Dashboard','Profiling Banner','Profiling benefits message is displayed',
   'Verify that a brief message explaining the benefits of profiling functionalities is visible on the dashboard.',
   PRE_PROFILE,
   '1. Log in to CedCommerce Etsy Integration App.\n2. Navigate to the dashboard.\n3. Check for the profiling benefits message near the Create Profiling option.',
   'N/A','A brief message explaining profiling benefits is visible alongside the Create Profiling option.','','Pass','Low','P3','Functional','QA','No'],

  ['TC_003','Dashboard','Profiling Banner','"Watch Tutorial" link redirects to tutorial page',
   'Verify that clicking the Watch Tutorial link redirects the user to the tutorial page.',
   PRE_PROFILE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Watch Tutorial link in the profiling banner section.\n3. Click the Watch Tutorial link.\n4. Verify the URL or page of the redirect destination.',
   'N/A','User is redirected to the tutorial page.','','Pass','Medium','P2','Functional','QA','No'],

  ['TC_004','Dashboard','Profiling Banner','"Learn more about profiling" link redirects to user guide',
   'Verify that clicking the Learn more about profiling link redirects to the profiling user guide.',
   PRE_PROFILE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Learn more about profiling link.\n3. Click the link.\n4. Verify the redirect destination is the profiling user guide.',
   'N/A','User is redirected to the profiling user guide page.','','Pass','Medium','P2','Functional','QA','No'],

  ['TC_005','Dashboard','Profiling Banner','Profiling banner is hidden when a profile already exists',
   'Verify that the Create Profiling option is NOT displayed if the seller has already created at least one profile.',
   PRE_PROFILE_EXISTS,
   '1. Log in with an account that already has at least one profiling profile.\n2. Navigate to the dashboard.\n3. Check whether the Create Profiling option or profiling banner is visible.',
   'Account with existing profiling profile','The Create Profiling option/banner is NOT displayed on the dashboard.','','Pass','Medium','P2','Functional','QA','No'],

  // ─── Product Analysis ───
  ['TC_006','Dashboard','Product Analysis','Total products count is displayed',
   'Verify that the total count of the seller\'s products is displayed in the Product Analysis section.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Product Analysis section.\n3. Check the total products count value is displayed.',
   'N/A','Total product count is displayed and reflects the number of products in the connected store.','','Pass','High','P1','Functional','QA','Yes'],

  ['TC_007','Dashboard','Product Analysis','Product status bifurcation badges are displayed (Active, Not Published, Not Profiled, Others)',
   'Verify that products are bifurcated by status with individual counts for Active, Not Published, Not Profiled, and Others.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Product Analysis section.\n3. Verify status badges and counts are visible for: Active, Not Published, Not Profiled, Others.',
   'N/A','Status badges with counts are visible for Active, Not Published, Not Profiled, and Others.','','Pass','High','P1','Functional','QA','Yes'],

  ['TC_008','Dashboard','Product Analysis','Product pie chart is rendered correctly',
   'Verify that the pie chart in the Product Analysis section renders and displays correctly.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Product Analysis section.\n3. Verify the pie chart is rendered and visible with segment data.',
   'N/A','Pie chart is displayed correctly, reflecting the product status distribution.','','Pass','Medium','P2','UI','QA','No'],

  ['TC_009','Dashboard','Product Analysis','"View All Products" button redirects to Products/Listings page',
   'Verify that clicking the View All Products button in the Product Analysis section navigates to the Products or Listings page.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the View All Products button in the Product Analysis section.\n3. Click the button.\n4. Verify the URL contains listings or products.',
   'N/A','User is redirected to the Products/Listings page.','','Pass','High','P1','Functional','QA','Yes'],

  // ─── Top Selling Products ───
  ['TC_010','Dashboard','Top Selling Products','Top selling products list shows titles and listing IDs',
   'Verify that the Top Selling/Performing Products section displays product titles and Etsy listing IDs.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Top Selling/Performing Products section.\n3. Verify each listed product shows a title and an Etsy listing ID.',
   'N/A','Top selling products are listed with their product titles and Etsy listing IDs.','','Pass','Medium','P2','Functional','QA','Yes'],

  // ─── Order Analysis ───
  ['TC_011','Dashboard','Order Analysis','Total orders count is displayed',
   'Verify that the total count of orders is displayed in the Order Analysis section.',
   PRE_ORDERS,
   '1. Log in and navigate to the dashboard.\n2. Locate the Order Analysis section.\n3. Check that the total orders count value is displayed.',
   'N/A','Total orders count is displayed and reflects the actual number of orders.','','Pass','High','P1','Functional','QA','Yes'],

  ['TC_012','Dashboard','Order Analysis','Order status bifurcation badges are displayed (Total, Paid, Failed, Completed, Others)',
   'Verify that orders are bifurcated by status with individual counts for Total Orders, Paid, Failed, Completed, and Others.',
   PRE_ORDERS,
   '1. Log in and navigate to the dashboard.\n2. Locate the Order Analysis section.\n3. Verify status badges and counts are visible for: Total Orders, Paid, Failed, Completed, Others.',
   'N/A','Status badges with counts are visible for Total Orders, Paid, Failed, Completed, and Others.','','Pass','High','P1','Functional','QA','Yes'],

  ['TC_013','Dashboard','Order Analysis','Order pie chart is rendered correctly',
   'Verify that the pie chart in the Order Analysis section renders and displays correctly.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Order Analysis section.\n3. Verify the pie chart is rendered and visible.',
   'N/A','Pie chart is displayed correctly reflecting order status distribution.','','Pass','Medium','P2','UI','QA','No'],

  ['TC_014','Dashboard','Order Analysis','"View All Orders" button redirects to Orders page',
   'Verify that clicking the View All Orders button in the Order Analysis section navigates to the Orders page.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the View All Orders button in Order Analysis.\n3. Click the button.\n4. Verify the URL contains orders.',
   'N/A','User is redirected to the Orders page.','','Pass','High','P1','Functional','QA','Yes'],

  // ─── Revenue ───
  ['TC_015','Dashboard','Revenue','Total Revenue analytics section is visible',
   'Verify that the Total Revenue/Revenue Analytics section is visible on the dashboard.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Revenue/Revenue Analytics section.\n3. Verify the section is visible.',
   'N/A','Revenue analytics section is visible on the dashboard.','','Pass','High','P1','Functional','QA','Yes'],

  ['TC_016','Dashboard','Revenue','Revenue bar chart is displayed',
   'Verify that revenue data is visually represented with a bar chart in the Revenue section.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Revenue section.\n3. Verify a bar chart is rendered and visible.',
   'N/A','Revenue bar chart is displayed correctly.','','Pass','Medium','P2','UI','QA','No'],

  ['TC_017','Dashboard','Revenue','Revenue date filter is visible (Last 7 days)',
   'Verify that a date filter (e.g., Last 7 days dropdown) is present in the Revenue section.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Revenue section.\n3. Check if the date filter dropdown or calendar is visible.\n4. Verify it shows a default value such as Last 7 days.',
   'N/A','Revenue date filter (e.g., Last 7 days) is visible in the Revenue section.','','Pass','Medium','P2','Functional','QA','Yes'],

  // ─── Feedback ───
  ['TC_018','Dashboard','Feedback','Feedback section is visible with Good and Bad buttons',
   'Verify that the app rating/feedback section is displayed on the dashboard with Good and Bad response buttons.',
   'User is logged in.\nUser has not previously submitted feedback in this session.',
   '1. Log in and navigate to the dashboard.\n2. Locate the feedback or rating section.\n3. Verify the Good button is visible.\n4. Verify the Bad button is visible.',
   'N/A','Feedback section is visible with both Good and Bad response buttons present.','','Pass','Low','P3','Functional','QA','Yes'],

  // ─── Plan Overview ───
  ['TC_019','Dashboard','Plan Overview','Plan details are displayed (Active Plan, Amount, Status, Billing Date, Order Limit, Listings)',
   'Verify that the Plan Overview section displays complete plan information including Active Plan, Plan Amount, Plan Status, Billing Date, Monthly Order Limit, and Manage Listings.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Plan Overview/Pricing Info section.\n3. Verify the following fields are visible: Active Plan, Plan Amount, Plan Status, Billing Date, Monthly Order Limit, Manage Listings.',
   'N/A','All plan details are displayed: Active Plan, Amount, Status, Billing Date, Order Limit, and Listings count.','','Pass','High','P1','Functional','QA','Yes'],

  ['TC_020','Dashboard','Plan Overview','"View Plan Details" or "Upgrade Plan" link redirects to Pricing page',
   'Verify that clicking the View Plan Details or Upgrade Plan link in the Plan Overview section redirects to the Pricing section.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the View Plan Details or Upgrade Plan link in the Plan Overview section.\n3. Click the link.\n4. Verify the URL contains pricing.',
   'N/A','User is redirected to the Pricing plan page.','','Pass','High','P1','Functional','QA','Yes'],

  // ─── Etsy Shop Status ───
  ['TC_021','Dashboard','Etsy Shop Status','Etsy Shop Status metrics are displayed',
   'Verify that the Etsy Shop Status section displays relevant shop metrics such as customizable orders and languages.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Etsy Shop Status section.\n3. Verify shop metrics (e.g., customizable orders, languages) are displayed.',
   'N/A','Etsy shop status metrics are displayed accurately in the section.','','Pass','Medium','P2','Functional','QA','Yes'],

  // ─── NEW TCs from Playwright Automation ───

  ['TC_022','Dashboard','General','Dashboard page loads with visible content',
   'Verify that the dashboard page loads successfully and displays main content after authentication.',
   PRE,
   '1. Log in to CedCommerce Etsy Integration App.\n2. Navigate to the dashboard URL (panel/overview).\n3. Verify that the main dashboard content is visible.',
   'N/A','Dashboard page loads and main content is visible without errors.','','-','Critical','P1','Smoke','QA','Yes'],

  ['TC_023','Dashboard','General','"New to the app?" onboarding banner is visible with Watch Guide button',
   'Verify that the "New to the app?" onboarding banner is shown with a Watch Guide button for users who have not dismissed it.',
   'User is logged in.\nUser has not previously dismissed the onboarding banner.',
   '1. Log in as a user who has not dismissed the onboarding banner.\n2. Navigate to the dashboard.\n3. Verify the "New to the app?" banner is visible.\n4. Verify the Watch Guide button is present in the banner.',
   'N/A','"New to the app?" banner is visible and contains the Watch Guide button.','','-','Medium','P2','Functional','QA','Yes'],

  ['TC_024','Dashboard','General','Refresh Data button is visible on the dashboard',
   'Verify that the Refresh Data button is present and visible on the main dashboard page.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Refresh Data button in the dashboard header/toolbar.\n3. Verify it is visible.',
   'N/A','Refresh Data button is visible on the dashboard.','','-','Medium','P2','UI','QA','Yes'],

  ['TC_025','Dashboard','Order Analysis','Order Analysis section is visible on the dashboard',
   'Verify that the Order Analysis section is rendered and visible as a distinct section on the dashboard.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Scroll to the Order Analysis section.\n3. Verify the Order Analysis section heading and content is visible.',
   'N/A','Order Analysis section is visible on the dashboard.','','-','High','P1','Smoke','QA','Yes'],

  ['TC_026','Dashboard','Order Analysis','Clicking "Paid" order badge redirects to filtered orders page',
   'Verify that clicking the Paid status badge in the Order Analysis section redirects to the Orders page filtered by Paid status.',
   PRE_ORDERS,
   '1. Log in and navigate to the dashboard.\n2. Locate the Paid badge in the Order Analysis section.\n3. Click the Paid badge.\n4. Wait for navigation.\n5. Verify the URL contains orders.',
   'N/A','User is redirected to the Orders page (filtered by Paid status).','','-','High','P1','Functional','QA','Yes'],

  ['TC_027','Dashboard','Order Analysis','Clicking "Failed" order badge redirects to filtered orders page',
   'Verify that clicking the Failed status badge in the Order Analysis section redirects to the Orders page filtered by Failed status.',
   PRE_ORDERS,
   '1. Log in and navigate to the dashboard.\n2. Locate the Failed badge in the Order Analysis section.\n3. Click the Failed badge.\n4. Wait for navigation.\n5. Verify the URL contains orders.',
   'N/A','User is redirected to the Orders page (filtered by Failed status).','','-','High','P1','Functional','QA','Yes'],

  ['TC_028','Dashboard','Order Analysis','Clicking "Completed" order badge redirects to filtered orders page',
   'Verify that clicking the Completed status badge in the Order Analysis section redirects to the Orders page showing Completed orders.',
   PRE_ORDERS,
   '1. Log in and navigate to the dashboard.\n2. Locate the Completed badge in the Order Analysis section.\n3. Click the Completed badge.\n4. Wait for navigation.\n5. Verify the URL contains orders.',
   'N/A','User is redirected to the Orders page (filtered by Completed status).','','-','High','P1','Functional','QA','Yes'],

  ['TC_029','Dashboard','Product Analysis','Product Analysis section is visible on the dashboard',
   'Verify that the Product Analysis section is rendered and visible as a distinct section on the dashboard.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Scroll to the Product Analysis section.\n3. Verify the Product Analysis section heading and content is visible.',
   'N/A','Product Analysis section is visible on the dashboard.','','-','High','P1','Smoke','QA','Yes'],

  ['TC_030','Dashboard','Product Analysis','Clicking "Active" product badge redirects to listings page',
   'Verify that clicking the Active status badge in the Product Analysis section redirects to the Listings/Products page filtered by Active status.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Active badge in the Product Analysis section.\n3. Click the Active badge.\n4. Wait for navigation.\n5. Verify the URL contains listings or products.',
   'N/A','User is redirected to the Listings/Products page (filtered by Active status).','','-','High','P1','Functional','QA','Yes'],

  ['TC_031','Dashboard','Product Analysis','Clicking "Not Published" product badge redirects to listings page',
   'Verify that clicking the Not Published status badge in the Product Analysis section redirects to the Listings/Products page filtered by Not Published status.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Not Published badge in the Product Analysis section.\n3. Click the Not Published badge.\n4. Wait for navigation.\n5. Verify the URL contains listings or products.',
   'N/A','User is redirected to the Listings/Products page (filtered by Not Published status).','','-','High','P1','Functional','QA','Yes'],

  ['TC_032','Dashboard','Product Analysis','Clicking "Not Profiled" product badge redirects to listings page',
   'Verify that clicking the Not Profiled status badge in the Product Analysis section redirects to the Listings/Products page filtered by Not Profiled status.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Not Profiled badge in the Product Analysis section.\n3. Click the Not Profiled badge.\n4. Wait for navigation.\n5. Verify the URL contains listings or products.',
   'N/A','User is redirected to the Listings/Products page (filtered by Not Profiled status).','','-','High','P1','Functional','QA','Yes'],

  ['TC_033','Dashboard','Video Tips','"More tips on getting started" video section is visible',
   'Verify that the "More tips on getting started" video tips section is visible on the dashboard.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Scroll to the video tips section.\n3. Verify the section heading and video content are visible.',
   'N/A','"More tips on getting started" video section is visible on the dashboard.','','-','Low','P3','Functional','QA','Yes'],

  ['TC_034','Dashboard','Etsy Shop Status','Shop Refresh button is visible in the Etsy Shop Status section',
   'Verify that a Refresh button is present in the Etsy Shop Status section to allow users to manually refresh shop data.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Locate the Etsy Shop Status section.\n3. Verify the Refresh button is visible.',
   'N/A','Refresh button is visible in the Etsy Shop Status section.','','-','Medium','P2','UI','QA','Yes'],

  ['TC_035','Dashboard','Reverse Sync','Reverse Sync (Etsy to Shopify) banner visibility check',
   'Verify that the Reverse Sync banner state is deterministic — either shown or hidden based on store configuration without throwing errors.',
   PRE,
   '1. Log in and navigate to the dashboard.\n2. Check for the presence of the Reverse Sync (Etsy to Shopify) banner.\n3. Note whether the banner is visible or hidden.',
   'N/A','Reverse Sync banner is either visible or hidden depending on store config — no errors or unexpected states.','','-','Medium','P2','Functional','QA','Yes'],

  ['TC_036','Dashboard','Recent Activities','Recent Activities section is visible on the dashboard',
   'Verify that the Recent Activities panel is visible on the dashboard after at least one sync or app action has occurred.',
   PRE_ACTIVITIES,
   '1. Trigger a sync or app action (e.g., product sync).\n2. Navigate to the dashboard.\n3. Verify the Recent Activities panel is visible.',
   'N/A','Recent Activities section/panel is visible on the dashboard.','','-','Medium','P2','Functional','QA','Yes'],

  ['TC_037','Dashboard','Recent Activities','"All Activities" button is visible in the Recent Activities panel',
   'Verify that the "All Activities" button or link is present within the Recent Activities panel on the dashboard.',
   PRE_ACTIVITIES,
   '1. Trigger a sync or app action.\n2. Navigate to the dashboard.\n3. Locate the Recent Activities panel.\n4. Verify the All Activities button/link is visible.',
   'N/A','"All Activities" button is visible in the Recent Activities panel.','','-','Medium','P2','Functional','QA','Yes'],

  ['TC_038','Dashboard','Recent Activities','Clicking "All Activities" redirects to the Activities page',
   'Verify that clicking the All Activities button from the Recent Activities panel navigates to the full Activities page.',
   PRE_ACTIVITIES,
   '1. Navigate to the dashboard with the Recent Activities panel visible.\n2. Click the All Activities button.\n3. Wait for navigation.\n4. Verify the URL contains /activity.',
   'N/A','User is redirected to the Activities page.','','-','Medium','P2','Functional','QA','Yes'],

  ['TC_039','Dashboard','Activities Page','Activities page loads with Notifications section',
   'Verify that the standalone Activities page loads successfully and the Notifications section is visible.',
   PRE,
   '1. Log in and navigate directly to the Activities page URL.\n2. Dismiss any overlays or popups.\n3. Verify the Notifications section is visible on the page.',
   'N/A','Activities page loads successfully and the Notifications section is visible.','','-','Medium','P2','Functional','QA','Yes'],

  ['TC_040','Dashboard','Recent Activities','Delete an activity item from the Recent Activities dashboard panel',
   'Verify that a user can delete an activity item from the Recent Activities dashboard panel and the count decreases accordingly.',
   PRE_ACTIVITIES,
   '1. Navigate to the dashboard with at least one item in the Recent Activities panel.\n2. Note the current count of activity items.\n3. Click the delete/remove icon on the first activity item.\n4. Wait for the UI to update.\n5. Verify the activity count has decreased.',
   'N/A','Activity item is deleted and the count in the Recent Activities panel decreases by 1.','','-','Medium','P2','Functional','QA','Yes'],

  ['TC_041','Dashboard','Activities Page','Delete an activity item from the full Activities page',
   'Verify that a user can delete an activity item from the full Activities page and the total count decreases.',
   PRE_ACTIVITIES,
   '1. Navigate to the Activities page.\n2. Verify the page is loaded with activity items listed.\n3. Note the current count of activities.\n4. Click the delete button on the first activity item.\n5. Wait for UI update.\n6. Verify the activity count has decreased.',
   'N/A','Activity item is deleted and the total count on the Activities page decreases.','','-','Medium','P2','Functional','QA','Yes'],
];

const ws_new = xlsx.utils.aoa_to_sheet(rows);

ws_new['!cols'] = [
  {wch:10},{wch:12},{wch:22},{wch:48},{wch:62},
  {wch:52},{wch:65},{wch:15},{wch:62},{wch:30},
  {wch:10},{wch:10},{wch:10},{wch:15},{wch:12},{wch:20}
];

// Remove existing sheet if present, then re-add
const existingIdx = wb.SheetNames.indexOf('Dashboard - New Format');
if (existingIdx >= 0) {
  wb.SheetNames.splice(existingIdx, 1);
  delete wb.Sheets['Dashboard - New Format'];
}
xlsx.utils.book_append_sheet(wb, ws_new, 'Dashboard - New Format');

const outPath = 'C:/Users/Sameera-2767/Downloads/Etsy Test Cases - Updated.xlsx';
xlsx.writeFile(wb, outPath);
console.log('Done! Saved to:', outPath);
console.log('Total test cases in new format sheet:', rows.length - 1);
