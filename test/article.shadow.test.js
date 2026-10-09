import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser } from '../models/user.model.js';
import { Article } from '../models/article.model.js';
import { getArticleForRender } from '../services/articleQuery.service.js';

/**
 * Published-version shadowing, end to end through the real endpoints.
 * While a Published article is revised, submitted, or returned, every public
 * view keeps showing the last approved version; only an editor's approval
 * switches it. Each step checks all three public views at once: the JSON API,
 * the feed card, and the server-render hook.
 */

let stopMongo;
let app;
const users = {};
const cookies = {};

async function login(username) {
  const res = await request(app).post('/api/auth/login').send({ username, password: 'goodpass' });
  assert.equal(res.status, 200);
  return res.headers['set-cookie'];
}

/** Calls `/api/articles<path>` as `who` (null = guest) and returns `data`, asserting the status. */
async function call(who, method, path, body, expected = 200) {
  const req = request(app)[method](`/api/articles${path}`);
  if (who) req.set('Cookie', cookies[who]).set('Sec-Fetch-Site', 'same-origin');
  const res = await req.send(body ?? {});
  assert.equal(res.status, expected, `${method.toUpperCase()} ${path}: ${JSON.stringify(res.body)}`);
  return res.body.data;
}

/** Asserts that the JSON API, the feed card and the render hook all show `title` / `body`. */
async function assertPublicShows(id, slug, { title, body }) {
  const api = await call(null, 'get', `/${id}`);
  assert.equal(api.title, title, 'public JSON title');
  assert.equal(api.body, body, 'public JSON body');

  const feed = await call(null, 'get', '?limit=50');
  const card = feed.items.find((c) => c.id === id);
  assert.ok(card, 'the article is in the public feed');
  assert.equal(card.title, title, 'feed card title');

  const rendered = await getArticleForRender(slug);
  assert.equal(rendered?.title, title, 'rendered title');
  assert.equal(rendered.body, body, 'rendered body');
}

/** Creates, submits and approves an article of reporter1's; returns the published article. */
async function publishNew(fields) {
  const created = await call('reporter1', 'post', '', { category: 'world', ...fields }, 201);
  await call('reporter1', 'post', `/${created.id}/submit`);
  return call('editor1', 'post', `/${created.id}/approve`);
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 5));

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
  await Article.deleteMany({});
});

const V1 = { title: 'Heatwave', body: 'It is hot.' };
const V2 = { title: 'Heatwave breaks record', body: 'It is 41°C, a record.' };

