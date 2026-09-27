import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser, User } from '../models/user.model.js';
import { Article, CATEGORIES } from '../models/article.model.js';
import { ViewEvent } from '../models/viewEvent.model.js';
import {
  buildPublicFeedQuery,
  buildNewsroomQuery,
  buildMineQuery,
} from '../services/articleQuery.service.js';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
const BASE = Date.UTC(2025, 0, 1);
const TOTAL = 500;

let stopMongo;
let app;
let docs; // the raw seeded documents, used to compute expected results
const ids = {};
const cookies = {};

/**
 * One deterministic seeded article. `i % 5` picks the lifecycle kind so all four
 * states are present, including Published articles whose revision is pending
 * (`i % 10 === 4`) or was returned (`i % 10 === 9`) — those keep a published
 * snapshot that must stay public. Dates and view counts repeat on purpose so the
 * `_id` tie-break is exercised.
 */
function buildArticle(i) {
  const kind =
    i % 5 === 0 ? 'draft'
    : i % 5 === 1 ? 'fresh-pending'
    : i % 5 === 2 || i % 5 === 3 ? 'published'
    : i % 10 === 4 ? 'revision-pending'
    : 'revision-returned';
  const state = {
    draft: 'In Preparation',
    'fresh-pending': 'Pending Editor Approval',
    published: 'Published',
    'revision-pending': 'Pending Editor Approval',
    'revision-returned': 'Returned for Corrections',
  }[kind];
  const hasPublished = ['published', 'revision-pending', 'revision-returned'].includes(kind);
  const isRevision = kind.startsWith('revision');

  const author =
    i === 2 ? ids.ghost : i === 3 ? ids.reporter3 : i % 2 === 0 ? ids.reporter1 : ids.reporter2;
  const firstPublishedAt = hasPublished ? new Date(BASE + (i % 37) * DAY) : undefined;
  const updatedAt = new Date(BASE + 400 * DAY + (i % 250) * MIN);

  const doc = {
    _id: new mongoose.Types.ObjectId(),
    author,
    state,
    title: kind === 'draft' ? `Election draft ${i}` : `Working ${i}`,
    abstract: `Working abstract ${i}`,
    body: `Working body ${i}`,
    image: `https://img.example/working-${i}.jpg`,
    category: isRevision ? CATEGORIES[(i + 3) % CATEGORIES.length] : CATEGORIES[i % CATEGORIES.length],
    published: hasPublished
      ? {
          title: i % 3 === 0 ? `Election update ${i}` : `Story ${i}`,
          abstract: `Published abstract ${i}`,
          body: `Published body ${i}`,
          image: `https://img.example/published-${i}.jpg`,
          category: CATEGORIES[i % CATEGORIES.length],
          publishedAt: new Date(firstPublishedAt.getTime() + HOUR),
          version: 1,
        }
      : null,
    firstPublishedAt,
    slug: hasPublished ? `story-${i}` : undefined,
    editorNote: kind === 'revision-returned' ? `Fix the intro of ${i}` : undefined,
    submittedAt: state === 'Pending Editor Approval' ? updatedAt : undefined,
    history: hasPublished ? [{ at: firstPublishedAt, kind: 'publish', by: ids.editor1 }] : [],
    viewCount: hasPublished ? (i * 7) % 50 : 0,
    createdAt: new Date(updatedAt.getTime() - DAY),
    updatedAt,
  };
  // The raw driver would store `undefined` as null; drop those keys instead.
  for (const key of Object.keys(doc)) if (doc[key] === undefined) delete doc[key];
  return doc;
}

const idOf = (doc) => String(doc._id);

/** Descending by `key(doc)`, ties broken by `_id` descending — the API's keyset order. */
function orderDesc(list, key) {
  return [...list].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka !== kb) return kb - ka;
    return idOf(b).localeCompare(idOf(a));
  });
}

/** Follows `nextCursor` to exhaustion and returns every item plus the page count. */
async function collect(path, params = {}, cookie) {
  const items = [];
  let cursor = null;
  let pages = 0;
  do {
    const qs = new URLSearchParams({ ...params, ...(cursor ? { cursor } : {}) });
    const req = request(app).get(`${path}?${qs}`);
    if (cookie) req.set('Cookie', cookie);
    const res = await req;
    assert.equal(res.status, 200, JSON.stringify(res.body));
    items.push(...res.body.data.items);
    cursor = res.body.data.nextCursor;
    pages += 1;
    assert.ok(pages <= TOTAL + 1, 'pagination never terminated');
  } while (cursor);
  return { items, pages };
}

