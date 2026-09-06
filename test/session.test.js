import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { sessionMiddleware } from '../config/session.js';

let mongod;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

/** A minimal app that mounts the real session middleware plus two probe routes. */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(sessionMiddleware());
  app.post('/_login', (req, res) => {
    req.session.user = { id: 'u1', role: 'editor' };
    res.json({ data: { ok: true } });
  });
  app.get('/_who', (req, res) => {
    res.json({ data: req.session.user ?? null });
  });
  return app;
}

describe('sessionMiddleware', () => {
  test('a session written by one app instance is readable from another', async () => {
    const appA = buildApp();
    const appB = buildApp();

    const login = await request(appA).post('/_login');
    const cookie = login.headers['set-cookie'];
    assert.ok(cookie, 'login sets a session cookie');

    // appB never saw the login; the session comes from Mongo — the Restart guarantee.
    const who = await request(appB).get('/_who').set('Cookie', cookie);
    assert.deepEqual(who.body.data, { id: 'u1', role: 'editor' });
  });

  test('a request with no cookie has no session user', async () => {
    const res = await request(buildApp()).get('/_who');
    assert.equal(res.body.data, null);
  });
});
