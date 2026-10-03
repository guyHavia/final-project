import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser } from '../models/user.model.js';
import { Article } from '../models/article.model.js';
import { ViewEvent } from '../models/viewEvent.model.js';

/**
 * The public site through the REAL app (createApp): P3's server-rendered pages
 * are mounted, and the article page counts a reader's view once per render via
 * recordArticleView (P2-08, D10).
 */

let stopMongo;
let app;
const users = {};
const cookies = {};
let live;
let draft;

const FIRST = new Date('2025-02-01T09:00:00.000Z');
const FULL_BODY = 'The rover touched down at 04:12 UTC after a seven-month cruise. '.repeat(20);

async function login(username) {
  const res = await request(app).post('/api/auth/login').send({ username, password: 'goodpass' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.headers['set-cookie'];
}

const page = (path, who) => {
  const req = request(app).get(path);
  return who ? req.set('Cookie', cookies[who]) : req;
};
const viewsOf = async (doc) => ({
  viewCount: (await Article.findById(doc._id).lean()).viewCount,
  events: await ViewEvent.countDocuments({ article: doc._id }),
});

before(async () => {
  stopMongo = await startMongo();
  app = createApp();
  await Article.syncIndexes();
  const make = (username, role, displayName) =>
    createUser({ username, password: 'goodpass', role, displayName });
  users.reporter = await make('rina', 'reporter', 'Rina Reporter');
  users.editor = await make('eli', 'editor', 'Eli Editor');
  cookies.reporter = await login('rina');
  cookies.editor = await login('eli');
});

after(async () => {
  await stopMongo();
});

beforeEach(async () => {
  await Promise.all([Article.deleteMany({}), ViewEvent.deleteMany({})]);
  live = await Article.create({
    title: 'Mars Rover Lands', body: FULL_BODY, abstract: 'Touchdown confirmed.', category: 'science',
    author: users.reporter._id, state: 'Published', slug: 'mars-rover-lands', firstPublishedAt: FIRST,
    published: {
      title: 'Mars Rover Lands', body: FULL_BODY, abstract: 'Touchdown confirmed.',
      category: 'science', publishedAt: FIRST, version: 1,
    },
    history: [{ at: FIRST, kind: 'publish' }],
    viewCount: 0,
  });
  draft = await Article.create({
    title: 'Secret Draft Headline', body: 'Not ready', category: 'world',
    author: users.reporter._id, state: 'In Preparation',
  });
});

describe('public pages are mounted', () => {
  test('GET / renders the home feed with published articles only', async () => {
    const res = await page('/');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.text, /Mars Rover Lands/);
    assert.doesNotMatch(res.text, /Secret Draft Headline/);
  });

  test('GET /article/:slug renders the article with its full text in the first HTML response (SEO)', async () => {
    const res = await page('/article/mars-rover-lands');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.text, /Mars Rover Lands/);
    assert.ok(res.text.includes('The rover touched down at 04:12 UTC'), 'the body is server-rendered');
  });

  test('the slug is case-insensitive', async () => {
    assert.equal((await page('/article/MARS-Rover-Lands')).status, 200);
  });

  test('an unknown or never-published article renders the 404 page', async () => {
    for (const path of ['/article/no-such-story', `/article/${draft._id}`]) {
      const res = await page(path);
      assert.equal(res.status, 404, path);
      assert.match(res.headers['content-type'], /text\/html/, path);
      assert.match(res.text, /Page Not Found/, path);
    }
  });

  test('every public page has the site header: the name links home, plus a Newsroom link', async () => {
    for (const path of ['/', '/article/mars-rover-lands', '/article/no-such-story']) {
      const res = await page(path);
      assert.match(res.text, /<header class="site-header"/, `${path}: public header`);
      assert.match(res.text, /<a class="site-name" href="\/">The Daily Web<\/a>/, `${path}: link home`);
      assert.match(res.text, /href="\/login"[^>]*>Newsroom</, `${path}: newsroom link`);
      assert.doesNotMatch(res.text, /<header class="nav">|id="burger"/, `${path}: not the newsroom chrome`);
    }
  });

  test('the newsroom pages still work alongside the public site', async () => {
    assert.equal((await page('/login')).status, 200);
    const newsroom = await page('/newsroom');
    assert.equal(newsroom.status, 302);
    assert.equal(newsroom.headers.location, '/login');
  });
});

describe('the article page counts views (P2-08)', () => {
  test("a reader's visit adds 1 to viewCount and records one view for analytics", async () => {
    await page('/article/mars-rover-lands');
    assert.deepEqual(await viewsOf(live), { viewCount: 1, events: 1 });
  });

  test('every visit counts, including refreshes', async () => {
    for (let i = 0; i < 3; i += 1) await page('/article/mars-rover-lands');
    assert.deepEqual(await viewsOf(live), { viewCount: 3, events: 3 });
  });

  test('logged-in reporters and editors see the page but are not counted', async () => {
    assert.equal((await page('/article/mars-rover-lands', 'reporter')).status, 200);
    assert.equal((await page('/article/mars-rover-lands', 'editor')).status, 200);
    assert.deepEqual(await viewsOf(live), { viewCount: 0, events: 0 });
  });

  test('a 404 counts nothing', async () => {
    await page('/article/no-such-story');
    assert.equal(await ViewEvent.countDocuments(), 0);
  });

  test('reading through the JSON API or loading comments counts nothing (D10)', async () => {
    await page(`/api/articles/${live._id}`);
    await page(`/api/articles/${live._id}/comments`);
    assert.deepEqual(await viewsOf(live), { viewCount: 0, events: 0 });
  });

  test('the page shows the updated count to the next reader', async () => {
    await page('/article/mars-rover-lands');
    const second = await page('/article/mars-rover-lands');
    assert.match(second.text, /\b1 views\b/, 'the count rendered before this visit was recorded');
  });
});
