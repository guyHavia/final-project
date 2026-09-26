import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { sessionMiddleware, destroySessionsForUser } from '../config/session.js';

let stopMongo;

before(async () => {
  stopMongo = await startMongo();
});

after(async () => {
  await stopMongo();
});

beforeEach(async () => {
  await mongoose.connection.collection('sessions').deleteMany({}).catch(() => {});
});

/** A minimal app that logs in as whichever id/role the request body supplies. */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(sessionMiddleware());
  app.post('/_login', (req, res) => {
    req.session.user = { id: req.body.id, role: req.body.role ?? 'editor' };
    res.json({ data: { ok: true } });
  });
  app.get('/_who', (req, res) => {
    res.json({ data: req.session.user ?? null });
  });
  return app;
}

describe('destroySessionsForUser', () => {
  test('removes only the target user\'s session — a different user\'s session survives', async () => {
    const app = buildApp();

    const loginU1 = await request(app).post('/_login').send({ id: 'u1' });
    const cookieU1 = loginU1.headers['set-cookie'];

    const loginU2 = await request(app).post('/_login').send({ id: 'u2' });
    const cookieU2 = loginU2.headers['set-cookie'];

    await destroySessionsForUser('u1');

    const whoU1 = await request(app).get('/_who').set('Cookie', cookieU1);
    assert.equal(whoU1.body.data, null, 'u1 session was destroyed');

    const whoU2 = await request(app).get('/_who').set('Cookie', cookieU2);
    assert.deepEqual(whoU2.body.data, { id: 'u2', role: 'editor' }, 'u2 session is untouched');
  });

  test('destroys every session belonging to that user, not just the most recent one', async () => {
    const app = buildApp();

    // Two separate logins for the same user = two session docs (e.g. two devices).
    const loginA = await request(app).post('/_login').send({ id: 'multi-device-user' });
    const cookieA = loginA.headers['set-cookie'];
    const loginB = await request(app).post('/_login').send({ id: 'multi-device-user' });
    const cookieB = loginB.headers['set-cookie'];

    await destroySessionsForUser('multi-device-user');

    const whoA = await request(app).get('/_who').set('Cookie', cookieA);
    const whoB = await request(app).get('/_who').set('Cookie', cookieB);
    assert.equal(whoA.body.data, null);
    assert.equal(whoB.body.data, null);
  });

  test('a user with no sessions resolves without throwing', async () => {
    await assert.doesNotReject(() => destroySessionsForUser('nobody-logged-in'));
  });
});
