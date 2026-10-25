// Run with: node --test test/shopee-direct-link.test.js
//
// addlivetag.com sometimes answers HTTP 200 with a JSON error body (its own
// DB being down, etc.) instead of a non-2xx status. checkCommission() must
// treat that the same as "couldn't reach the service" (reachable: false) —
// NOT the same as "this product legitimately has no commission"
// (found: false, reachable: true) — so callers can tell the two apart and
// avoid showing a misleading "0%" to the user.
const test = require('node:test');
const assert = require('node:assert/strict');
const ShopeeDirectLink = require('../src/shopee-direct-link');

function withMockFetch(impl, run) {
  const original = global.fetch;
  global.fetch = impl;
  return run().finally(() => { global.fetch = original; });
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test('200 + status=error "Database connection failed" → found:false, reachable:false', async () => {
  await withMockFetch(
    async () => jsonResponse(200, { status: 'error', message: 'Database connection failed' }),
    async () => {
      const link = new ShopeeDirectLink('aff123');
      const result = await link.checkCommission('111');
      assert.equal(result.found, false);
      assert.equal(result.reachable, false);
    },
  );
});

test('200 + status=error (other message) → found:false, reachable:false', async () => {
  await withMockFetch(
    async () => jsonResponse(200, { status: 'error', message: 'Something else broke' }),
    async () => {
      const link = new ShopeeDirectLink('aff123');
      const result = await link.checkCommission('112');
      assert.equal(result.found, false);
      assert.equal(result.reachable, false);
    },
  );
});

test('HTTP 401 → found:false, reachable:false', async () => {
  await withMockFetch(
    async () => jsonResponse(401, { status: 'error', message: 'Thiếu API Key' }),
    async () => {
      const link = new ShopeeDirectLink('aff123');
      const result = await link.checkCommission('113');
      assert.equal(result.found, false);
      assert.equal(result.reachable, false);
    },
  );
});

test('HTTP 500 → found:false, reachable:false', async () => {
  await withMockFetch(
    async () => jsonResponse(500, {}),
    async () => {
      const link = new ShopeeDirectLink('aff123');
      const result = await link.checkCommission('114');
      assert.equal(result.found, false);
      assert.equal(result.reachable, false);
    },
  );
});

test('fetch throws (network/timeout) → found:false, reachable:false', async () => {
  await withMockFetch(
    async () => { throw new Error('fetch failed'); },
    async () => {
      const link = new ShopeeDirectLink('aff123');
      const result = await link.checkCommission('115');
      assert.equal(result.found, false);
      assert.equal(result.reachable, false);
    },
  );
});

test('200 + success + commission > 0 → found:true', async () => {
  await withMockFetch(
    async () => jsonResponse(200, {
      status: 'success',
      productInfo: {
        commission: 1000,
        price: 50000,
        productName: 'Test product',
        shopName: 'Test shop',
      },
    }),
    async () => {
      const link = new ShopeeDirectLink('aff123');
      const result = await link.checkCommission('116');
      assert.equal(result.found, true);
      assert.equal(result.commission, 2); // 1000 / 50000 * 100
    },
  );
});

test('200 + success + commission = 0 → found:false, reachable:true', async () => {
  await withMockFetch(
    async () => jsonResponse(200, {
      status: 'success',
      productInfo: { commission: 0, price: 50000 },
    }),
    async () => {
      const link = new ShopeeDirectLink('aff123');
      const result = await link.checkCommission('117');
      assert.equal(result.found, false);
      assert.equal(result.reachable, true);
    },
  );
});
