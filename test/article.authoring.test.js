import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser } from '../models/user.model.js';
import { Article } from '../models/article.model.js';

/**
 * Reporter authoring endpoints, through the real app:
 * POST /api/articles, PATCH /api/articles/:id, PATCH /api/articles/:id/autosave,
 * POST /api/articles/:id/submit.
 */

let stopMongo;
let app;
const users = {};
const cookies = {};

const FIRST = new Date('2025-01-10T08:00:00.000Z');
const APPROVED = {
  title: 'Approved title',
  abstract: 'Approved abstract',
  body: 'Approved body',
  image: 'https://img.example/approved.jpg',
  category: 'science',
  publishedAt: FIRST,
  version: 1,
};

async function login(username) {
  const res = await request(app).post('/api/auth/login').send({ username, password: 'goodpass' });
  assert.equal(res.status, 200);
  return res.headers['set-cookie'];
}

/** Seeds an article directly in the DB. Defaults: reporter1's complete draft. */
function seed(fields = {}) {
  return Article.create({
    title: 'Draft title',
    abstract: 'Draft abstract',
    body: 'Draft body',
    category: 'politics',
    author: users.reporter1._id,
    ...fields,
  });
}

/** A Published article whose working copy equals the approved version. */
function seedPublished(fields = {}) {
  return seed({
    ...APPROVED,
    state: 'Published',
    slug: `approved-${new mongoose.Types.ObjectId()}`,
    published: APPROVED,
    firstPublishedAt: FIRST,
    history: [{ at: FIRST, kind: 'publish' }],
    ...fields,
  });
}

const as = (who, req) => (who ? req.set('Cookie', cookies[who]).set('Sec-Fetch-Site', 'same-origin') : req);
const create = (who, body) => as(who, request(app).post('/api/articles').send(body));
const edit = (who, id, body) => as(who, request(app).patch(`/api/articles/${id}`).send(body));
const autosave = (who, id, body) => as(who, request(app).patch(`/api/articles/${id}/autosave`).send(body));
const submit = (who, id) => as(who, request(app).post(`/api/articles/${id}/submit`).send({}));
const read = (who, id) => as(who, request(app).get(`/api/articles/${id}`));

before(async () => {
  stopMongo = await startMongo();
  app = createApp();
  const make = (username, role, displayName) =>
    createUser({ username, password: 'goodpass', role, displayName });
  users.reporter1 = await make('reporter1', 'reporter', 'Rina Reporter');
  users.reporter2 = await make('reporter2', 'reporter', 'Ron Reporter');
  users.editor1 = await make('editor1', 'editor', 'Eli Editor');
  cookies.reporter1 = await login('reporter1');
  cookies.reporter2 = await login('reporter2');
  cookies.editor1 = await login('editor1');
});

after(async () => {
  await stopMongo();
});

beforeEach(async () => {
  await Article.deleteMany({});
});

const VALID = { title: 'Mars rover lands', category: 'science', abstract: 'Short', body: 'Full text' };

