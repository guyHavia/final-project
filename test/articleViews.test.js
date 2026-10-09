import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser } from '../models/user.model.js';
import { Article } from '../models/article.model.js';
import { ViewEvent } from '../models/viewEvent.model.js';
import { ViewSeen } from '../models/viewSeen.model.js';
import { recordArticleView, VIEW_DEDUP_WINDOW_MS } from '../services/articleViews.service.js';

/**
 * P2-08 - recordArticleView(articleId, { viewer }): the one call P3's article
 * page makes per render (D10). Records the view for Impact Analytics (P1's
 * ViewEvent) and bumps the article's viewCount for sort=popularity.
 */

let stopMongo;
let app;
const users = {};
const FIRST = new Date('2025-01-10T08:00:00.000Z');
const UPDATED = new Date('2025-01-11T09:00:00.000Z');

function seed(fields = {}) {
  return Article.create({
    title: 'Story',
    body: 'Body',
    category: 'world',
    author: users.reporter._id,
    ...fields,
  });
}

/** A published article whose updatedAt is pinned, so a change to it is detectable. */
async function seedPublished(fields = {}) {
  const article = await seed({
    state: 'Published',
    slug: `story-${new mongoose.Types.ObjectId()}`,
    firstPublishedAt: FIRST,
    published: { title: 'Story', body: 'Body', category: 'world', publishedAt: FIRST, version: 1 },
    viewCount: 0,
    ...fields,
  });
  await Article.collection.updateOne({ _id: article._id }, { $set: { updatedAt: UPDATED } });
  return article;
}

const stored = (id) => Article.findById(id).lean();
const eventsFor = (id) => ViewEvent.countDocuments({ article: id });

before(async () => {
  stopMongo = await startMongo();
  app = createApp();
  await Article.syncIndexes();
  users.reporter = await createUser({
    username: 'rina', password: 'goodpass', role: 'reporter', displayName: 'Rina Reporter',
  });
  users.editor = await createUser({
    username: 'eli', password: 'goodpass', role: 'editor', displayName: 'Eli Editor',
  });
});

after(async () => {
  await stopMongo();
});

beforeEach(async () => {
  await Promise.all([Article.deleteMany({}), ViewEvent.deleteMany({}), ViewSeen.deleteMany({})]);
});

describe('recordArticleView', () => {
  test("a reader's view is recorded for analytics and adds 1 to viewCount", async () => {
    const article = await seedPublished();
    const counted = await recordArticleView(article._id);

    assert.equal(counted, true);
    assert.equal(await eventsFor(article._id), 1);
    assert.equal((await stored(article._id)).viewCount, 1);
  });

  test('does not touch updatedAt, so reading never reorders the newsroom lists', async () => {
    const article = await seedPublished();
    await recordArticleView(article._id);
    assert.equal((await stored(article._id)).updatedAt.getTime(), UPDATED.getTime());
  });

  test('the same device refreshing within the window is counted once', async () => {
    const article = await seedPublished();
    const now = new Date('2026-10-09T10:00:00.000Z');
    const results = [];
    for (let i = 0; i < 3; i += 1) {
      results.push(await recordArticleView(String(article._id), { deviceId: 'dev-a', now: new Date(now.getTime() + i * 60_000) }));
    }
    assert.deepEqual(results, [true, false, false]);
    assert.equal(await eventsFor(article._id), 1);
    assert.equal((await stored(article._id)).viewCount, 1);
  });

  test('different devices are each counted', async () => {
    const article = await seedPublished();
    assert.equal(await recordArticleView(article._id, { deviceId: 'dev-a' }), true);
    assert.equal(await recordArticleView(article._id, { deviceId: 'dev-b' }), true);
    assert.equal((await stored(article._id)).viewCount, 2);
  });

  test('the same device returning after the window is counted again', async () => {
    const article = await seedPublished();
    const first = new Date('2026-10-09T10:00:00.000Z');
    const later = new Date(first.getTime() + VIEW_DEDUP_WINDOW_MS + 1000);
    assert.equal(await recordArticleView(article._id, { deviceId: 'dev-a', now: first }), true);
    assert.equal(await recordArticleView(article._id, { deviceId: 'dev-a', now: later }), true);
    assert.equal((await stored(article._id)).viewCount, 2);
  });

  test('one device firing many simultaneous requests is counted once', async () => {
    const article = await seedPublished();
    await Promise.all(Array.from({ length: 20 }, () => recordArticleView(article._id, { deviceId: 'dev-a' })));
    assert.equal((await stored(article._id)).viewCount, 1);
    assert.equal(await eventsFor(article._id), 1);
  });

  test('a device viewing two articles is counted on each', async () => {
    const one = await seedPublished();
    const two = await seedPublished();
    assert.equal(await recordArticleView(one._id, { deviceId: 'dev-a' }), true);
    assert.equal(await recordArticleView(two._id, { deviceId: 'dev-a' }), true);
  });

  test('refreshing the article page with the same device cookie adds one view', async () => {
    const article = await seedPublished();
    const agent = request.agent(app);
    await agent.get(`/article/${article.slug}`).expect(200);
    await agent.get(`/article/${article.slug}`).expect(200);
    await agent.get(`/article/${article.slug}`).expect(200);
    assert.equal((await stored(article._id)).viewCount, 1);
  });

  test('50 simultaneous readers are all counted (the increment is atomic)', async () => {
    const article = await seedPublished();
    await Promise.all(Array.from({ length: 50 }, () => recordArticleView(article._id)));
    assert.equal((await stored(article._id)).viewCount, 50);
    assert.equal(await eventsFor(article._id), 50);
  });

  test('logged-in staff (reporters and editors) are not counted', async () => {
    const article = await seedPublished();
    assert.equal(await recordArticleView(article._id, { viewer: users.reporter }), false);
    assert.equal(await recordArticleView(article._id, { viewer: users.editor }), false);
    assert.equal(await eventsFor(article._id), 0);
    assert.equal((await stored(article._id)).viewCount, 0);
  });

  test('an article with a revision under review is still public, so its views count', async () => {
    const article = await seedPublished({ state: 'Pending Editor Approval', submittedAt: new Date() });
    assert.equal(await recordArticleView(article._id), true);
    assert.equal((await stored(article._id)).viewCount, 1);
  });

  test('a never-published article is not counted', async () => {
    const draft = await seed();
    assert.equal(await recordArticleView(draft._id), false);
    assert.equal(await eventsFor(draft._id), 0);
    assert.equal((await stored(draft._id)).viewCount, 0);
  });

  test('bad input never throws and writes nothing', async () => {
    for (const input of [new mongoose.Types.ObjectId(), 'not-an-id', '', null, undefined, 42]) {
      assert.equal(await recordArticleView(input), false, `expected false for ${String(input)}`);
    }
    assert.equal(await ViewEvent.countDocuments(), 0);
  });

  test('counted views drive sort=popularity in the public feed', async () => {
    const quiet = await seedPublished();
    const popular = await seedPublished();
    for (let i = 0; i < 4; i += 1) await recordArticleView(popular._id);
    await recordArticleView(quiet._id);

    const res = await request(app).get('/api/articles?sort=popularity');
    assert.deepEqual(
      res.body.data.items.map((a) => [a.id, a.viewCount]),
      [[String(popular._id), 4], [String(quiet._id), 1]],
    );
  });
});
