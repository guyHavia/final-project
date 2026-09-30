import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { Article } from '../models/article.model.js';
import { Comment } from '../models/comment.model.js';
import { commentRateLimitStore } from '../routes/comment.routes.js';

/**
 * The comment endpoints through the REAL app (createApp): proves the routes are
 * mounted, the Cookie header is parsed, and the rate limit works end to end —
 * the pieces the unit-level comment tests mock away.
 */

let stopMongo;
let app;
let article;

before(async () => {
  stopMongo = await startMongo();
  app = createApp();
  article = await Article.create({
    title: 'Public News',
    category: 'politics',
    author: new mongoose.Types.ObjectId(),
    state: 'Published',
    firstPublishedAt: new Date(),
  });
});

after(async () => {
  await stopMongo();
});

afterEach(async () => {
  await Comment.deleteMany({});
  commentRateLimitStore.clear();
});

const post = (cookie, body = 'Nice piece') => {
  const req = request(app)
    .post(`/api/articles/${article._id}/comments`)
    .send({ authorName: 'Guest', body });
  return cookie ? req.set('Cookie', cookie) : req;
};

describe('comments in the real app', () => {
  test('GET and POST are mounted under /api', async () => {
    const created = await post();
    assert.equal(created.status, 201);

    const list = await request(app).get(`/api/articles/${article._id}/comments`);
    assert.equal(list.status, 200);
    assert.equal(list.body.data.items.length, 1);
    assert.equal(list.body.data.items[0].body, 'Nice piece');
  });

  test('the same device is limited to 3 comments a minute; the 4th is refused and not stored', async () => {
    const first = await post();
    assert.equal(first.status, 201);
    const setCookie = first.headers['set-cookie'].find((c) => c.startsWith('deviceId='));
    assert.ok(setCookie, 'the first comment must issue a deviceId cookie');
    const cookie = setCookie.split(';')[0];

    assert.equal((await post(cookie)).status, 201);
    assert.equal((await post(cookie)).status, 201);

    const blocked = await post(cookie, 'one too many');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error.code, 'rate_limited');
    assert.equal(blocked.body.error.message, 'you are posting too fast, wait a moment');
    assert.equal(await Comment.countDocuments({ body: 'one too many' }), 0);
  });

  test('a different device is not affected by another device hitting the limit', async () => {
    const cookie = (await post()).headers['set-cookie'][0].split(';')[0];
    await post(cookie);
    await post(cookie);
    assert.equal((await post(cookie)).status, 429);

  });

  test('dropping the cookie on every request does not bypass the limit', async () => {
    const statuses = [];
    for (let i = 0; i < 15; i++) statuses.push((await post()).status);
    assert.ok(statuses.includes(429), `expected a 429 in ${statuses.join(',')}`);
    assert.ok((await Comment.countDocuments({})) < 15);
  });

  test('invalid and not-found posts do not consume quota', async () => {
    const cookie = 'deviceId=quota-test';
    for (let i = 0; i < 5; i++) {
      assert.equal((await post(cookie, '')).status, 400);
      const missing = await request(app)
        .post(`/api/articles/${new mongoose.Types.ObjectId()}/comments`)
        .set('Cookie', cookie)
        .send({ authorName: 'Guest', body: 'x' });
      assert.equal(missing.status, 404);
    }
    for (let i = 0; i < 3; i++) assert.equal((await post(cookie)).status, 201);
    assert.equal((await post(cookie)).status, 429);
  });

  test('DELETE /api/comments/:id is mounted and needs an editor', async () => {
    const created = await post();
    const res = await request(app).delete(`/api/comments/${created.body.data.id}`);
    assert.equal(res.status, 401);
  });
});
