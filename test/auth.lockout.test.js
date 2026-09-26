import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser, User } from '../models/user.model.js';
import { loginAttempts } from '../middleware/loginLockout.js';

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
  loginAttempts.clear();
  await User.deleteMany({});
  await mongoose.connection.collection('sessions').deleteMany({}).catch(() => {});
  await createUser({
    username: 'lockout-target',
    password: 'goodpass',
    role: 'reporter',
    displayName: 'Lockout Target',
  });
});

async function failLogin() {
  return request(app)
    .post('/api/auth/login')
    .send({ username: 'lockout-target', password: 'wrong' });
}

describe('login lockout', () => {
  test('5 failed logins for a username lock out the 6th attempt, even with the correct password', async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await failLogin();
      assert.equal(res.status, 401, `attempt ${i + 1} should still be a normal 401`);
    }

    const sixth = await request(app)
      .post('/api/auth/login')
      .send({ username: 'lockout-target', password: 'goodpass' });

    assert.equal(sixth.status, 429);
    assert.equal(sixth.body.error.code, 'rate_limited');
  });

  test('4 failed logins do not lock out — the correct password on the 5th attempt still logs in', async () => {
    for (let i = 0; i < 4; i += 1) {
      await failLogin();
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'lockout-target', password: 'goodpass' });

    assert.equal(res.status, 200);
  });

  test('a successful login clears the failure count for that username', async () => {
    for (let i = 0; i < 4; i += 1) {
      await failLogin();
    }
    const success = await request(app)
      .post('/api/auth/login')
      .send({ username: 'lockout-target', password: 'goodpass' });
    assert.equal(success.status, 200);

    // 4 more failures after a successful login should not lock out — the
    // count was reset on success, not carried over.
    for (let i = 0; i < 4; i += 1) {
      const res = await failLogin();
      assert.equal(res.status, 401);
    }
  });

  test('lockout for one username does not block a different username', async () => {
    await createUser({
      username: 'other-user',
      password: 'goodpass',
      role: 'reporter',
      displayName: 'Other User',
    });

    for (let i = 0; i < 5; i += 1) {
      await failLogin();
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'other-user', password: 'goodpass' });

    assert.equal(res.status, 200);
  });
});
