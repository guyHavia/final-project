import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

import { createLogger } from '../lib/logger.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { notFound, errorHandler } from '../middleware/error.js';
import { createApp } from '../app.js';

describe('createLogger', () => {
  test('writes one structured JSON line per call', () => {
    const lines = [];
    const log = createLogger({ write: (s) => lines.push(s) });

    log.info('user.created', { id: 7 });

    assert.equal(lines.length, 1);
    assert.ok(lines[0].endsWith('\n'));
    const rec = JSON.parse(lines[0]);
    assert.equal(rec.level, 'info');
    assert.equal(rec.event, 'user.created');
    assert.equal(rec.id, 7);
    assert.ok(!Number.isNaN(Date.parse(rec.ts)));
  });

  test('error() sets level to error', () => {
    const lines = [];
    const log = createLogger({ write: (s) => lines.push(s) });

    log.error('db.down', { reason: 'timeout' });

    assert.equal(JSON.parse(lines[0]).level, 'error');
  });
});

describe('AppError', () => {
  test('notFound() carries status 404 and code not_found', () => {
    const err = AppError.notFound('no such article');

    assert.ok(err instanceof Error);
    assert.equal(err.status, 404);
    assert.equal(err.code, 'not_found');
    assert.equal(err.message, 'no such article');
  });

  test('forbidden() carries status 403 and code forbidden', () => {
    const err = AppError.forbidden();

    assert.equal(err.status, 403);
    assert.equal(err.code, 'forbidden');
  });
});

describe('asyncHandler', () => {
  test('forwards a rejected promise to next', async () => {
    const boom = new Error('boom');
    const handler = asyncHandler(async () => {
      throw boom;
    });

    let forwarded;
    await handler({}, {}, (err) => {
      forwarded = err;
    });

    assert.equal(forwarded, boom);
  });

  test('does not call next when the handler resolves', async () => {
    const handler = asyncHandler(async (req, res) => {
      res.done = true;
    });
    const res = {};
    let nextCalled = false;

    await handler({}, res, () => {
      nextCalled = true;
    });

    assert.equal(res.done, true);
    assert.equal(nextCalled, false);
  });
});

describe('error middleware', () => {
  function buildApp(mountRoutes) {
    const app = express();
    app.use(express.json());
    mountRoutes(app);
    app.use(notFound);
    app.use(errorHandler);
    return app;
  }

  test('maps an AppError to its status and the error envelope', async () => {
    const app = buildApp((a) => {
      a.get('/x', asyncHandler(async () => {
        throw AppError.forbidden('nope');
      }));
    });

    const res = await request(app).get('/x');

    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: { message: 'nope', code: 'forbidden' } });
  });

  test('maps an unknown error to 500 without leaking its message', async () => {
    const app = buildApp((a) => {
      a.get('/x', asyncHandler(async () => {
        throw new Error('secret internal detail');
      }));
    });

    const res = await request(app).get('/x');

    assert.equal(res.status, 500);
    assert.equal(res.body.error.code, 'internal');
    assert.ok(!JSON.stringify(res.body).includes('secret'));
  });

  test('unmatched route returns the 404 envelope', async () => {
    const app = buildApp(() => {});

    const res = await request(app).get('/missing');

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'not_found');
  });
});

describe('createApp', () => {
  test('GET /api/health returns the data envelope', async () => {
    const res = await request(createApp()).get('/api/health');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { data: { status: 'ok' } });
  });

  test('unknown /api route returns the 404 envelope', async () => {
    const res = await request(createApp()).get('/api/nope');

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'not_found');
  });
});
