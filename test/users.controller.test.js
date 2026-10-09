import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser, User } from '../models/user.model.js';
import { Article } from '../models/article.model.js';

const PASSWORD = 'correct-horse-9';

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
  await Article.deleteMany({});
  await mongoose.connection.collection('sessions').deleteMany({}).catch(() => {});
});

async function seedUser(username, role = 'reporter') {
  return createUser({ username, password: PASSWORD, role, displayName: username });
}

/** A supertest agent (cookie jar) logged in as `username`. */
async function loginAs(username) {
  const agent = request.agent(app).set('Sec-Fetch-Site', 'same-origin');
  const res = await agent.post('/api/auth/login').send({ username, password: PASSWORD });
  assert.equal(res.status, 200);
  return agent;
}

/** Two editors: `boss` (the caller) and `other`, plus a reporter. */
async function setup() {
  const boss = await seedUser('boss', 'editor');
  const other = await seedUser('other', 'editor');
  const rep = await seedUser('rep', 'reporter');
  const agent = await loginAs('boss');
  return { boss, other, rep, agent };
}

describe('POST /api/users validation', () => {
  const valid = { username: 'newbie', password: 'long-enough-pw', role: 'reporter', displayName: 'New' };

  test('creates a user with valid input', async () => {
    const { agent } = await setup();
    const res = await agent.post('/api/users').send(valid);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.username, 'newbie');
  });

  for (const [name, patch] of [
    ['numeric username', { username: 5 }],
    ['object username', { username: { $ne: 'x' } }],
    ['blank username', { username: '   ' }],
    ['numeric password', { password: 1234567890123 }],
    ['non-string displayName', { displayName: ['a'] }],
    ['blank displayName', { displayName: ' ' }],
    ['non-string role', { role: 5 }],
    ['unknown role', { role: 'admin' }],
    ['password under 10 chars', { password: 'short' }],
    ['password over 72 bytes', { password: 'a'.repeat(73) }],
    ['password over 72 bytes (multibyte, under 72 chars)', { password: 'é'.repeat(37) }],
    ['non-boolean active', { active: 'false' }],
  ]) {
    test(`${name} → 400`, async () => {
      const { agent } = await setup();
      const res = await agent.post('/api/users').send({ ...valid, ...patch });
      assert.equal(res.status, 400);
    });
  }

  test('accepts a password of exactly 72 bytes', async () => {
    const { agent } = await setup();
    const res = await agent.post('/api/users').send({ ...valid, password: 'a'.repeat(72) });
    assert.equal(res.status, 201);
  });

  test('duplicate username (case-insensitive) → 409', async () => {
    const { agent } = await setup();
    const res = await agent.post('/api/users').send({ ...valid, username: 'REP' });
    assert.equal(res.status, 409);
  });
});

describe('GET /api/users', () => {
  test('q is a literal, case-insensitive substring - regex metacharacters do not 500', async () => {
    const { agent } = await setup();
    await seedUser('a.b');
    for (const q of ['(', '.*', '[', '\\']) {
      const res = await agent.get('/api/users').query({ q });
      assert.equal(res.status, 200, `q=${q}`);
      assert.equal(res.body.data.users.length, 0, `q=${q} matches literally`);
    }
    const dot = await agent.get('/api/users').query({ q: 'A.B' });
    assert.deepEqual(dot.body.data.users.map((u) => u.username), ['a.b']);
  });

  test('repeated q (array) → 400', async () => {
    const { agent } = await setup();
    const res = await agent.get('/api/users?q=a&q=b');
    assert.equal(res.status, 400);
  });

  test('malformed cursor → 400', async () => {
    const { agent } = await setup();
    const res = await agent.get('/api/users').query({ cursor: 'nope' });
    assert.equal(res.status, 400);
  });

  test('paginates with the shared limit clamp and a keyset cursor', async () => {
    const { agent } = await setup(); // 3 users
    const p1 = await agent.get('/api/users').query({ limit: 2 });
    assert.equal(p1.body.data.users.length, 2);
    assert.ok(p1.body.data.nextCursor);
    const p2 = await agent.get('/api/users').query({ limit: 2, cursor: p1.body.data.nextCursor });
    assert.equal(p2.body.data.users.length, 1);
    assert.equal(p2.body.data.nextCursor, null);
    const bad = await agent.get('/api/users').query({ limit: 'abc' });
    assert.equal(bad.status, 200);
  });
});

describe('GET/PATCH/DELETE with a malformed id', () => {
  test('→ 404, not 500', async () => {
    const { agent } = await setup();
    assert.equal((await agent.get('/api/users/nope')).status, 404);
    assert.equal((await agent.patch('/api/users/nope').send({})).status, 404);
    assert.equal((await agent.delete('/api/users/nope')).status, 404);
  });
});

