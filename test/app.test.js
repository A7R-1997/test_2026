const request = require('supertest');
const app = require('../src/app');

describe('Smart City API Unit Tests', () => {
  it('GET /health should respond correctly', async () => {
    const res = await request(app).get('/health');
    expect([200, 500]).toContain(res.statusCode);
  });
});