describe('POST /api/articles - create', () => {
  test('requires a login', async () => {
    const res = await create(null, VALID);
    assert.equal(res.status, 401);
  });

  test('a reporter creates an article In Preparation, authored by the session user', async () => {
    const res = await create('reporter1', VALID);
    assert.equal(res.status, 201);
    const a = res.body.data;
    assert.equal(a.state, 'In Preparation');
    assert.equal(a.title, 'Mars rover lands');
    assert.equal(a.body, 'Full text');
    assert.equal(a.slug, null);
    assert.equal(a.published, null);
    assert.deepEqual(a.author, { id: String(users.reporter1._id), displayName: 'Rina Reporter' });

    const stored = await Article.findById(a.id).lean();
    assert.equal(String(stored.author), String(users.reporter1._id));
  });

  test('only title and category are required', async () => {
    const res = await create('reporter1', { title: 'Just a headline', category: 'world' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.body, '');
  });

  test('an editor can create too', async () => {
    assert.equal((await create('editor1', VALID)).status, 201);
  });

  test('author, state or any other unexpected field is rejected, never trusted', async () => {
    for (const extra of [
      { author: String(users.reporter2._id) },
      { state: 'Published' },
      { published: { title: 'x' } },
      { viewCount: 1000 },
    ]) {
      const res = await create('reporter1', { ...VALID, ...extra });
      assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(extra)}`);
      assert.equal(res.body.error.code, 'bad_request');
    }
    assert.equal(await Article.countDocuments(), 0);
  });

  test('a missing or blank title, or a missing or unknown category, is a 400', async () => {
    for (const body of [
      { category: 'science' },
      { title: '   ', category: 'science' },
      { title: 'x' },
      { title: 'x', category: 'cooking' },
    ]) {
      assert.equal((await create('reporter1', body)).status, 400, JSON.stringify(body));
    }
  });

  test('length limits: title 200, abstract 500, body 50,000', async () => {
    assert.equal((await create('reporter1', { ...VALID, title: 'x'.repeat(200) })).status, 201);
    assert.equal((await create('reporter1', { ...VALID, title: 'x'.repeat(201) })).status, 400);
    assert.equal((await create('reporter1', { ...VALID, abstract: 'x'.repeat(501) })).status, 400);
    assert.equal((await create('reporter1', { ...VALID, body: 'x'.repeat(50_001) })).status, 400);
  });

  test('image must be an http(s) URL (or empty) - javascript: links are refused', async () => {
    assert.equal((await create('reporter1', { ...VALID, image: 'https://img.example/a.jpg' })).status, 201);
    assert.equal((await create('reporter1', { ...VALID, image: '' })).status, 201);
    for (const image of ['javascript:alert(1)', 'data:text/html,<script>', 'not a url', 'ftp://x/y.jpg']) {
      assert.equal((await create('reporter1', { ...VALID, image })).status, 400, image);
    }
  });

  test('non-string values and a non-object body are 400s', async () => {
    assert.equal((await create('reporter1', { ...VALID, title: 42 })).status, 400);
    assert.equal((await create('reporter1', { ...VALID, body: ['a'] })).status, 400);
    const res = await as('reporter1', request(app).post('/api/articles').send([VALID]));
    assert.equal(res.status, 400);
  });
});

describe('PATCH /api/articles/:id - full edit of the working copy', () => {
  test('the owner edits their draft and gets the full article back', async () => {
    const draft = await seed();
    const res = await edit('reporter1', draft._id, { title: 'Better title', body: 'Rewritten' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.title, 'Better title');
    assert.equal(res.body.data.body, 'Rewritten');
    assert.equal(res.body.data.abstract, 'Draft abstract', 'untouched fields stay');

    const stored = await Article.findById(draft._id).lean();
    assert.equal(stored.title, 'Better title');
    assert.ok(stored.updatedAt > draft.updatedAt);
  });

  test("guests get 401; another reporter gets 403 on someone else's article", async () => {
    const draft = await seed();
    assert.equal((await edit(null, draft._id, { title: 'x' })).status, 401);
    assert.equal((await edit('reporter2', draft._id, { title: 'x' })).status, 403);
    assert.equal((await Article.findById(draft._id).lean()).title, 'Draft title');
  });

  test('a reporter cannot edit their article while it is Pending Editor Approval (409)', async () => {
    const pending = await seed({ state: 'Pending Editor Approval', submittedAt: new Date() });
    const res = await edit('reporter1', pending._id, { title: 'Sneaky change' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'conflict');
  });

  test('an editor can edit any article in any state', async () => {
    const pending = await seed({ state: 'Pending Editor Approval', submittedAt: new Date() });
    const res = await edit('editor1', pending._id, { title: 'Editor fix' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.state, 'Pending Editor Approval', 'editing never changes the state');
  });

  test('editing a Published article changes only the working copy; the public still sees the approved version', async () => {
    const live = await seedPublished();
    const res = await edit('reporter1', live._id, { title: 'Revised title', body: 'Revised body' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.state, 'Published');
    assert.equal(res.body.data.title, 'Revised title');
    assert.equal(res.body.data.published.title, 'Approved title');

    const publicView = await read(null, live._id);
    assert.equal(publicView.body.data.title, 'Approved title');
    assert.equal(publicView.body.data.body, 'Approved body');
  });

  test('editing a Returned article keeps the editor note visible', async () => {
    const returned = await seed({ state: 'Returned for Corrections', editorNote: 'Add a source' });
    const res = await edit('reporter1', returned._id, { body: 'Now with a source' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.editorNote, 'Add a source');
  });

  test('a full edit validates strictly: blank title, no fields, unknown field, bad category → 400', async () => {
    const draft = await seed();
    for (const body of [{ title: '' }, {}, { state: 'Published' }, { category: 'cooking' }]) {
      assert.equal((await edit('reporter1', draft._id, body)).status, 400, JSON.stringify(body));
    }
  });

  test('a malformed id is 400 invalid_id; an unknown id is 404', async () => {
    assert.equal((await edit('reporter1', 'nope', { title: 'x' })).body.error.code, 'invalid_id');
    assert.equal((await edit('reporter1', new mongoose.Types.ObjectId(), { title: 'x' })).status, 404);
  });
});

describe('PATCH /api/articles/:id/autosave - work persistence', () => {
  test('saves a partial update and returns only { id, savedAt }', async () => {
    const draft = await seed();
    const res = await autosave('reporter1', draft._id, { body: 'Half a sente' });
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body.data).sort(), ['id', 'savedAt']);
    assert.equal(res.body.data.id, String(draft._id));

    const stored = await Article.findById(draft._id).lean();
    assert.equal(stored.body, 'Half a sente');
    assert.equal(stored.title, 'Draft title', 'fields not sent are untouched');
    assert.equal(res.body.data.savedAt, stored.updatedAt.toISOString());
  });

  test('accepts a half-written draft: an empty title or body saves without error', async () => {
    const draft = await seed();
    assert.equal((await autosave('reporter1', draft._id, { title: '', body: '' })).status, 200);
    const stored = await Article.findById(draft._id).lean();
    assert.equal(stored.title, '');
    assert.equal(stored.body, '');
  });

  test('keeps spaces exactly as typed (no trimming mid-sentence)', async () => {
    const draft = await seed();
    await autosave('reporter1', draft._id, { body: 'Word ' });
    assert.equal((await Article.findById(draft._id).lean()).body, 'Word ');
  });

  test('the draft survives a new session, as if on another computer', async () => {
    const draft = await seed();
    await autosave('reporter1', draft._id, { title: 'Typed on laptop', body: 'Unfinished…' });

    const otherComputer = await login('reporter1');
    const res = await request(app).get(`/api/articles/${draft._id}`).set('Cookie', otherComputer);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.title, 'Typed on laptop');
    assert.equal(res.body.data.body, 'Unfinished…');
  });

  test('still rejects what is never valid: unknown fields, bad category, unsafe image, over-long text', async () => {
    const draft = await seed();
    for (const body of [
      { state: 'Published' },
      { category: 'cooking' },
      { image: 'javascript:alert(1)' },
      { body: 'x'.repeat(50_001) },
    ]) {
      assert.equal((await autosave('reporter1', draft._id, body)).status, 400, JSON.stringify(body));
    }
  });

  test('same permissions as a full edit: 401 guest, 403 non-owner, 409 own Pending, editor always', async () => {
    const draft = await seed();
    const pending = await seed({ state: 'Pending Editor Approval', submittedAt: new Date() });
    assert.equal((await autosave(null, draft._id, { body: 'x' })).status, 401);
    assert.equal((await autosave('reporter2', draft._id, { body: 'x' })).status, 403);
    assert.equal((await autosave('reporter1', pending._id, { body: 'x' })).status, 409);
    assert.equal((await autosave('editor1', pending._id, { body: 'editor tweak' })).status, 200);
  });

  test('autosaving a Published article never touches the approved version', async () => {
    const live = await seedPublished();
    await autosave('reporter1', live._id, { body: 'Draft of a revision' });
    const stored = await Article.findById(live._id).lean();
    assert.equal(stored.body, 'Draft of a revision');
    assert.equal(stored.published.body, 'Approved body');
    assert.equal(stored.state, 'Published');
  });
});

describe('POST /api/articles/:id/submit - send for approval', () => {
  test('the owner submits a complete draft: Pending Editor Approval with submittedAt', async () => {
    const draft = await seed();
    const res = await submit('reporter1', draft._id);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.state, 'Pending Editor Approval');
    assert.ok(res.body.data.submittedAt);
  });

  test('an incomplete draft is refused with 400 and stays In Preparation', async () => {
    const draft = await seed();
    await autosave('reporter1', draft._id, { title: '' });
    const res = await submit('reporter1', draft._id);
    assert.equal(res.status, 400);
    assert.equal((await Article.findById(draft._id).lean()).state, 'In Preparation');
  });

  test("401 for guests, 403 for another reporter's article", async () => {
    const draft = await seed();
    assert.equal((await submit(null, draft._id)).status, 401);
    assert.equal((await submit('reporter2', draft._id)).status, 403);
  });

  test('submitting an article that is already Pending is a 409', async () => {
    const pending = await seed({ state: 'Pending Editor Approval', submittedAt: new Date() });
    assert.equal((await submit('reporter1', pending._id)).status, 409);
  });

  test('resubmitting a Returned article clears the editor note', async () => {
    const returned = await seed({ state: 'Returned for Corrections', editorNote: 'Add a source' });
    const res = await submit('reporter1', returned._id);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.state, 'Pending Editor Approval');
    assert.equal(res.body.data.editorNote, null);
  });

  test('a revision of a Published article goes to Pending while the public keeps the approved version', async () => {
    const live = await seedPublished();
    await edit('reporter1', live._id, { body: 'Revised body' });
    const res = await submit('reporter1', live._id);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.state, 'Pending Editor Approval');
    assert.equal(res.body.data.published.body, 'Approved body');

    const publicView = await read(null, live._id);
    assert.equal(publicView.body.data.body, 'Approved body');
  });

  test('submitting a Published article with no changes is a 409', async () => {
    const live = await seedPublished();
    assert.equal((await submit('reporter1', live._id)).status, 409);
  });

  test('end to end: create → autosave → submit, after which the reporter can no longer edit', async () => {
    const created = await create('reporter1', { title: 'Breaking', category: 'world' });
    const id = created.body.data.id;
    await autosave('reporter1', id, { body: 'The full story.' });
    assert.equal((await submit('reporter1', id)).status, 200);
    assert.equal((await autosave('reporter1', id, { body: 'late change' })).status, 409);
    assert.equal((await Article.findById(id).lean()).body, 'The full story.');
  });
});
