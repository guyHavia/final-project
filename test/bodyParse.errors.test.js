import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';

let stopMongo;
let app;

before(async () => {
  stopMongo = await startMongo();
  app = createApp();
});

after(async () => {
  await stopMongo();
});

describe('request body parse errors', () => {
  test('malformed JSON returns 400 bad_request, not 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{bad');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'bad_request');
  });

  test('body over the JSON limit returns 413 payload_too_large', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'a', password: 'x'.repeat(300 * 1024) });
    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, 'payload_too_large');
  });

  test('a 50,000-char Hebrew body is under the limit (not 413)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'a', password: 'א'.repeat(50000) });
    assert.notEqual(res.status, 413);
    assert.notEqual(res.status, 500);
  });
});
