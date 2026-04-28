/**
 * Tests for CedCommerce Etsy dashboard health and activities API.
 * Base: https://dev.apps.cedcommerce.com/marketplace-integration/etsy/api
 */

const { test, expect } = require('@playwright/test');

const API_BASE = 'https://dev.apps.cedcommerce.com/marketplace-integration/etsy/api';

test.describe('CedCommerce Etsy dashboard API', () => {
  test('dashboard endpoint responds (health)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/dashboard`, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    expect(res.ok() || res.status() === 401).toBe(true);
    if (res.status() === 401) {
      expect(data.message || data.name).toBeTruthy();
      expect(data.success).toBe(false);
    } else {
      expect(data).toBeDefined();
    }
  });

  test('activities endpoint responds (health)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/activities`, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    expect(res.ok() || res.status() === 401).toBe(true);
    if (res.status() === 401) {
      expect(data.message || data.name).toBeTruthy();
    } else {
      expect(data).toBeDefined();
    }
  });
});
