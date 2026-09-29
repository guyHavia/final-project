import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser, User } from '../models/user.model.js';

/**
 * Seam 1 from issue #6: page rendering and the session-presence redirect
 * gate. This is a session-presence check, not role authorization — the
 * authoritative checks live on P1's/P2's /api guards. Real login (P1-03,
 * already merged) provides the session cookie, same pattern as
 * test/auth.routes.test.js.
 */

let stopMongo;
let app;

before(async () => {
  stopMongo = await startMongo();
  app = createApp();
});

after(async () => {
  await stopMongo();
});

beforeEach(async () => {
  await User.deleteMany({});
  await mongoose.connection.collection('sessions').deleteMany({}).catch(() => {});
  await createUser({ username: 'rep1', password: 'goodpass', role: 'reporter', displayName: 'Rep One' });
  await createUser({ username: 'ed1', password: 'goodpass', role: 'editor', displayName: 'Ed One' });
});

async function cookieFor(username) {
  const res = await request(app).post('/api/auth/login').send({ username, password: 'goodpass' });
  return res.headers['set-cookie'];
}

describe('GET /login', () => {
  test('renders the login form', async () => {
    const res = await request(app).get('/login');
    assert.equal(res.status, 200);
    assert.match(res.text, /id="login-form"/);
  });

  test('redirects a signed-in reporter to /newsroom', async () => {
    const cookie = await cookieFor('rep1');
    const res = await request(app).get('/login').set('Cookie', cookie);
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/newsroom');
  });

  test('redirects a signed-in editor to /newsroom/review', async () => {
    const cookie = await cookieFor('ed1');
    const res = await request(app).get('/login').set('Cookie', cookie);
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/newsroom/review');
  });
});

describe('newsroom page routes — no session', () => {
  for (const path of ['/newsroom', '/newsroom/review', '/newsroom/analytics']) {
    test(`GET ${path} redirects to /login`, async () => {
      const res = await request(app).get(path);
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, '/login');
    });
  }
});

describe('GET /newsroom', () => {
  test('renders the reporter shell for a reporter session', async () => {
    const cookie = await cookieFor('rep1');
    const res = await request(app).get('/newsroom').set('Cookie', cookie);
    assert.equal(res.status, 200);
    assert.match(res.text, /data-screen="newsroom-reporter"/);
  });

  test('also renders for an editor session (editors may check their own queue elsewhere, but this page itself only gates on session presence)', async () => {
    const cookie = await cookieFor('ed1');
    const res = await request(app).get('/newsroom').set('Cookie', cookie);
    assert.equal(res.status, 200);
  });
});

describe('GET /newsroom/review', () => {
  test('renders the editor shell for an editor session', async () => {
    const cookie = await cookieFor('ed1');
    const res = await request(app).get('/newsroom/review').set('Cookie', cookie);
    assert.equal(res.status, 200);
    assert.match(res.text, /data-screen="newsroom-editor"/);
  });

  test('redirects a reporter session to /newsroom', async () => {
    const cookie = await cookieFor('rep1');
    const res = await request(app).get('/newsroom/review').set('Cookie', cookie);
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/newsroom');
  });
});

describe('GET /newsroom/analytics', () => {
  test('renders the analytics shell for an editor session', async () => {
    const cookie = await cookieFor('ed1');
    const res = await request(app).get('/newsroom/analytics').set('Cookie', cookie);
    assert.equal(res.status, 200);
    assert.match(res.text, /data-screen="newsroom-analytics"/);
  });

  test('redirects a reporter session to /newsroom', async () => {
    const cookie = await cookieFor('rep1');
    const res = await request(app).get('/newsroom/analytics').set('Cookie', cookie);
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/newsroom');
  });
});