async function login(username) {
  const res = await request(app).post('/api/auth/login').send({ username, password: 'goodpass' });
  assert.equal(res.status, 200);
  return res.headers['set-cookie'];
}

before(async () => {
  stopMongo = await startMongo();
  app = createApp();

  const make = (username, role, displayName) =>
    createUser({ username, password: 'goodpass', role, displayName });
  ids.reporter1 = (await make('reporter1', 'reporter', 'Rina Reporter'))._id;
  ids.reporter2 = (await make('reporter2', 'reporter', 'Ron Reporter'))._id;
  ids.reporter3 = (await make('reporter3', 'reporter', 'Dana Departed'))._id;
  ids.editor1 = (await make('editor1', 'editor', 'Eli Editor'))._id;
  ids.ghost = new mongoose.Types.ObjectId(); // an author whose User document no longer exists
  await User.updateOne({ _id: ids.reporter3 }, { active: false });

  docs = Array.from({ length: TOTAL }, (_, i) => buildArticle(i));
  await Article.syncIndexes();
  await Article.collection.insertMany(docs);

  cookies.reporter1 = await login('reporter1');
  cookies.reporter2 = await login('reporter2');
  cookies.editor1 = await login('editor1');
});

after(async () => {
  await stopMongo();
});

const publicDocs = () => docs.filter((d) => d.published);
const byDate = (list) => orderDesc(list, (d) => d.firstPublishedAt.getTime());
const byViews = (list) => orderDesc(list, (d) => d.viewCount);
const byUpdated = (list) => orderDesc(list, (d) => d.updatedAt.getTime());

