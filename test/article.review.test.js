import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser } from '../models/user.model.js';
import { Article } from '../models/article.model.js';
import { Comment } from '../models/comment.model.js';
import { ViewEvent } from '../models/viewEvent.model.js';

/**
 * P2-04 — editor workflow endpoints, through the real app:
 * POST /api/articles/:id/approve, POST /api/articles/:id/return, DELETE /api/articles/:id.
 */

let stopMongo;
let app;
const users = {};
const cookies = {};
const FIRST = new Date('2025-01-10T08:00:00.000Z');

async function login(username) {
  const res = await request(app).post('/api/auth/login').send({ username, password: 'goodpass' });
  assert.equal(res.status, 200);
  return res.headers['set-cookie'];
}

/** A complete article of reporter1's, waiting for approval. */
function seedPending(fields = {}) {
  return Article.create({
    title: 'Mars Rover Lands',
    abstract: 'Short',
    body: 'The full story',
    image: 'https://img.example/rover.jpg',
    category: 'science',
    author: users.reporter1._id,
    state: 'Pending Editor Approval',
    submittedAt: new Date(),
    ...fields,
  });
}

/** A Published article with a pending revision (working copy differs from `published`). */
function seedPendingRevision(slug = 'mars-rover-lands') {
  return seedPending({
    body: 'Revised story',
    slug,
    firstPublishedAt: FIRST,
    published: {
      title: 'Mars Rover Lands', abstract: 'Short', body: 'Original story',
      image: 'https://img.example/rover.jpg', category: 'science', publishedAt: FIRST, version: 1,
    },
    history: [{ at: FIRST, kind: 'publish', by: users.editor1._id }],
  });
}

const as = (who, req) => (who ? req.set('Cookie', cookies[who]) : req);
const approve = (who, id) => as(who, request(app).post(`/api/articles/${id}/approve`).send({}));
const sendBack = (who, id, body) => as(who, request(app).post(`/api/articles/${id}/return`).send(body));
const remove = (who, id) => as(who, request(app).delete(`/api/articles/${id}`));
const read = (who, id) => as(who, request(app).get(`/api/articles/${id}`));

before(async () => {
  stopMongo = await startMongo();
  app = createApp();
  await Article.syncIndexes();
  const make = (username, role, displayName) =>
    createUser({ username, password: 'goodpass', role, displayName });
  users.reporter1 = await make('reporter1', 'reporter', 'Rina Reporter');
  users.editor1 = await make('editor1', 'editor', 'Eli Editor');
  cookies.reporter1 = await login('reporter1');
  cookies.editor1 = await login('editor1');
});

after(async () => {
  await stopMongo();
});

beforeEach(async () => {
  await Promise.all([Article.deleteMany({}), Comment.deleteMany({}), ViewEvent.deleteMany({})]);
});

