import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser, User } from '../models/user.model.js';
import { loginLimiter } from '../middleware/loginLockout.js';

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
  loginLimiter.clear();
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

describe('login lockout hardening (#47)', () => {
  test('a parallel burst of wrong passwords is capped at 5 processed attempts', async () => {
    const res = await Promise.all(Array.from({ length: 15 }, () => failLogin()));
    const codes = res.map((r) => r.status);
    assert.equal(codes.filter((c) => c === 401).length, 5);
    assert.equal(codes.filter((c) => c === 429).length, 10);
  });

  test('one ip spraying many usernames is blocked, even for a fresh username', async () => {
    const res = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        request(app).post('/api/auth/login').send({ username: `ghost${i}`, password: 'x' })
      )
    );
    assert.ok(res.some((r) => r.status === 429), 'some spray attempts rejected');
    const next = await request(app)
      .post('/api/auth/login')
      .send({ username: 'lockout-target', password: 'goodpass' });
    assert.equal(next.status, 429);
  });

  test('failed logins log only the normalized username, not the raw input', async () => {
    const { logger } = await import('../lib/logger.js');
    const seen = [];
    const orig = logger.warn;
    logger.warn = (event, meta) => seen.push({ event, meta });
    try {
      await request(app).post('/api/auth/login').send({ username: '  MiXeD  ', password: 'x' });
    } finally {
      logger.warn = orig;
    }
    const entry = seen.find((s) => s.event === 'auth.login.fail');
    assert.equal(entry.meta.username, 'mixed');
  });

  test('unknown users still pay for a bcrypt comparison (timing)', async () => {
    const bcrypt = (await import('bcrypt')).default;
    const orig = bcrypt.compare;
    let calls = 0;
    bcrypt.compare = (...a) => {
      calls += 1;
      return orig.apply(bcrypt, a);
    };
    try {
      await request(app).post('/api/auth/login').send({ username: 'nobody', password: 'x' });
    } finally {
      bcrypt.compare = orig;
    }
    assert.equal(calls, 1);
  });
});

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