describe('GET /api/articles — public feed', () => {
  test('first page: 20 public cards with the documented shape and no draft-only fields', async () => {
    const res = await request(app).get('/api/articles');
    assert.equal(res.status, 200);
    const { items, nextCursor } = res.body.data;
    assert.equal(items.length, 20);
    assert.equal(typeof nextCursor, 'string');

    const expected = byDate(publicDocs())[0];
    const card = items[0];
    assert.deepEqual(Object.keys(card).sort(), [
      'abstract', 'author', 'category', 'id', 'image', 'publishedAt', 'slug', 'title', 'updatedAt', 'viewCount',
    ]);
    assert.equal(card.id, idOf(expected));
    assert.equal(card.title, expected.published.title);
    assert.equal(card.category, expected.published.category);
    assert.equal(card.publishedAt, expected.firstPublishedAt.toISOString());
    assert.equal(card.updatedAt, expected.published.publishedAt.toISOString());
    assert.deepEqual(Object.keys(card.author).sort(), ['displayName', 'id']);
  });

  test('sort=date pages to exhaustion: every public article once, in order, no gaps', async () => {
    const { items, pages } = await collect('/api/articles');
    const expected = byDate(publicDocs()).map(idOf);
    assert.deepEqual(items.map((a) => a.id), expected);
    assert.equal(pages, Math.ceil(expected.length / 20));
  });

  test('articles with a pending or returned revision stay public, showing the approved version', async () => {
    const { items } = await collect('/api/articles', { limit: 50 });
    const pending = docs[4]; // revision pending
    const returned = docs[9]; // revision returned
    for (const doc of [pending, returned]) {
      const card = items.find((a) => a.id === idOf(doc));
      assert.ok(card, `${doc.state} article with a published version must be in the feed`);
      assert.equal(card.title, doc.published.title);
      assert.equal(card.category, doc.published.category);
      assert.notEqual(card.category, doc.category, 'the unapproved working category must not leak');
    }
    assert.ok(!items.some((a) => a.id === idOf(docs[0])), 'a draft must not appear');
    assert.ok(!items.some((a) => a.id === idOf(docs[1])), 'a never-published pending article must not appear');
  });

  test('sort=popularity orders by viewCount desc with an _id tie-break, across all pages', async () => {
    const { items } = await collect('/api/articles', { sort: 'popularity' });
    assert.deepEqual(items.map((a) => a.id), byViews(publicDocs()).map(idOf));
  });

  test('q is a case-insensitive substring match on the published title only', async () => {
    const { items } = await collect('/api/articles', { q: 'LECTION UP' });
    const expected = byDate(publicDocs().filter((d) => /lection up/i.test(d.published.title)));
    assert.ok(expected.length > 0);
    assert.deepEqual(items.map((a) => a.id), expected.map(idOf));
  });

  test('q treats regex characters literally', async () => {
    const res = await request(app).get('/api/articles?q=.*');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.items, []);
  });

  test('category filters on the published category', async () => {
    const category = CATEGORIES[4];
    const { items } = await collect('/api/articles', { category });
    const expected = byDate(publicDocs().filter((d) => d.published.category === category));
    assert.ok(expected.length > 0);
    assert.deepEqual(items.map((a) => a.id), expected.map(idOf));
  });

  test('q + category + sort=popularity combine correctly across pages', async () => {
    const category = CATEGORIES[3];
    const { items } = await collect('/api/articles', { q: 'story', category, sort: 'popularity', limit: 3 });
    const expected = byViews(
      publicDocs().filter((d) => d.published.category === category && /story/i.test(d.published.title)),
    );
    assert.ok(expected.length > 3);
    assert.deepEqual(items.map((a) => a.id), expected.map(idOf));
  });

  test('limit defaults to 20 and is clamped to 1..50', async () => {
    const count = async (limit) =>
      (await request(app).get(`/api/articles?limit=${limit}`)).body.data.items.length;
    assert.equal(await count(500), 50);
    assert.equal(await count(0), 1);
    assert.equal(await count(-3), 1);
    assert.equal(await count('abc'), 20);
    assert.equal(await count(7), 7);
  });

  test('a malformed cursor, or a cursor from a different sort, is a 400', async () => {
    const bad = await request(app).get('/api/articles?cursor=garbage');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, 'bad_request');

    const first = await request(app).get('/api/articles');
    const dateCursor = first.body.data.nextCursor;
    const mixed = await request(app).get(`/api/articles?sort=popularity&cursor=${dateCursor}`);
    assert.equal(mixed.status, 400);
  });

  test('an unknown sort or category is a 400', async () => {
    assert.equal((await request(app).get('/api/articles?sort=random')).status, 400);
    assert.equal((await request(app).get('/api/articles?category=cooking')).status, 400);
  });

  test('state is ignored for guests and reporters — they still get only the public feed', async () => {
    const guest = await collect('/api/articles', { state: 'In Preparation', limit: 50 });
    const reporter = await collect('/api/articles', { state: 'all', limit: 50 }, cookies.reporter1);
    const expected = byDate(publicDocs()).map(idOf);
    assert.deepEqual(guest.items.map((a) => a.id), expected);
    assert.deepEqual(reporter.items.map((a) => a.id), expected);
  });

  test('an editor without a state param also gets the public feed (the home page stays public)', async () => {
    const { items } = await collect('/api/articles', { limit: 50 }, cookies.editor1);
    assert.deepEqual(items.map((a) => a.id), byDate(publicDocs()).map(idOf));
  });

  test('bylines: a deactivated author keeps their name; a missing author gets a placeholder', async () => {
    const { items } = await collect('/api/articles', { limit: 50 });
    const deactivated = items.find((a) => a.id === idOf(docs[3]));
    const missing = items.find((a) => a.id === idOf(docs[2]));
    assert.deepEqual(deactivated.author, { id: String(ids.reporter3), displayName: 'Dana Departed' });
    assert.deepEqual(missing.author, { id: String(ids.ghost), displayName: 'Unknown author' });
  });
});

