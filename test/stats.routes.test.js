import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser, User } from '../models/user.model.js';
import { Article } from '../models/article.model.js';
import { ViewEvent } from '../models/viewEvent.model.js';

let stopMongo;
let app;
let article;

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
  await ViewEvent.deleteMany({});
  await mongoose.connection.collection('sessions').deleteMany({}).catch(() => {});

  await createUser({
    username: 'reporter1',
    password: 'goodpass',
    role: 'reporter',
    displayName: 'Reporter One',
  });
  await createUser({
    username: 'editor1',
    password: 'goodpass',
    role: 'editor',
    displayName: 'Editor One',
  });

  const authorId = new mongoose.Types.ObjectId();
  const publishAt = new Date('2024-06-01T00:00:00.000Z');
  const updateAt = new Date('2024-06-02T00:00:00.000Z');

  article = await new Article({
    category: 'politics',
    author: authorId,
    title: 'A headline',
    history: [
      { at: publishAt, kind: 'publish', by: authorId },
      { at: updateAt, kind: 'update', by: authorId },
    ],
  }).save();

  await ViewEvent.create([
    { article: article._id, at: new Date('2024-06-01T05:00:00.000Z') },
    { article: article._id, at: new Date('2024-06-01T06:00:00.000Z') },
  ]);
});

async function loginCookie(username) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'goodpass' });
  return res.headers['set-cookie'];
}

describe('GET /api/articles/:id/stats', () => {
  test('as a reporter → 403 forbidden', async () => {
    const cookie = await loginCookie('reporter1');
    const res = await request(app)
      .get(`/api/articles/${article.id}/stats`)
      .set('Cookie', cookie);

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'forbidden');
  });

  test('with no login cookie → 401 unauthorized', async () => {
    const res = await request(app).get(`/api/articles/${article.id}/stats`);

    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'unauthorized');
  });

  test('as an editor → 200 with series + markers matching seeded history', async () => {
    const cookie = await loginCookie('editor1');
    const res = await request(app)
      .get(`/api/articles/${article.id}/stats`)
      .query({
        from: '2024-06-01T00:00:00.000Z',
        to: '2024-06-01T23:59:59.999Z',
        bucket: 'hour',
      })
      .set('Cookie', cookie);

    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body.data).sort(), ['markers', 'series']);
    assert.ok(Array.isArray(res.body.data.series));
    assert.ok(res.body.data.series.length > 0);
    assert.equal(
      res.body.data.series.reduce((sum, point) => sum + point.count, 0),
      2,
    );
    assert.deepEqual(res.body.data.markers, [
      { t: new Date('2024-06-01T00:00:00.000Z').toISOString(), kind: 'publish' },
      { t: new Date('2024-06-02T00:00:00.000Z').toISOString(), kind: 'update' },
    ]);
  });

  test('an invalid bucket query value as editor → 400 bad_request', async () => {
    const cookie = await loginCookie('editor1');
    const res = await request(app)
      .get(`/api/articles/${article.id}/stats`)
      .query({ bucket: 'week' })
      .set('Cookie', cookie);

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'bad_request');
  });

  test('a non-existent article id as editor → 404 not_found', async () => {
    const cookie = await loginCookie('editor1');
    const missingId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/articles/${missingId}/stats`)
      .set('Cookie', cookie);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'not_found');
  });
});
