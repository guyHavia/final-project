import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser } from '../models/user.model.js';
import { Article } from '../models/article.model.js';
import { ViewEvent } from '../models/viewEvent.model.js';
import { recordArticleView } from '../services/articleViews.service.js';

/**
 * P2-08 — recordArticleView(articleId, { viewer }): the one call P3's article
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
  await Promise.all([Article.deleteMany({}), ViewEvent.deleteMany({})]);
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

  test('every entry counts, including the same reader refreshing', async () => {
    const article = await seedPublished();
    for (let i = 0; i < 3; i += 1) await recordArticleView(String(article._id));
    assert.equal(await eventsFor(article._id), 3);
    assert.equal((await stored(article._id)).viewCount, 3);
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