describe('GET /api/articles?state=… — editor newsroom view', () => {
  test('state=all returns every article in every state, most recently updated first', async () => {
    const { items } = await collect('/api/articles', { state: 'all', limit: 50 }, cookies.editor1);
    assert.deepEqual(items.map((a) => a.id), byUpdated(docs).map(idOf));
  });

  test('items carry the working copy plus workflow fields', async () => {
    const { items } = await collect('/api/articles', { state: 'all', limit: 50 }, cookies.editor1);
    const doc = docs[4]; // Published article with a pending revision
    const item = items.find((a) => a.id === idOf(doc));
    assert.equal(item.state, 'Pending Editor Approval');
    assert.equal(item.title, doc.title);
    assert.equal(item.category, doc.category);
    assert.equal(item.hasPublishedVersion, true);
    assert.equal(item.submittedAt, doc.submittedAt.toISOString());
    assert.equal(item.updatedAt, doc.updatedAt.toISOString());
    assert.equal(item.body, undefined, 'list items never carry the full body');
  });

  test('state=Pending Editor Approval includes fresh submissions and revisions of Published articles', async () => {
    const state = 'Pending Editor Approval';
    const { items } = await collect('/api/articles', { state, limit: 50 }, cookies.editor1);
    const expected = byUpdated(docs.filter((d) => d.state === state));
    assert.equal(expected.length, 150);
    assert.deepEqual(items.map((a) => a.id), expected.map(idOf));
    assert.ok(items.some((a) => a.hasPublishedVersion) && items.some((a) => !a.hasPublishedVersion));
  });

  test('q and category apply to the working copy in the newsroom view', async () => {
    const { items } = await collect(
      '/api/articles',
      { state: 'all', q: 'election draft', category: CATEGORIES[0], limit: 50 },
      cookies.editor1,
    );
    const expected = byUpdated(
      docs.filter((d) => d.category === CATEGORIES[0] && /election draft/i.test(d.title)),
    );
    assert.ok(expected.length > 0);
    assert.deepEqual(items.map((a) => a.id), expected.map(idOf));
  });

  test('an unknown state is a 400 for an editor', async () => {
    const res = await request(app).get('/api/articles?state=Archived').set('Cookie', cookies.editor1);
    assert.equal(res.status, 400);
  });
});

describe('GET /api/articles/mine — reporter work area', () => {
  test('requires a login', async () => {
    const res = await request(app).get('/api/articles/mine');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'unauthorized');
  });

  test("returns only the caller's own articles, in every state, most recently updated first", async () => {
    const { items } = await collect('/api/articles/mine', { limit: 50 }, cookies.reporter1);
    const own = byUpdated(docs.filter((d) => String(d.author) === String(ids.reporter1)));
    assert.deepEqual(items.map((a) => a.id), own.map(idOf));
    assert.ok(new Set(items.map((a) => a.state)).size >= 3, 'spans drafts, pending and published');
  });

  test('state filter narrows the list, and editorNote appears only on returned articles', async () => {
    const state = 'Returned for Corrections';
    const { items } = await collect('/api/articles/mine', { state, limit: 50 }, cookies.reporter2);
    const expected = byUpdated(
      docs.filter((d) => String(d.author) === String(ids.reporter2) && d.state === state),
    );
    assert.ok(expected.length > 0);
    assert.deepEqual(items.map((a) => a.id), expected.map(idOf));
    assert.ok(items.every((a) => a.editorNote === docs.find((d) => idOf(d) === a.id).editorNote));

    const all = await collect('/api/articles/mine', { limit: 50 }, cookies.reporter2);
    assert.ok(all.items.filter((a) => a.state !== state).every((a) => a.editorNote === null));
  });

  test('an unknown state is a 400', async () => {
    const res = await request(app).get('/api/articles/mine?state=nope').set('Cookie', cookies.reporter1);
    assert.equal(res.status, 400);
  });
});

