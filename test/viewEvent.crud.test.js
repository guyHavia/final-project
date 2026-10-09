import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser, User } from '../models/user.model.js';
import { Article } from '../models/article.model.js';
import { ViewEvent } from '../models/viewEvent.model.js';

/**
 * CRUD for the view-statistics model. Create is the article page render
 * (articleViews.test.js); these are the editor-only read / update / delete
 * endpoints over individual view records.
 */

let stopMongo;
let app;
let article;
let views;
const cookies = {};

const T = (iso) => new Date(iso);

before(async () => {
  stopMongo = await startMongo();
  app = createApp();
  await User.deleteMany({});
  await createUser({ username: 'rep', password: 'goodpass', role: 'reporter', displayName: 'Rep' });
  await createUser({ username: 'ed', password: 'goodpass', role: 'editor', displayName: 'Ed' });
  for (const username of ['rep', 'ed']) {
    const res = await request(app).post('/api/auth/login').send({ username, password: 'goodpass' });
    cookies[username] = res.headers['set-cookie'];
  }
});

after(async () => {
  await stopMongo();
});

beforeEach(async () => {
  await Promise.all([Article.deleteMany({}), ViewEvent.deleteMany({})]);
  article = await Article.create({
    title: 'Story',
    body: 'Body',
    category: 'world',
    author: new mongoose.Types.ObjectId(),
    state: 'Published',
    firstPublishedAt: T('2026-10-01T00:00:00Z'),
    published: { title: 'Story', body: 'Body', category: 'world', publishedAt: T('2026-10-01T00:00:00Z'), version: 1 },
    viewCount: 3,
  });
  views = await ViewEvent.create([
    { article: article._id, at: T('2026-10-01T10:00:00Z') },
    { article: article._id, at: T('2026-10-02T10:00:00Z') },
    { article: article._id, at: T('2026-10-03T10:00:00Z') },
  ]);
});

const as = (who, req) => {
  req.set('Sec-Fetch-Site', 'same-origin');
  return who ? req.set('Cookie', cookies[who]) : req;
};

describe('view records are editor-only', () => {
  for (const [method, name, path] of [
    ['get', '/api/articles/:id/views', () => `/api/articles/${article.id}/views`],
    ['get', '/api/views/:id', () => `/api/views/${views[0].id}`],
    ['patch', '/api/views/:id', () => `/api/views/${views[0].id}`],
    ['delete', '/api/views/:id', () => `/api/views/${views[0].id}`],
  ]) {
    test(`${method.toUpperCase()} ${name}: guest 401, reporter 403`, async () => {
      assert.equal((await as(null, request(app)[method](path()))).status, 401);
      assert.equal((await as('rep', request(app)[method](path()))).status, 403);
    });
  }
});

describe('GET /api/articles/:id/views', () => {
  test('lists the article\'s views newest first', async () => {
    const res = await as('ed', request(app).get(`/api/articles/${article.id}/views`));
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.data.items.map((v) => v.at),
      ['2026-10-03T10:00:00.000Z', '2026-10-02T10:00:00.000Z', '2026-10-01T10:00:00.000Z'],
    );
    assert.equal(res.body.data.items[0].article, article.id);
    assert.equal(res.body.data.nextCursor, null);
  });

  test('filters by a from/to time range', async () => {
    const res = await as('ed', request(app).get(`/api/articles/${article.id}/views`)
      .query({ from: '2026-10-02T00:00:00Z', to: '2026-10-02T23:59:59Z' }));
    assert.deepEqual(res.body.data.items.map((v) => v.id), [views[1].id]);
  });

  test('pages with a cursor, never repeating or skipping a record', async () => {
    const first = await as('ed', request(app).get(`/api/articles/${article.id}/views`).query({ limit: 2 }));
    assert.equal(first.body.data.items.length, 2);
    const second = await as('ed', request(app).get(`/api/articles/${article.id}/views`)
      .query({ limit: 2, cursor: first.body.data.nextCursor }));
    assert.deepEqual(second.body.data.items.map((v) => v.id), [views[0].id]);
    assert.equal(second.body.data.nextCursor, null);
  });

  test('bad range or cursor → 400', async () => {
    const bad = await as('ed', request(app).get(`/api/articles/${article.id}/views`).query({ from: 'nope' }));
    assert.equal(bad.status, 400);
    const badCursor = await as('ed', request(app).get(`/api/articles/${article.id}/views`).query({ cursor: 'xx' }));
    assert.equal(badCursor.status, 400);
  });
});

describe('GET /api/views/:id', () => {
  test('returns one view record', async () => {
    const res = await as('ed', request(app).get(`/api/views/${views[0].id}`));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { id: views[0].id, article: article.id, at: '2026-10-01T10:00:00.000Z' });
  });

  test('unknown id → 404, malformed id → 400', async () => {
    assert.equal((await as('ed', request(app).get(`/api/views/${new mongoose.Types.ObjectId()}`))).status, 404);
    assert.equal((await as('ed', request(app).get('/api/views/not-an-id'))).status, 400);
  });
});

describe('PATCH /api/views/:id', () => {
  test('corrects the time of a view', async () => {
    const res = await as('ed', request(app).patch(`/api/views/${views[0].id}`).send({ at: '2026-10-01T11:30:00Z' }));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.at, '2026-10-01T11:30:00.000Z');
    assert.equal((await ViewEvent.findById(views[0]._id)).at.toISOString(), '2026-10-01T11:30:00.000Z');
  });

  test('rejects a missing, invalid or future time and unknown fields', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    for (const body of [{}, { at: 'nope' }, { at: future }, { at: '2026-10-01T11:30:00Z', article: 'x' }]) {
      const res = await as('ed', request(app).patch(`/api/views/${views[0].id}`).send(body));
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });
});

describe('DELETE /api/views/:id', () => {
  test('removes the record and takes it off the article\'s view count', async () => {
    const res = await as('ed', request(app).delete(`/api/views/${views[0].id}`));
    assert.equal(res.status, 200);
    assert.equal(await ViewEvent.countDocuments({ article: article._id }), 2);
    assert.equal((await Article.findById(article._id)).viewCount, 2);
  });

  test('never drives the view count below zero', async () => {
    await Article.updateOne({ _id: article._id }, { $set: { viewCount: 0 } });
    await as('ed', request(app).delete(`/api/views/${views[0].id}`));
    assert.equal((await Article.findById(article._id)).viewCount, 0);
  });

  test('unknown id → 404', async () => {
    assert.equal((await as('ed', request(app).delete(`/api/views/${new mongoose.Types.ObjectId()}`))).status, 404);
  });
});