describe('POST /api/articles/:id/approve', () => {
  test('only editors: 401 for guests, 403 for reporters (even on their own article)', async () => {
    const pending = await seedPending();
    assert.equal((await approve(null, pending._id)).status, 401);
    assert.equal((await approve('reporter1', pending._id)).status, 403);
    assert.equal((await Article.findById(pending._id).lean()).state, 'Pending Editor Approval');
  });

  test('first approval publishes: public version, version 1, slug, first-publish date, "publish" marker', async () => {
    const pending = await seedPending();
    const res = await approve('editor1', pending._id);
    assert.equal(res.status, 200);
    const a = res.body.data;
    assert.equal(a.state, 'Published');
    assert.equal(a.slug, 'mars-rover-lands');
    assert.equal(a.published.title, 'Mars Rover Lands');
    assert.equal(a.published.body, 'The full story');
    assert.equal(a.published.version, 1);
    assert.ok(a.firstPublishedAt);
    assert.equal(a.submittedAt, null);
    assert.equal(a.history.length, 1);
    assert.equal(a.history[0].kind, 'publish');
    assert.equal(a.history[0].by, String(users.editor1._id));

    const publicView = await read(null, pending._id);
    assert.equal(publicView.status, 200);
    assert.equal(publicView.body.data.body, 'The full story');
    const feed = await request(app).get('/api/articles');
    assert.ok(feed.body.data.items.some((c) => c.id === String(pending._id)));
  });

  test('approving a revision replaces the public version and adds an "update" marker; URL and first date stay', async () => {
    const revision = await seedPendingRevision();
    assert.equal((await read(null, revision._id)).body.data.body, 'Original story');

    const res = await approve('editor1', revision._id);
    assert.equal(res.status, 200);
    const a = res.body.data;
    assert.equal(a.published.body, 'Revised story');
    assert.equal(a.published.version, 2);
    assert.equal(a.slug, 'mars-rover-lands');
    assert.equal(new Date(a.firstPublishedAt).getTime(), FIRST.getTime());
    assert.deepEqual(a.history.map((h) => h.kind), ['publish', 'update']);

    assert.equal((await read(null, revision._id)).body.data.body, 'Revised story');
  });

  test('two articles with the same title get different URLs', async () => {
    const one = await seedPending();
    const two = await seedPending();
    assert.equal((await approve('editor1', one._id)).body.data.slug, 'mars-rover-lands');
    assert.equal((await approve('editor1', two._id)).body.data.slug, 'mars-rover-lands-2');
  });

  test('only a Pending article can be approved (409 otherwise)', async () => {
    const draft = await seedPending({ state: 'In Preparation', submittedAt: undefined });
    assert.equal((await approve('editor1', draft._id)).status, 409);
    const pending = await seedPending();
    await approve('editor1', pending._id);
    assert.equal((await approve('editor1', pending._id)).status, 409, 'already Published');
  });

  test('a malformed id is 400; an unknown id is 404', async () => {
    assert.equal((await approve('editor1', 'nope')).body.error.code, 'invalid_id');
    assert.equal((await approve('editor1', new mongoose.Types.ObjectId())).status, 404);
  });
});

describe('POST /api/articles/:id/return', () => {
  test('only editors: 401 for guests, 403 for reporters', async () => {
    const pending = await seedPending();
    assert.equal((await sendBack(null, pending._id, { note: 'x' })).status, 401);
    assert.equal((await sendBack('reporter1', pending._id, { note: 'x' })).status, 403);
  });

  test('returns the article with the note, which the reporter then sees', async () => {
    const pending = await seedPending();
    const res = await sendBack('editor1', pending._id, { note: '  Add a second source.  ' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.state, 'Returned for Corrections');
    assert.equal(res.body.data.editorNote, 'Add a second source.');
    assert.equal(res.body.data.submittedAt, null);

    const mine = await as('reporter1', request(app).get('/api/articles/mine'));
    const item = mine.body.data.items.find((a) => a.id === String(pending._id));
    assert.equal(item.editorNote, 'Add a second source.');
    assert.equal((await read('reporter1', pending._id)).body.data.editorNote, 'Add a second source.');
  });

  test('the note is required: missing, blank, too long (over 1,000), not a string, or extra fields → 400', async () => {
    const pending = await seedPending();
    for (const body of [{}, { note: '   ' }, { note: 'x'.repeat(1001) }, { note: 42 }, { note: 'ok', state: 'Published' }]) {
      assert.equal((await sendBack('editor1', pending._id, body)).status, 400, JSON.stringify(body));
    }
    assert.equal((await sendBack('editor1', pending._id, { note: 'x'.repeat(1000) })).status, 200);
  });

  test('only a Pending article can be returned (409 otherwise)', async () => {
    const draft = await seedPending({ state: 'In Preparation', submittedAt: undefined });
    assert.equal((await sendBack('editor1', draft._id, { note: 'Fix it' })).status, 409);
  });

  test('returning a revision keeps the approved version public', async () => {
    const revision = await seedPendingRevision();
    await sendBack('editor1', revision._id, { note: 'Not yet' });
    const publicView = await read(null, revision._id);
    assert.equal(publicView.status, 200);
    assert.equal(publicView.body.data.body, 'Original story');
  });
});

describe('DELETE /api/articles/:id', () => {
  test('only editors: 401 for guests, 403 for reporters (even their own)', async () => {
    const pending = await seedPending();
    assert.equal((await remove(null, pending._id)).status, 401);
    assert.equal((await remove('reporter1', pending._id)).status, 403);
    assert.ok(await Article.exists({ _id: pending._id }));
  });

  test("deletes the article together with its comments and view records, and nothing else's", async () => {
    const doomed = await seedPendingRevision();
    const kept = await seedPendingRevision('another-story');
    const commentFor = (article) => ({ article: article._id, authorName: 'G', body: 'Hi', deviceId: 'd' });
    await Comment.create([commentFor(doomed), commentFor(doomed), commentFor(kept)]);
    await ViewEvent.create([{ article: doomed._id }, { article: kept._id }]);

    const res = await remove('editor1', doomed._id);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { ok: true });

    assert.equal(await Article.exists({ _id: doomed._id }), null);
    assert.equal(await Comment.countDocuments({ article: doomed._id }), 0);
    assert.equal(await ViewEvent.countDocuments({ article: doomed._id }), 0);
    assert.equal(await Comment.countDocuments({ article: kept._id }), 1);
    assert.equal(await ViewEvent.countDocuments({ article: kept._id }), 1);
  });

  test('a deleted published article disappears from the public site', async () => {
    const live = await seedPendingRevision();
    await remove('editor1', live._id);
    assert.equal((await read(null, live._id)).status, 404);
  });

  test('a malformed id is 400; an unknown or already deleted id is 404', async () => {
    const pending = await seedPending();
    await remove('editor1', pending._id);
    assert.equal((await remove('editor1', pending._id)).status, 404);
    assert.equal((await remove('editor1', 'nope')).body.error.code, 'invalid_id');
  });
});

