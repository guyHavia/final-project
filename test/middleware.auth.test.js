import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { errorHandler } from '../middleware/error.js';

/** An app that injects a fake auth context, mounts `guard`, then a probe route. */
function appWith({ user, sessionUser, guard }) {
  const app = express();
  app.use((req, res, next) => {
    if (user !== undefined) req.user = user;
    req.session = sessionUser === undefined ? {} : { user: sessionUser };
    next();
  });
  app.get('/x', guard, (req, res) => res.json({ data: 'ok' }));
  app.use(errorHandler);
  return app;
}

describe('requireAuth', () => {
  test('no req.user → 401 unauthorized envelope', async () => {
    const res = await request(appWith({ guard: requireAuth })).get('/x');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'unauthorized');
  });

  test('req.user present → the handler runs', async () => {
    const res = await request(
      appWith({ user: { id: 'u1' }, guard: requireAuth }),
    ).get('/x');
    assert.equal(res.status, 200);
    assert.equal(res.body.data, 'ok');
  });
});

describe('requireRole', () => {
  test('a role outside the list → 403 forbidden envelope', async () => {
    const res = await request(
      appWith({ sessionUser: { id: 'u1', role: 'reporter' }, guard: requireRole('editor') }),
    ).get('/x');
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'forbidden');
  });

  test('a role in the list → the handler runs', async () => {
    const res = await request(
      appWith({ sessionUser: { id: 'u1', role: 'editor' }, guard: requireRole('editor') }),
    ).get('/x');
    assert.equal(res.status, 200);
    assert.equal(res.body.data, 'ok');
  });

  test('multiple accepted roles: either one passes', async () => {
    for (const role of ['reporter', 'editor']) {
      const res = await request(
        appWith({ sessionUser: { id: 'u1', role }, guard: requireRole('reporter', 'editor') }),
      ).get('/x');
      assert.equal(res.status, 200);
    }
  });

  test('no session user → 401 unauthorized', async () => {
    const res = await request(
      appWith({ guard: requireRole('reporter', 'editor') }),
    ).get('/x');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'unauthorized');
  });
});