describe('published-version shadowing', () => {
  test('revise → submit → approve: the public sees v1 until the approval, then v2 everywhere', async () => {
    const v1 = await publishNew(V1);
    const { id, slug } = v1;
    assert.equal(slug, 'heatwave');
    await assertPublicShows(id, slug, V1);

    // 1. The reporter revises the live article (full edit, then autosave).
    await call('reporter1', 'patch', `/${id}`, { title: V2.title });
    await call('reporter1', 'patch', `/${id}/autosave`, { body: V2.body });
    await assertPublicShows(id, slug, V1);

    const owner = await call('reporter1', 'get', `/${id}`);
    assert.equal(owner.state, 'Published');
    assert.equal(owner.title, V2.title, 'the owner sees their working copy');
    assert.equal(owner.published.title, V1.title, '…next to the approved version');

    // 2. Submitted for review: still v1 in public; the editor gets both versions to compare.
    const submitted = await call('reporter1', 'post', `/${id}/submit`);
    assert.equal(submitted.state, 'Pending Editor Approval');
    await assertPublicShows(id, slug, V1);

    const review = await call('editor1', 'get', `/${id}`);
    assert.equal(review.body, V2.body);
    assert.equal(review.published.body, V1.body);

    // 3. Approved: every public view switches to v2 at once.
    await pause();
    const approved = await call('editor1', 'post', `/${id}/approve`);
    await assertPublicShows(id, slug, V2);

    assert.equal(approved.slug, 'heatwave', 'the URL does not change with the new title');
    assert.equal(approved.published.version, 2);
    assert.deepEqual(approved.history.map((h) => h.kind), ['publish', 'update']);
    assert.equal(approved.firstPublishedAt, v1.firstPublishedAt, '"published on" date is unchanged');
    assert.ok(new Date(approved.published.publishedAt) > new Date(v1.published.publishedAt), 'version date advanced');
  });

  test('revise → submit → return with a note: v1 stays public, both sides see the note, then the fix goes live', async () => {
    const { id, slug } = await publishNew(V1);
    await call('reporter1', 'patch', `/${id}`, V2);
    await call('reporter1', 'post', `/${id}/submit`);

    const returned = await call('editor1', 'post', `/${id}/return`, { note: 'Cite the weather service' });
    assert.equal(returned.state, 'Returned for Corrections');
    await assertPublicShows(id, slug, V1);

    assert.equal((await call('reporter1', 'get', `/${id}`)).editorNote, 'Cite the weather service');
    assert.equal((await call('editor1', 'get', `/${id}`)).editorNote, 'Cite the weather service');
    const mine = await call('reporter1', 'get', '/mine');
    assert.equal(mine.items.find((a) => a.id === id).editorNote, 'Cite the weather service');

    const V3 = { title: V2.title, body: 'It is 41°C, a record, says the weather service.' };
    await call('reporter1', 'patch', `/${id}`, { body: V3.body });
    await call('reporter1', 'post', `/${id}/submit`);
    await assertPublicShows(id, slug, V1);
    await call('editor1', 'post', `/${id}/approve`);
    await assertPublicShows(id, slug, V3);
  });

  test('an editor can revise a live article alone: edit → submit → approve', async () => {
    const { id, slug } = await publishNew(V1);
    await call('editor1', 'patch', `/${id}`, { body: 'It is hot (corrected by the desk).' });
    await assertPublicShows(id, slug, V1);

    await call('editor1', 'post', `/${id}/submit`);
    const approved = await call('editor1', 'post', `/${id}/approve`);
    await assertPublicShows(id, slug, { title: V1.title, body: 'It is hot (corrected by the desk).' });
    assert.deepEqual(approved.history.map((h) => h.kind), ['publish', 'update']);
    assert.equal(approved.author.id, String(users.reporter1._id), 'the byline stays the reporter');
  });
});

describe('hasUnsubmittedChanges', () => {
  const flagIn = async (id) => {
    const full = (await call('reporter1', 'get', `/${id}`)).hasUnsubmittedChanges;
    const mine = (await call('reporter1', 'get', '/mine')).items.find((a) => a.id === id).hasUnsubmittedChanges;
    const desk = (await call('editor1', 'get', '?state=all')).items.find((a) => a.id === id).hasUnsubmittedChanges;
    assert.equal(full, mine, 'article and my-list agree');
    assert.equal(full, desk, 'article and newsroom list agree');
    return full;
  };

  test('true only while a Published article has edits that were not sent for review', async () => {
    const { id } = await publishNew(V1);
    assert.equal(await flagIn(id), false, 'freshly published');

    await call('reporter1', 'patch', `/${id}/autosave`, { body: 'changed' });
    assert.equal(await flagIn(id), true, 'edited, not submitted');

    await call('reporter1', 'patch', `/${id}/autosave`, { body: V1.body });
    assert.equal(await flagIn(id), false, 'edit reverted to the approved text');

    await call('reporter1', 'patch', `/${id}`, { body: 'changed again' });
    await call('reporter1', 'post', `/${id}/submit`);
    assert.equal(await flagIn(id), false, 'submitted: it is now waiting for review, not unsent');
  });

  test('false for articles that were never published', async () => {
    const draft = await call('reporter1', 'post', '', { title: 'Draft', category: 'world', body: 'x' }, 201);
    assert.equal(draft.hasUnsubmittedChanges, false);
    assert.equal(await flagIn(draft.id), false);
  });
});