describe('the full newsroom cycle', () => {
  test('create → submit → return → fix → resubmit → approve → revise → submit → approve', async () => {
    const reporter = (method, path, body) =>
      as('reporter1', request(app)[method](`/api/articles${path}`).send(body ?? {}));

    const id = (await reporter('post', '', { title: 'Heatwave', category: 'world', body: 'Hot.' })).body.data.id;
    await reporter('post', `/${id}/submit`);
    await sendBack('editor1', id, { note: 'Add temperatures' });
    await reporter('patch', `/${id}`, { body: 'Hot: 40°C.' });
    assert.equal((await reporter('post', `/${id}/submit`)).body.data.editorNote, null);
    assert.equal((await approve('editor1', id)).body.data.published.body, 'Hot: 40°C.');

    await reporter('patch', `/${id}/autosave`, { body: 'Hot: 41°C, a record.' });
    assert.equal((await read(null, id)).body.data.body, 'Hot: 40°C.', 'public unchanged while revising');
    await reporter('post', `/${id}/submit`);
    const final = (await approve('editor1', id)).body.data;

    assert.equal(final.published.body, 'Hot: 41°C, a record.');
    assert.deepEqual(final.history.map((h) => h.kind), ['publish', 'update']);
    assert.equal((await read(null, id)).body.data.body, 'Hot: 41°C, a record.');
  });
});

describe('concurrent transitions (#46)', () => {
  test('3 concurrent approves: one 200, the rest 409, exactly one history entry', async () => {
    const pending = await seedPending();
    const results = await Promise.all([1, 2, 3].map(() => approve('editor1', pending._id)));
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409, 409]);
    const stored = await Article.findById(pending._id).lean();
    assert.equal(stored.history.length, 1);
    assert.equal(stored.published.version, 1);
  });

  test('approve racing return: exactly one wins, the other gets 409', async () => {
    const pending = await seedPending();
    const results = await Promise.all([
      approve('editor1', pending._id),
      sendBack('editor1', pending._id, { note: 'fix it' }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  });

  test('submit racing autosave: a blanked body never ends up Pending', async () => {
    const draft = await Article.create({
      title: 'T', body: 'text', category: 'science', author: users.reporter1._id,
    });
    const autosave = () =>
      as('reporter1', request(app).patch(`/api/articles/${draft._id}/autosave`).send({ body: '' }));
    const submit = () => as('reporter1', request(app).post(`/api/articles/${draft._id}/submit`).send({}));
    for (let i = 0; i < 10; i += 1) {
      await Article.updateOne({ _id: draft._id }, { $set: { body: 'text', state: 'In Preparation' } });
      await Promise.all([autosave(), submit()]);
      const stored = await Article.findById(draft._id).lean();
      assert.ok(!(stored.state === 'Pending Editor Approval' && !stored.body.trim()), `iteration ${i}`);
    }
  });
});
