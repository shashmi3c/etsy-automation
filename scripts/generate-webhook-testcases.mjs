import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// NOTE: All test cases simulate Etsy webhook payloads sent directly to the integration app.
// Tester does NOT have access to Etsy marketplace. "Etsy webhook payload" means a JSON body
// POSTed to the integration app's webhook endpoint using a tool like Postman/curl.

const testCases = [
  // Happy Path
  {
    id: 'TC01', category: 'Happy Path', priority: 'High',
    title: 'Paid order webhook syncs order to Shopify in real-time',
    preconditions: 'Integration app is running. A valid Etsy paid order webhook payload is prepared. Shopify store is connected.',
    steps: '1. Send a valid "paid" order webhook payload to the integration app endpoint using Postman/curl.\n2. Note the timestamp of the request.\n3. Navigate to Shopify Admin > Orders.\n4. Search for the order using the Etsy order ID from the payload.',
    expected: 'Order appears in Shopify within seconds of the webhook being sent — no manual fetch required.',
    status: ''
  },
  {
    id: 'TC02', category: 'Happy Path', priority: 'High',
    title: 'Order status correctly mapped from webhook payload to Shopify',
    preconditions: 'Valid paid order webhook payload with status "paid". Integration app running.',
    steps: '1. Send a valid paid order webhook payload to the integration app.\n2. Wait for processing.\n3. Open the synced order in Shopify Admin.\n4. Check the financial status and fulfillment status of the order.',
    expected: 'Order status in Shopify is correctly mapped (e.g., financial_status = "paid", fulfillment_status = "unfulfilled").',
    status: ''
  },
  {
    id: 'TC03', category: 'Happy Path', priority: 'High',
    title: 'All order fields from webhook payload synced correctly to Shopify',
    preconditions: 'Webhook payload contains: buyer name, email, shipping address, line items (name, qty, price), and order total.',
    steps: '1. Prepare a webhook payload with all fields populated (buyer info, address, 2+ line items, totals).\n2. Send the payload to the integration app endpoint.\n3. Open the order in Shopify Admin.\n4. Compare each field in Shopify against the payload: customer name, email, shipping address, item names, qty, unit price, order total.',
    expected: 'Every field in the Shopify order exactly matches what was in the webhook payload.',
    status: ''
  },
  {
    id: 'TC04', category: 'Happy Path', priority: 'Medium',
    title: 'Multiple paid order webhooks sent in quick succession all synced',
    preconditions: 'At least 3 distinct paid order webhook payloads prepared (different order IDs).',
    steps: '1. Send 3-5 different paid order webhook payloads to the integration app within a 1-minute window.\n2. Wait for processing.\n3. Check Shopify Admin > Orders for each order ID.',
    expected: 'All orders appear in Shopify. No orders are dropped or missed under burst load.',
    status: ''
  },
  {
    id: 'TC05', category: 'Happy Path', priority: 'High',
    title: 'Webhook with non-paid status does not create order in Shopify',
    preconditions: 'Webhook payloads for different order statuses prepared: "open", "cancelled", "completed".',
    steps: '1. Send a webhook payload with status "open" to the integration app.\n2. Check Shopify Admin for a new order.\n3. Send a webhook payload with status "cancelled".\n4. Check Shopify Admin again.\n5. Send a payload with status "paid".\n6. Check Shopify Admin.',
    expected: 'No order is created in Shopify for "open" or "cancelled" status. Order is created only when status is "paid".',
    status: ''
  },

  // Reliability & Retry
  {
    id: 'TC06', category: 'Reliability & Retry', priority: 'Medium',
    title: 'Order synced after integration app recovers from downtime',
    preconditions: 'Integration app can be temporarily stopped. Webhook payload is queued or retried.',
    steps: '1. Stop the integration app.\n2. Send a paid order webhook payload to the endpoint (it should fail or queue).\n3. Restart the integration app.\n4. Check Shopify Admin > Orders for the order.',
    expected: 'After restart, the queued/retried webhook is processed and the order appears in Shopify. No orders lost.',
    status: ''
  },
  {
    id: 'TC07', category: 'Reliability & Retry', priority: 'Medium',
    title: 'Order synced gracefully when Shopify API rate limit is hit',
    preconditions: 'Ability to simulate or trigger Shopify API 429 response (or check integration app rate-limit handling in logs).',
    steps: '1. Send many webhook payloads rapidly to the integration app to trigger Shopify API rate limiting.\n2. Monitor integration app logs for 429 errors from Shopify.\n3. Wait for rate limit window to reset.\n4. Check Shopify Admin for all orders.',
    expected: 'Integration app logs 429 and retries. All orders are eventually synced once rate limit clears. No orders are lost.',
    status: ''
  },
  {
    id: 'TC08', category: 'Reliability & Retry', priority: 'High',
    title: 'Sending same webhook payload twice does not create duplicate order (idempotency)',
    preconditions: 'A valid paid order webhook payload with a specific order ID is prepared.',
    steps: '1. Send the same paid order webhook payload to the integration app twice (same order ID).\n2. Wait for both to be processed.\n3. In Shopify Admin > Orders, search for the order by the Etsy order ID.',
    expected: 'Only one order exists in Shopify for that order ID. No duplicate orders regardless of how many times the same payload is sent.',
    status: ''
  },
  {
    id: 'TC09', category: 'Reliability & Retry', priority: 'Medium',
    title: 'Integration app returns HTTP 200 response quickly after receiving webhook',
    preconditions: 'Integration app webhook endpoint is accessible. Postman or curl is available to measure response time.',
    steps: '1. Send a valid paid order webhook payload to the integration app endpoint.\n2. Note the HTTP status code returned in the response.\n3. Note the response time in Postman/curl.',
    expected: 'Integration app responds with HTTP 200. Response is returned within 3-5 seconds (before Etsy\'s timeout threshold).',
    status: ''
  },

  // Multi-Account
  {
    id: 'TC10', category: 'Multi-Account', priority: 'High',
    title: 'Webhook payload for Account A routes order to correct Shopify store',
    preconditions: 'At least 2 Etsy accounts each connected to a separate Shopify store in the integration app. Payloads for each account prepared (with correct account identifiers).',
    steps: '1. Send a paid order webhook payload containing Account A\'s shop ID to the integration app.\n2. Check Shopify Store A and Store B for the order.\n3. Send a paid order webhook payload containing Account B\'s shop ID.\n4. Check both Shopify stores again.',
    expected: 'Account A order appears only in Shopify Store A. Account B order appears only in Shopify Store B. No cross-routing.',
    status: ''
  },
  {
    id: 'TC11', category: 'Multi-Account', priority: 'Medium',
    title: 'Simultaneous webhook payloads from multiple accounts sync independently',
    preconditions: 'At least 2 Etsy accounts connected to separate Shopify stores. Distinct payloads for each account ready.',
    steps: '1. Send paid order webhook payloads for Account A and Account B simultaneously (parallel requests).\n2. Wait for processing.\n3. Check Shopify Store A for Account A\'s order.\n4. Check Shopify Store B for Account B\'s order.',
    expected: 'Each order syncs to its respective Shopify store independently without interference or cross-contamination.',
    status: ''
  },
  {
    id: 'TC12', category: 'Multi-Account', priority: 'Medium',
    title: 'Webhook payload for a disconnected account is not processed',
    preconditions: 'Account A is disconnected from the integration app. Account B is still connected.',
    steps: '1. Disconnect Account A from the integration app.\n2. Send a paid order webhook payload with Account A\'s shop ID.\n3. Check Shopify Store A for the order.\n4. Check integration app logs.\n5. Send a payload for Account B and verify it still syncs.',
    expected: 'Account A webhook is rejected or ignored (not synced to Shopify). Account B order syncs normally.',
    status: ''
  },

  // Data Integrity
  {
    id: 'TC13', category: 'Data Integrity', priority: 'Medium',
    title: 'Webhook payload with discount/coupon reflected correctly in Shopify',
    preconditions: 'Webhook payload prepared with a discount field (e.g., coupon applied, discounted line total).',
    steps: '1. Prepare a paid order webhook payload that includes a discount (e.g., 10% coupon, discounted subtotal).\n2. Send the payload to the integration app.\n3. Open the resulting Shopify order.\n4. Check the discount line and final order total.',
    expected: 'Discount amount and final total in Shopify match exactly what was in the webhook payload.',
    status: ''
  },
  {
    id: 'TC14', category: 'Data Integrity', priority: 'Medium',
    title: 'Webhook payload with multiple items and variations synced completely',
    preconditions: 'Webhook payload prepared with 3+ line items including product variations (e.g., size=L, color=Red).',
    steps: '1. Prepare a paid order webhook payload with multiple line items (different products and variations).\n2. Send the payload to the integration app.\n3. Open the Shopify order.\n4. Check all line items: product name, variation, quantity, and unit price.',
    expected: 'All line items with correct variation details, quantities, and prices are present in the Shopify order. No items missing.',
    status: ''
  },
  {
    id: 'TC15', category: 'Data Integrity', priority: 'Low',
    title: 'Webhook payload with gift message or personalization note synced without failure',
    preconditions: 'Webhook payload prepared with a gift_message or buyer_message field populated.',
    steps: '1. Prepare a paid order webhook payload including a gift message or personalization note.\n2. Send the payload to the integration app.\n3. Check integration app logs for any errors.\n4. Open the resulting Shopify order and check order notes or custom fields.',
    expected: 'Order syncs successfully with no errors. Gift message/personalization note is visible in Shopify order notes or custom fields.',
    status: ''
  },
  {
    id: 'TC16', category: 'Data Integrity', priority: 'Medium',
    title: 'Webhook payload with international address and non-USD currency synced correctly',
    preconditions: 'Webhook payload prepared with a non-US shipping address and a non-USD currency (e.g., GBP, EUR).',
    steps: '1. Prepare a paid order webhook payload with an international shipping address (e.g., UK) and non-USD currency.\n2. Send the payload to the integration app.\n3. Open the Shopify order.\n4. Verify shipping address fields and currency/amount values.',
    expected: 'International shipping address is correctly populated in Shopify. Currency and amounts match the webhook payload.',
    status: ''
  },
  {
    id: 'TC17', category: 'Data Integrity', priority: 'Low',
    title: 'Etsy order ID from webhook payload is stored as reference in Shopify order',
    preconditions: 'Webhook payload with a known Etsy order ID (e.g., order_id: 12345678).',
    steps: '1. Send a paid order webhook payload with a specific Etsy order ID.\n2. Open the resulting order in Shopify Admin.\n3. Check order tags, notes, or metafields for the Etsy order ID.',
    expected: 'The Etsy order ID is stored in the Shopify order (tags, notes, or metafields) for cross-platform traceability.',
    status: ''
  },

  // Regression
  {
    id: 'TC18', category: 'Regression', priority: 'High',
    title: 'No duplicate order created when webhook fires (cron is disabled)',
    preconditions: 'Cron-based sync is disabled in the integration app. Integration app is running with webhook-only mode.',
    steps: '1. Confirm in integration app settings/config that the cron job is disabled.\n2. Send a paid order webhook payload.\n3. Wait for the previously configured cron interval to pass (e.g., 15 minutes).\n4. Check Shopify Admin for the order and count how many times it appears.',
    expected: 'Only one order exists in Shopify. No duplicate is created by a cron running in parallel.',
    status: ''
  },
  {
    id: 'TC19', category: 'Regression', priority: 'Medium',
    title: 'Previously synced orders are not re-created when a new webhook arrives',
    preconditions: 'Orders already exist in Shopify from before webhook deployment (synced via old cron).',
    steps: '1. Identify an order in Shopify that was previously synced via the cron.\n2. Send a webhook payload with the same Etsy order ID.\n3. Check Shopify for duplicates of that order.',
    expected: 'The existing Shopify order is not duplicated. Integration app recognizes it as already synced and skips creation.',
    status: ''
  },
  {
    id: 'TC20', category: 'Regression', priority: 'Medium',
    title: 'Manual fetch (if available) does not duplicate a webhook-synced order',
    preconditions: 'Manual fetch option exists in the integration app UI. A webhook has already synced an order.',
    steps: '1. Send a paid order webhook payload and confirm order appears in Shopify.\n2. Trigger manual fetch/sync from the integration app UI for the same account.\n3. Check Shopify for the order — count occurrences.',
    expected: 'Order appears only once in Shopify. Manual fetch does not re-create an order already synced by webhook.',
    status: ''
  },
  {
    id: 'TC21', category: 'Regression', priority: 'Medium',
    title: 'Webhook sync latency is significantly lower than previous cron interval',
    preconditions: 'Knowledge of previous cron interval (e.g., every 15 minutes). Integration app logs are accessible.',
    steps: '1. Send a paid order webhook payload and note the exact timestamp.\n2. Monitor Shopify Admin > Orders and note the timestamp when the order appears.\n3. Calculate the difference between send time and appearance time.',
    expected: 'Order appears in Shopify within seconds (target < 30s), dramatically faster than the previous cron-based sync interval.',
    status: ''
  },

  // Security
  {
    id: 'TC22', category: 'Security', priority: 'High',
    title: 'Webhook request with invalid HMAC signature is rejected',
    preconditions: 'Integration app webhook endpoint URL is known. Postman/curl available to send custom HTTP requests.',
    steps: '1. Prepare a valid Etsy paid order webhook payload.\n2. Send it to the integration app endpoint with a deliberately wrong HMAC signature in the header (e.g., X-Etsy-Signature: invalidsignature).\n3. Note the HTTP response code.\n4. Check Shopify Admin for any new order.',
    expected: 'Integration app returns HTTP 401 or 403. No order is created in Shopify.',
    status: ''
  },
  {
    id: 'TC23', category: 'Security', priority: 'High',
    title: 'Webhook request with missing signature header is rejected',
    preconditions: 'Integration app webhook endpoint URL is known.',
    steps: '1. Prepare a valid Etsy paid order webhook payload.\n2. Send it to the integration app endpoint with NO signature header at all.\n3. Note the HTTP response code.\n4. Check Shopify Admin for any new order.',
    expected: 'Integration app returns HTTP 401 or 403. No order is created in Shopify.',
    status: ''
  },

  // Edge Cases
  {
    id: 'TC24', category: 'Edge Cases', priority: 'Medium',
    title: 'Webhook payload with missing required fields fails gracefully',
    preconditions: 'Ability to send custom webhook payloads. Integration app logs accessible.',
    steps: '1. Send a webhook payload with buyer_address removed.\n2. Check integration app logs and Shopify.\n3. Send a payload with line_items array empty.\n4. Check logs and Shopify.\n5. Send a payload with order_id missing.\n6. Check logs and Shopify.',
    expected: 'No crash occurs. No partial/incomplete order is created in Shopify. A clear error is logged in the integration app for each case.',
    status: ''
  },
  {
    id: 'TC25', category: 'Edge Cases', priority: 'Medium',
    title: 'Cancelled order webhook after paid webhook results in correct final state',
    preconditions: 'A paid order webhook payload and a cancelled order webhook payload for the same order ID are prepared.',
    steps: '1. Send the "paid" order webhook payload for order ID 99999.\n2. Confirm order appears in Shopify as active.\n3. Send a "cancelled" webhook payload for the same order ID 99999.\n4. Check Shopify order status.',
    expected: 'Shopify order final status is "cancelled". Order is not stuck in "paid" or "pending" state.',
    status: ''
  },
  {
    id: 'TC26', category: 'Edge Cases', priority: 'Medium',
    title: 'Webhook with unrecognized or unmapped product SKU fails with clear error',
    preconditions: 'Webhook payload prepared with a product SKU that does not exist in the connected Shopify store.',
    steps: '1. Prepare a paid order webhook payload with a line item containing an SKU not present in Shopify.\n2. Send the payload to the integration app.\n3. Check Shopify Admin for the order.\n4. Check integration app logs for error messages.',
    expected: 'A clear error is logged (e.g., "SKU not found in Shopify"). No silent failure. No partial order created in Shopify.',
    status: ''
  },

  // Order Management Toggle
  {
    id: 'TC27', category: 'Order Management Toggle', priority: 'High',
    title: 'Order not synced to Shopify when Order Management is turned OFF',
    preconditions: 'Integration app is connected to Shopify. Order Management setting is accessible in integration app settings.',
    steps: '1. Go to integration app Settings and turn OFF Order Management.\n2. Send a valid paid order webhook payload to the integration app endpoint.\n3. Check Shopify Admin > Orders for the order.\n4. Check integration app logs.',
    expected: 'No order is created in Shopify. Integration app recognizes Order Management is disabled and skips processing the webhook.',
    status: ''
  },
  {
    id: 'TC28', category: 'Order Management Toggle', priority: 'High',
    title: 'Order syncs to Shopify when Order Management is turned ON',
    preconditions: 'Order Management setting is turned ON in integration app settings.',
    steps: '1. Go to integration app Settings and turn ON Order Management.\n2. Send a valid paid order webhook payload to the integration app endpoint.\n3. Check Shopify Admin > Orders for the order.',
    expected: 'Order is created in Shopify successfully after Order Management is enabled.',
    status: ''
  },
  {
    id: 'TC29', category: 'Order Management Toggle', priority: 'High',
    title: 'Toggling Order Management OFF then ON — orders only sync after it is re-enabled',
    preconditions: 'Order Management is initially ON.',
    steps: '1. Turn OFF Order Management in settings.\n2. Send paid order webhook payload A — verify no order in Shopify.\n3. Turn ON Order Management in settings.\n4. Send paid order webhook payload B.\n5. Check Shopify Admin for both orders.',
    expected: 'Order A is NOT in Shopify. Order B is synced to Shopify after toggle is re-enabled.',
    status: ''
  },

  // Order Limit
  {
    id: 'TC30', category: 'Order Limit', priority: 'High',
    title: 'Order not fetched/synced when account has reached its order limit',
    preconditions: 'Account is at or has exceeded the plan\'s order limit. Order limit is visible in integration app dashboard or settings.',
    steps: '1. Confirm the account has reached its order limit (e.g., limit = 50, usage = 50).\n2. Send a valid paid order webhook payload to the integration app.\n3. Check Shopify Admin > Orders for the new order.\n4. Check integration app logs or UI for a limit-reached message.',
    expected: 'Order is NOT created in Shopify. Integration app shows a clear "order limit reached" message or error in logs/UI.',
    status: ''
  },
  {
    id: 'TC31', category: 'Order Limit', priority: 'Medium',
    title: 'Order limit counter increments correctly with each synced order',
    preconditions: 'Account has a known order limit (e.g., 50 orders). Current usage is known (e.g., 48 orders used).',
    steps: '1. Note current order count in integration app dashboard (e.g., 48/50).\n2. Send a paid order webhook payload.\n3. Check the order count in the dashboard.\n4. Send a second paid order webhook payload.\n5. Check the count again.',
    expected: 'Order count increments by 1 for each successfully synced order. Count shows 49/50 then 50/50.',
    status: ''
  },
  {
    id: 'TC32', category: 'Order Limit', priority: 'Medium',
    title: 'Exactly at order limit — the limit-reaching order syncs but the next one does not',
    preconditions: 'Account is at limit - 1 (one order remaining before limit is hit, e.g., 49/50).',
    steps: '1. Send paid order webhook payload A (this should be the last allowed order).\n2. Confirm it syncs to Shopify. Count should now be 50/50.\n3. Send paid order webhook payload B.\n4. Check Shopify for order B.',
    expected: 'Order A syncs successfully (limit reached). Order B is blocked — not created in Shopify. Limit-reached notification or error is shown.',
    status: ''
  },

  // Order Add-On
  {
    id: 'TC33', category: 'Order Add-On', priority: 'High',
    title: 'Order sync resumes after purchasing/activating the Order Add-On',
    preconditions: 'Account has reached its order limit and syncing is blocked. Order Add-On is available to activate.',
    steps: '1. Confirm order limit is reached — send a payload and verify it is blocked.\n2. Activate/purchase the Order Add-On from the integration app or billing page.\n3. Send a paid order webhook payload.\n4. Check Shopify Admin > Orders.',
    expected: 'After activating the Order Add-On, the new order is synced to Shopify successfully. Order limit is extended.',
    status: ''
  },
  {
    id: 'TC34', category: 'Order Add-On', priority: 'Medium',
    title: 'Order limit counter resets or increases after Order Add-On is activated',
    preconditions: 'Order Add-On has been activated on an account that previously hit its limit.',
    steps: '1. Check the order count in the integration app dashboard before and after activating the Add-On.\n2. Verify the limit displayed in the dashboard is updated.',
    expected: 'Order limit is increased (e.g., from 50 to 100 or unlimited). Dashboard reflects the new limit after Add-On activation.',
    status: ''
  },
  {
    id: 'TC35', category: 'Order Add-On', priority: 'Low',
    title: 'Orders blocked before Add-On activation are not auto-retried after activation',
    preconditions: 'Some webhook payloads were blocked due to order limit. Order Add-On has since been activated.',
    steps: '1. Note order payloads that were blocked before Add-On activation.\n2. Activate the Order Add-On.\n3. Wait and check if those previously blocked orders are auto-retried and synced.',
    expected: 'Previously blocked orders are NOT automatically re-synced (they were already dropped). Only new webhooks after activation are processed.',
    status: ''
  },

  // Quantity Sync (Inventory Deduction)
  {
    id: 'TC36', category: 'Quantity Sync', priority: 'High',
    title: 'Shopify inventory deducted when paid order webhook received — even with Order Management OFF',
    preconditions: 'Order Management is turned OFF. Quantity Sync / Inventory Sync is turned ON in settings. Product exists in Shopify with a known stock quantity (e.g., qty = 10).',
    steps: '1. Note current Shopify inventory for the product (e.g., 10 units).\n2. Turn OFF Order Management. Confirm Quantity Sync is ON.\n3. Send a paid order webhook payload for that product (qty ordered = 2).\n4. Check Shopify Admin > Products > Inventory for the product.',
    expected: 'Shopify inventory is reduced by the ordered quantity (10 → 8). No order is created in Shopify (since Order Management is OFF), but inventory is deducted.',
    status: ''
  },
  {
    id: 'TC37', category: 'Quantity Sync', priority: 'High',
    title: 'Inventory deducted correctly for multiple items in a single order webhook',
    preconditions: 'Quantity Sync is ON. Multiple products in Shopify with known stock levels.',
    steps: '1. Prepare a paid order webhook payload with 2 different products (Product A qty=1, Product B qty=3).\n2. Note current Shopify inventory for both products.\n3. Send the webhook payload.\n4. Check Shopify inventory for both products.',
    expected: 'Product A inventory decreases by 1. Product B inventory decreases by 3. Deductions are independent and correct for each item.',
    status: ''
  },
  {
    id: 'TC38', category: 'Quantity Sync', priority: 'Medium',
    title: 'Inventory NOT deducted when Quantity Sync is turned OFF',
    preconditions: 'Quantity Sync is turned OFF in integration app settings. Product exists in Shopify with known stock.',
    steps: '1. Turn OFF Quantity Sync in settings.\n2. Note current Shopify inventory for a product (e.g., 10 units).\n3. Send a paid order webhook payload for that product.\n4. Check Shopify inventory.',
    expected: 'Shopify inventory remains unchanged (still 10). No deduction occurs when Quantity Sync is disabled.',
    status: ''
  },
  {
    id: 'TC39', category: 'Quantity Sync', priority: 'Medium',
    title: 'Inventory deducted only once for duplicate webhook payloads',
    preconditions: 'Quantity Sync is ON. Product in Shopify with known stock (e.g., 10 units).',
    steps: '1. Send the same paid order webhook payload twice (same order ID, qty=2).\n2. Check Shopify inventory after both payloads are processed.',
    expected: 'Inventory deducted only once (10 → 8), not twice (10 → 6). Duplicate webhook idempotency applies to inventory as well.',
    status: ''
  },

  // Multi-Account Order Behavior
  {
    id: 'TC40', category: 'Multi-Account Order Behavior', priority: 'High',
    title: 'Order created only in the correct account\'s Shopify store — not on other connected accounts',
    preconditions: 'At least 2 Etsy accounts (A and B) connected to separate Shopify stores. Order Management is ON for both.',
    steps: '1. Send a paid order webhook payload for Account A (containing Account A\'s shop ID).\n2. Check Shopify Store A for the order.\n3. Check Shopify Store B for the order.\n4. Check integration app order list for Account B.',
    expected: 'Order is created only in Shopify Store A. Shopify Store B has no new order. Account B is completely unaffected.',
    status: ''
  },
  {
    id: 'TC41', category: 'Multi-Account Order Behavior', priority: 'High',
    title: 'Order count/statistics updated across all connected shops after a new order',
    preconditions: 'At least 2 Etsy accounts connected. Integration app dashboard shows per-account and total order counts.',
    steps: '1. Note the order count for Account A, Account B, and the overall total in the integration app dashboard.\n2. Send a paid order webhook payload for Account A.\n3. Refresh the integration app dashboard.\n4. Check order counts for Account A, Account B, and the total.',
    expected: 'Account A\'s order count increases by 1. Account B\'s count is unchanged. The overall total count increases by 1 (reflecting Account A\'s new order).',
    status: ''
  },
  {
    id: 'TC42', category: 'Multi-Account Order Behavior', priority: 'Medium',
    title: 'Simultaneous orders on different accounts update counts independently without collision',
    preconditions: 'At least 2 Etsy accounts connected. Known order counts for each account before test.',
    steps: '1. Note current order counts for Account A and Account B.\n2. Send paid order webhook payloads for Account A and Account B simultaneously.\n3. Wait for processing.\n4. Check order counts for both accounts in integration app dashboard.',
    expected: 'Account A count increases by 1. Account B count increases by 1. No count collision or double-increment on either account.',
    status: ''
  },
  {
    id: 'TC43', category: 'Multi-Account Order Behavior', priority: 'Medium',
    title: 'Order limit count tracked per account — one account hitting limit does not affect another',
    preconditions: 'Account A is near its order limit (e.g., 49/50). Account B has available quota.',
    steps: '1. Send a paid order webhook for Account A to reach its limit (50/50).\n2. Send another payload for Account A — confirm it is blocked.\n3. Send a paid order webhook for Account B.\n4. Check Shopify Store B and Account B\'s order count.',
    expected: 'Account A is blocked after hitting 50. Account B\'s order syncs normally. Each account\'s order limit is tracked independently.',
    status: ''
  },
];

const headers = ['TC ID', 'Category', 'Priority', 'Title', 'Preconditions', 'Test Steps', 'Expected Result', 'Status'];

const wsData = [
  headers,
  ...testCases.map(tc => [tc.id, tc.category, tc.priority, tc.title, tc.preconditions, tc.steps, tc.expected, tc.status])
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(wsData);

// Column widths
ws['!cols'] = [
  { wch: 8 },   // TC ID
  { wch: 20 },  // Category
  { wch: 10 },  // Priority
  { wch: 45 },  // Title
  { wch: 40 },  // Preconditions
  { wch: 55 },  // Test Steps
  { wch: 55 },  // Expected Result
  { wch: 12 },  // Status
];

XLSX.utils.book_append_sheet(wb, ws, 'Webhook Test Cases');

const outputPath = path.join(__dirname, '..', 'Etsy_Webhook_RealTime_TestCases.xlsx');
XLSX.writeFile(wb, outputPath);
console.log(`Excel file created: ${outputPath}`);