describe('GET /api/articles/:id', () => {
  const get = (doc, cookie) => {
    const req = request(app).get(`/api/articles/${idOf(doc)}`);
    return cookie ? req.set('Cookie', cookie) : req;
  };

  test('a guest gets only the published version of a Published article', async () => {
    const doc = docs[7];
    const res = await get(doc);
    assert.equal(res.status, 200);
    const a = res.body.data;
    assert.equal(a.title, doc.published.title);
    assert.equal(a.body, doc.published.body);
    assert.equal(a.category, doc.published.category);
    assert.equal(a.publishedAt, doc.firstPublishedAt.toISOString());
    for (const hidden of ['state', 'editorNote', 'history', 'published', 'submittedAt']) {
      assert.equal(a[hidden], undefined, `${hidden} must not be exposed to the public`);
    }
  });

  test('a guest still gets the approved version while a revision is pending', async () => {
    const doc = docs[4];
    const res = await get(doc);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.body, doc.published.body);
    assert.notEqual(res.body.data.body, doc.body);
  });

  test('a never-published article is a 404 for guests and for other reporters', async () => {
    const draft = docs[10]; // owned by reporter1
    assert.equal((await get(draft)).status, 404);
    assert.equal((await get(draft, cookies.reporter2)).status, 404);
  });

  test('another reporter reading a Published article gets the public view, not the working copy', async () => {
    const doc = docs[4]; // reporter1's article with a pending revision
    const res = await get(doc, cookies.reporter2);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.body, doc.published.body);
    assert.equal(res.body.data.state, undefined);
  });

  test('the owner gets the full document, including a draft', async () => {
    const draft = docs[10];
    const res = await get(draft, cookies.reporter1);
    assert.equal(res.status, 200);
    const a = res.body.data;
    assert.equal(a.state, 'In Preparation');
    assert.equal(a.title, draft.title);
    assert.equal(a.body, draft.body);
    assert.equal(a.published, null);
  });

  test('an editor gets the working copy next to the published version, plus workflow fields', async () => {
    const doc = docs[9]; // Published article whose revision was returned
    const res = await get(doc, cookies.editor1);
    assert.equal(res.status, 200);
    const a = res.body.data;
    assert.equal(a.state, 'Returned for Corrections');
    assert.equal(a.body, doc.body);
    assert.equal(a.published.body, doc.published.body);
    assert.equal(a.editorNote, doc.editorNote);
    assert.equal(a.history.length, 1);
    assert.equal(a.history[0].kind, 'publish');
    assert.deepEqual(a.author, { id: String(doc.author), displayName: 'Ron Reporter' });
  });

  test('a malformed id is 400 invalid_id; an unknown id is 404', async () => {
    const malformed = await request(app).get('/api/articles/not-an-id');
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.error.code, 'invalid_id');
    const unknown = await request(app).get(`/api/articles/${new mongoose.Types.ObjectId()}`);
    assert.equal(unknown.status, 404);
  });

  test('reading through the JSON API does not count a view (D10: only the page render does)', async () => {
    const doc = docs[12];
    await get(doc);
    await get(doc);
    assert.equal(await ViewEvent.countDocuments({ article: doc._id }), 0);
    const stored = await Article.findById(doc._id).lean();
    assert.equal(stored.viewCount, doc.viewCount);
  });
});

describe('the feed queries use an index, not a collection scan', () => {
  /** Walks an explain() plan tree and collects every stage name and index name. */
  function planSummary(explain) {
    const stages = new Set();
    const indexes = new Set();
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (typeof node.stage === 'string') stages.add(node.stage);
      if (typeof node.indexName === 'string') indexes.add(node.indexName);
      for (const value of Object.values(node)) walk(value);
    };
    walk(explain.queryPlanner.winningPlan);
    return { stages, indexes };
  }

  async function assertIndexed({ filter, sort }, expectedIndex) {
    const explain = await Article.find(filter).sort(sort).limit(21).explain('queryPlanner');
    const { stages, indexes } = planSummary(explain);
    assert.ok(!stages.has('COLLSCAN'), `expected no collection scan, got ${[...stages]}`);
    assert.ok(indexes.has(expectedIndex), `expected ${expectedIndex}, got ${[...indexes]}`);
  }

  const cursorFrom = async (path, params, cookie) => {
    const req = request(app).get(`${path}?${new URLSearchParams(params)}`);
    if (cookie) req.set('Cookie', cookie);
    return (await req).body.data.nextCursor;
  };

  test('public feed by date (first page and a later page)', async () => {
    await assertIndexed(buildPublicFeedQuery({}), 'public_by_date');
    const cursor = await cursorFrom('/api/articles', {});
    await assertIndexed(buildPublicFeedQuery({ cursor }), 'public_by_date');
  });

  test('public feed by popularity', async () => {
    await assertIndexed(buildPublicFeedQuery({ sort: 'popularity' }), 'public_by_popularity');
  });

  test('public feed filtered by category', async () => {
    await assertIndexed(buildPublicFeedQuery({ category: CATEGORIES[1] }), 'public_by_category_date');
  });

  test('editor view: one state, and all states', async () => {
    await assertIndexed(buildNewsroomQuery({ state: 'Pending Editor Approval' }), 'newsroom_by_state');
    await assertIndexed(buildNewsroomQuery({ state: 'all' }), 'newsroom_all');
  });

  test("a reporter's own articles", async () => {
    await assertIndexed(buildMineQuery(ids.reporter1, {}), 'mine_by_updated');
  });
});
