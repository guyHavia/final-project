import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser, User } from '../models/user.model.js';

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
  await createUser({
    username: 'reporter1',
    password: 'goodpass',
    role: 'reporter',
    displayName: 'Reporter One',
  });
});

async function loginCookie() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'reporter1', password: 'goodpass' });
  return res.headers['set-cookie'];
}

describe('auth routes', () => {
  test('login with a missing field → 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'reporter1' });
    assert.equal(res.status, 400);
  });

  test('login with an unknown username → 401 "invalid credentials"', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'whatever' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.message, 'invalid credentials');
  });

  test('login with a wrong password → 401, same message (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'reporter1', password: 'wrong' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.message, 'invalid credentials');
  });

  test('login with correct credentials → 200, cookie set, body has no hash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'reporter1', password: 'goodpass' });

    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body.data).sort(), ['displayName', 'id', 'role', 'username']);
    assert.equal(res.body.data.username, 'reporter1');
    assert.equal(res.body.data.role, 'reporter');
    assert.equal(res.body.data.displayName, 'Reporter One');
    assert.ok(!('passwordHash' in res.body.data));
    assert.ok(res.headers['set-cookie']);
  });

  test('GET /me is 401 without a cookie and 200 with one', async () => {
    const anon = await request(app).get('/api/auth/me');
    assert.equal(anon.status, 401);

    const authed = await request(app).get('/api/auth/me').set('Cookie', await loginCookie());
    assert.equal(authed.status, 200);
    assert.equal(authed.body.data.username, 'reporter1');
  });

  test('logout destroys the session; a later /me with the same cookie is 401', async () => {
    const cookie = await loginCookie();

    const out = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    assert.equal(out.status, 200);
    assert.deepEqual(out.body.data, { ok: true });

    const after = await request(app).get('/api/auth/me').set('Cookie', cookie);
    assert.equal(after.status, 401);
  });

  test('deactivating the user logs out a still-valid cookie', async () => {
    const cookie = await loginCookie();
    await User.updateOne({ username: 'reporter1' }, { active: false });

    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    assert.equal(res.status, 401);
  });
});