describe('PATCH /api/users/:id', () => {
  test('updates role, displayName, active, password', async () => {
    const { agent, rep } = await setup();
    const res = await agent
      .patch(`/api/users/${rep.id}`)
      .send({ role: 'editor', displayName: 'Renamed', active: false, password: 'another-long-pw' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.role, 'editor');
    assert.equal(res.body.data.displayName, 'Renamed');
    assert.equal(res.body.data.active, false);
  });

  test('unknown field → 400 and nothing is changed', async () => {
    const { agent, rep } = await setup();
    const res = await agent.patch(`/api/users/${rep.id}`).send({ displayName: 'X', username: 'hax' });
    assert.equal(res.status, 400);
    const fresh = await User.findById(rep.id);
    assert.equal(fresh.displayName, 'rep');
    assert.equal(fresh.username, 'rep');
  });

  for (const [name, body] of [
    ['string active "false"', { active: 'false' }],
    ['numeric active', { active: 0 }],
    ['numeric displayName', { displayName: 5 }],
    ['blank displayName', { displayName: '' }],
    ['non-string role', { role: ['editor'] }],
    ['short password', { password: 'short' }],
    ['73-byte password', { password: 'a'.repeat(73) }],
  ]) {
    test(`${name} → 400`, async () => {
      const { agent, rep } = await setup();
      const res = await agent.patch(`/api/users/${rep.id}`).send(body);
      assert.equal(res.status, 400);
    });
  }

  test('editor cannot deactivate themselves', async () => {
    const { agent, boss } = await setup();
    const res = await agent.patch(`/api/users/${boss.id}`).send({ active: false });
    assert.equal(res.status, 403);
    assert.equal((await User.findById(boss.id)).active, true);
  });

  test('editor cannot demote themselves', async () => {
    const { agent, boss } = await setup();
    const res = await agent.patch(`/api/users/${boss.id}`).send({ role: 'reporter' });
    assert.equal(res.status, 403);
    assert.equal((await User.findById(boss.id)).role, 'editor');
  });

  test('editor may edit their own displayName/password and re-assert their own role', async () => {
    const { agent, boss } = await setup();
    const res = await agent
      .patch(`/api/users/${boss.id}`)
      .send({ displayName: 'Boss II', role: 'editor', active: true });
    assert.equal(res.status, 200);
  });

  test('an editor may deactivate or demote a peer editor while another active editor remains', async () => {
    const { agent, other } = await setup();
    const res = await agent.patch(`/api/users/${other.id}`).send({ active: false });
    assert.equal(res.status, 200);
  });
});

describe('DELETE /api/users/:id', () => {
  test('editor cannot delete themselves', async () => {
    const { agent, boss } = await setup();
    const res = await agent.delete(`/api/users/${boss.id}`);
    assert.equal(res.status, 403);
    assert.ok(await User.findById(boss.id));
  });

  test('hard-deletes a user with no articles', async () => {
    const { agent, rep } = await setup();
    const res = await agent.delete(`/api/users/${rep.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.deleted, 'hard');
    assert.equal(await User.findById(rep.id), null);
  });

  test('soft-deletes a user who has articles', async () => {
    const { agent, rep } = await setup();
    await Article.collection.insertOne({ author: rep._id, title: 't' });
    const res = await agent.delete(`/api/users/${rep.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.deleted, 'soft');
    assert.equal((await User.findById(rep.id)).active, false);
  });

  test('an editor may delete a peer editor while another active editor remains', async () => {
    const { agent, other } = await setup();
    const res = await agent.delete(`/api/users/${other.id}`);
    assert.equal(res.status, 200);
  });
});

describe('PATCH /api/users/me', () => {
  test('updates displayName', async () => {
    const { agent } = await setup();
    const res = await agent.patch('/api/users/me').send({ displayName: 'Boss Two' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.displayName, 'Boss Two');
  });

  test('unknown field (role, active, username) → 400', async () => {
    const { agent, boss } = await setup();
    for (const body of [{ role: 'reporter' }, { active: false }, { username: 'x' }]) {
      const res = await agent.patch('/api/users/me').send(body);
      assert.equal(res.status, 400);
    }
    assert.equal((await User.findById(boss.id)).role, 'editor');
  });

  test('non-string displayName / blank → 400', async () => {
    const { agent } = await setup();
    assert.equal((await agent.patch('/api/users/me').send({ displayName: 5 })).status, 400);
    assert.equal((await agent.patch('/api/users/me').send({ displayName: '  ' })).status, 400);
  });

  test('changes password with the correct currentPassword', async () => {
    const { agent } = await setup();
    const res = await agent
      .patch('/api/users/me')
      .send({ password: 'brand-new-password', currentPassword: PASSWORD });
    assert.equal(res.status, 200);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'boss', password: 'brand-new-password' });
    assert.equal(login.status, 200);
  });

  test('missing currentPassword → 400, wrong → 401', async () => {
    const { agent } = await setup();
    assert.equal((await agent.patch('/api/users/me').send({ password: 'brand-new-password' })).status, 400);
    const wrong = await agent
      .patch('/api/users/me')
      .send({ password: 'brand-new-password', currentPassword: 'nope' });
    assert.equal(wrong.status, 401);
  });

  test('weak or non-string password / currentPassword → 400', async () => {
    const { agent } = await setup();
    for (const body of [
      { password: 'short', currentPassword: PASSWORD },
      { password: 'a'.repeat(73), currentPassword: PASSWORD },
      { password: 12345678901234, currentPassword: PASSWORD },
      { password: 'brand-new-password', currentPassword: { $ne: '' } },
    ]) {
      const res = await agent.patch('/api/users/me').send(body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });
});
