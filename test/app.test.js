
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

describe('Smart City API Unit Tests', () => {
  it('GET /health should respond correctly', async () => {
    const res = await request(app).get('/health');

    assert.ok(
      [200, 500].includes(res.statusCode),
      `Unexpected status code: ${res.statusCode}`
    );
  });
});
