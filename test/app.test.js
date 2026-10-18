
const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');

require('dotenv').config();

process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

after(async () => {
  await db.pool.end();
});

describe('Smart City API Unit Tests', () => {
  it('GET /health should respond correctly', async () => {
    const res = await request(app).get('/health');

    assert.equal(
      res.statusCode,
      200,
      `Expected 200, received ${res.statusCode}. Response: ${JSON.stringify(res.body)}`
    );

    assert.equal(res.body.status, 'UP');
    assert.equal(res.body.database, 'CONNECTED');
  });
});
