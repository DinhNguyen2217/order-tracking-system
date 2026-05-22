/**
 * Basic integration tests for Order Tracking API
 * Run: node test.js
 */

import http from 'http';

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('\n🧪 Running API Tests...\n');

  // Test 1: Health check
  console.log('Test 1: GET /api/health');
  const health = await request('GET', '/api/health');
  assert(health.status === 200, 'Status 200');
  assert(health.body.ok === true, 'ok: true');
  assert(health.body.database === 'connected', 'database: connected');

  // Test 2: Get orders
  console.log('\nTest 2: GET /api/orders');
  const orders = await request('GET', '/api/orders');
  assert(orders.status === 200, 'Status 200');
  assert(Array.isArray(orders.body), 'Returns array');

  // Test 3: Get stats
  console.log('\nTest 3: GET /api/orders/stats');
  const stats = await request('GET', '/api/orders/stats');
  assert(stats.status === 200, 'Status 200');
  assert(typeof stats.body.total_orders === 'number', 'total_orders is number');
  assert(typeof stats.body.by_status === 'object', 'by_status is object');

  // Test 4: Create order — valid
  console.log('\nTest 4: POST /api/orders (valid)');
  const created = await request('POST', '/api/orders', {
    customer_name: 'Test User',
    product_name: 'Test Product',
    quantity: 2,
    price: 100000,
    shipping_address: '123 Test Street',
    note: 'Test note'
  });
  assert(created.status === 201, 'Status 201');
  assert(created.body.id > 0, 'Returns id');
  assert(created.body.status === 'pending', 'Default status is pending');
  assert(Array.isArray(created.body.status_history), 'Has status_history');

  const orderId = created.body.id;

  // Test 5: Create order — invalid (missing fields)
  console.log('\nTest 5: POST /api/orders (invalid — missing fields)');
  const invalid = await request('POST', '/api/orders', { customer_name: 'Only Name' });
  assert(invalid.status === 400, 'Status 400 for invalid input');
  assert(Array.isArray(invalid.body.errors), 'Returns errors array');

  // Test 6: Update status
  console.log('\nTest 6: PUT /api/orders/:id/status');
  const updated = await request('PUT', `/api/orders/${orderId}/status`, { status: 'confirmed' });
  assert(updated.status === 200, 'Status 200');
  assert(updated.body.status === 'confirmed', 'Status updated to confirmed');
  assert(updated.body.status_history.length === 2, 'History has 2 entries');

  // Test 7: Update status — invalid
  console.log('\nTest 7: PUT /api/orders/:id/status (invalid status)');
  const badStatus = await request('PUT', `/api/orders/${orderId}/status`, { status: 'invalid_status' });
  assert(badStatus.status === 400, 'Status 400 for invalid status');

  // Test 8: Delete order
  console.log('\nTest 8: DELETE /api/orders/:id');
  const deleted = await request('DELETE', `/api/orders/${orderId}`);
  assert(deleted.status === 200, 'Status 200');

  // Test 9: Delete non-existent order
  console.log('\nTest 9: DELETE /api/orders/:id (not found)');
  const notFound = await request('DELETE', `/api/orders/${orderId}`);
  assert(notFound.status === 404, 'Status 404 for non-existent order');

  // Summary
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('✅ All tests passed');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err.message);
  process.exit(1);
});
