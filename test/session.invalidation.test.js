import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser, User } from '../models/user.model.js';

const PASSWORD = 'correct-horse-9';
const NEW_PASSWORD = 'brand-new-pass-9';

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
});

const seed = (username, role) => createUser({ username, password: PASSWORD, role, displayName: username });

async function loginAs(username) {
  const agent = request.agent(app).set('Sec-Fetch-Site', 'same-origin');
  const res = await agent.post('/api/auth/login').send({ username, password: PASSWORD });
  assert.equal(res.status, 200);
  return agent;
}

const sidOf = (res) => /connect\.sid=([^;]+)/.exec(res.headers['set-cookie']?.join(';') ?? '')?.[1];
const status = async (agent, path = '/api/auth/me') => (await agent.get(path)).status;

describe('login regenerates the session id', () => {
  test('re-login on the same jar issues a new session id and the session works', async () => {
    await seed('rep', 'reporter');
    const agent = request.agent(app).set('Sec-Fetch-Site', 'same-origin');
    const first = await agent.post('/api/auth/login').send({ username: 'rep', password: PASSWORD });
    const second = await agent.post('/api/auth/login').send({ username: 'rep', password: PASSWORD });
    assert.ok(sidOf(first) && sidOf(second));
    assert.notEqual(sidOf(first), sidOf(second));
    const me = await agent.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.data.username, 'rep');
  });

  test('the pre-login session id no longer works afterwards', async () => {
    await seed('rep', 'reporter');
    const agent = request.agent(app).set('Sec-Fetch-Site', 'same-origin');
    const first = await agent.post('/api/auth/login').send({ username: 'rep', password: PASSWORD });
    const oldCookie = first.headers['set-cookie'];
    await agent.post('/api/auth/login').send({ username: 'rep', password: PASSWORD });
    const stale = await request(app).get('/api/auth/me').set('Cookie', oldCookie).set('Sec-Fetch-Site', 'same-origin');
    assert.equal(stale.status, 401);
  });
});

describe('sessions are invalidated on security changes', () => {
  test('editor resets a password: target sessions die, editor keeps theirs', async () => {
    const rep = await seed('rep', 'reporter');
    await seed('boss', 'editor');
    const repAgent = await loginAs('rep');
    const boss = await loginAs('boss');
    const res = await boss.patch(`/api/users/${rep.id}`).send({ password: NEW_PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(await status(repAgent), 401);
    assert.equal(await status(boss), 200);
  });

  test('self password change via /me keeps the current session, kills the others', async () => {
    await seed('rep', 'reporter');
    const a = await loginAs('rep');
    const b = await loginAs('rep');
    const res = await a.patch('/api/users/me').send({ currentPassword: PASSWORD, password: NEW_PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(await status(a), 200);
    assert.equal(await status(b), 401);
  });

  test('a displayName-only /me change leaves other sessions alone', async () => {
    await seed('rep', 'reporter');
    const a = await loginAs('rep');
    const b = await loginAs('rep');
    await a.patch('/api/users/me').send({ displayName: 'New Name' });
    assert.equal(await status(b), 200);
  });

  test('editor changing their own password via PATCH /:id keeps the current session', async () => {
    const boss = await seed('boss', 'editor');
    await seed('other', 'editor');
    const a = await loginAs('boss');
    const b = await loginAs('boss');
    const res = await a.patch(`/api/users/${boss.id}`).send({ password: NEW_PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(await status(a), 200);
    assert.equal(await status(b), 401);
  });

  test('deactivation destroys the user sessions', async () => {
    const rep = await seed('rep', 'reporter');
    await seed('boss', 'editor');
    const repAgent = await loginAs('rep');
    const boss = await loginAs('boss');
    const res = await boss.patch(`/api/users/${rep.id}`).send({ active: false });
    assert.equal(res.status, 200);
    assert.equal(await status(repAgent), 401);
  });

  test('role change destroys the user sessions; a new login gets the new role', async () => {
    const rep = await seed('rep', 'reporter');
    await seed('boss', 'editor');
    const repAgent = await loginAs('rep');
    const boss = await loginAs('boss');
    const res = await boss.patch(`/api/users/${rep.id}`).send({ role: 'editor' });
    assert.equal(res.status, 200);
    assert.equal(await status(repAgent), 401);
    const again = await loginAs('rep');
    assert.equal(await status(again, '/api/users'), 200);
  });

  test('an unchanged role or displayName-only PATCH leaves sessions alone', async () => {
    const rep = await seed('rep', 'reporter');
    await seed('boss', 'editor');
    const repAgent = await loginAs('rep');
    const boss = await loginAs('boss');
    await boss.patch(`/api/users/${rep.id}`).send({ role: 'reporter', displayName: 'Renamed' });
    assert.equal(await status(repAgent), 200);
  });

  test('end-to-end: a demoted editor loses editor access on the very next request', async () => {
    await seed('editor1', 'editor');
    const e2 = await seed('editor2', 'editor');
    const editor1 = await loginAs('editor1');
    const editor2 = await loginAs('editor2');
    assert.equal(await status(editor2, '/api/users'), 200);
    const res = await editor1.patch(`/api/users/${e2.id}`).send({ role: 'reporter' });
    assert.equal(res.status, 200);
    const next = await status(editor2, '/api/users');
    assert.ok(next === 401 || next === 403, `expected 401/403, got ${next}`);
  });
});
