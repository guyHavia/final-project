import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { createUser, User } from '../models/user.model.js';
import { Article } from '../models/article.model.js';
import { ViewEvent } from '../models/viewEvent.model.js';
import { getArticleForRender } from '../services/articleQuery.service.js';

/**
 * getArticleForRender(slugOrId) - the server-render hook the `/article/:slug`
 * page calls. Tested at the service seam: it has no HTTP surface.
 */

const FIRST = new Date('2025-02-01T09:00:00.000Z');
const LATEST = new Date('2025-02-03T12:00:00.000Z');

let stopMongo;
const users = {};
const articles = {};

/** A published snapshot distinct from the working copy, so leaks are detectable. */
function publishedVersion(n) {
  return {
    title: `Approved headline ${n}`,
    abstract: `Approved abstract ${n}`,
    body: `The full approved body of story ${n}. `.repeat(50),
    image: `https://img.example/approved-${n}.jpg`,
    category: 'science',
    publishedAt: LATEST,
    version: 2,
  };
}

async function seed(fields) {
  return Article.create({
    title: 'Working title (unapproved)',
    abstract: 'Working abstract (unapproved)',
    body: 'Working body (unapproved)',
    image: 'https://img.example/working.jpg',
    category: 'politics',
    author: users.reporter._id,
    ...fields,
  });
}

before(async () => {
  stopMongo = await startMongo();
  await Article.syncIndexes();

  users.reporter = await createUser({
    username: 'rina', password: 'goodpass', role: 'reporter', displayName: 'Rina Reporter',
  });
  users.departed = await createUser({
    username: 'dana', password: 'goodpass', role: 'reporter', displayName: 'Dana Departed',
  });
  await User.updateOne({ _id: users.departed._id }, { active: false });

  const live = { firstPublishedAt: FIRST, history: [{ at: FIRST, kind: 'publish' }], viewCount: 17 };

  articles.published = await seed({ ...live, state: 'Published', slug: 'mars-rover-lands', published: publishedVersion(1) });
  articles.revisionPending = await seed({
    ...live, state: 'Pending Editor Approval', slug: 'budget-vote', published: publishedVersion(2), submittedAt: new Date(),
  });
  articles.revisionReturned = await seed({
    ...live, state: 'Returned for Corrections', slug: 'heatwave-warning', published: publishedVersion(3), editorNote: 'Add a source',
  });
  articles.draft = await seed({ state: 'In Preparation' });
  articles.freshPending = await seed({ state: 'Pending Editor Approval', submittedAt: new Date() });
  articles.byDeparted = await seed({
    ...live, state: 'Published', slug: 'old-story', published: publishedVersion(4), author: users.departed._id,
  });
  articles.byGhost = await seed({
    ...live, state: 'Published', slug: 'orphan-story', published: publishedVersion(5), author: new mongoose.Types.ObjectId(),
  });
});

after(async () => {
  await stopMongo();
});

describe('getArticleForRender', () => {
  test('returns the full published article by slug, in the feed-card shape plus body', async () => {
    const a = await getArticleForRender('mars-rover-lands');
    const expected = publishedVersion(1);

    assert.deepEqual(Object.keys(a).sort(), [
      'abstract', 'author', 'body', 'category', 'id', 'image', 'publishedAt', 'slug', 'title', 'updatedAt', 'viewCount',
    ]);
    assert.equal(a.id, String(articles.published._id));
    assert.equal(a.slug, 'mars-rover-lands');
    assert.equal(a.title, expected.title);
    assert.equal(a.abstract, expected.abstract);
    assert.equal(a.body, expected.body, 'the FULL body must be present for the server render (SEO)');
    assert.equal(a.image, expected.image);
    assert.equal(a.category, expected.category);
    assert.deepEqual(a.author, { id: String(users.reporter._id), displayName: 'Rina Reporter' });
    assert.equal(a.publishedAt.getTime(), FIRST.getTime(), 'publishedAt = first publication');
    assert.equal(a.updatedAt.getTime(), LATEST.getTime(), 'updatedAt = current version approval');
    assert.equal(a.viewCount, 17);
  });

  test('never returns the working copy, even while a revision is pending or was returned', async () => {
    for (const [slug, n] of [['budget-vote', 2], ['heatwave-warning', 3]]) {
      const a = await getArticleForRender(slug);
      assert.ok(a, `${slug} has a published version, so it must render`);
      assert.equal(a.title, publishedVersion(n).title);
      assert.equal(a.body, publishedVersion(n).body);
      assert.ok(!JSON.stringify(a).includes('unapproved'), 'no working-copy text may leak');
      assert.equal(a.state, undefined);
      assert.equal(a.editorNote, undefined);
    }
  });

  test('the slug lookup ignores letter case and surrounding spaces', async () => {
    const a = await getArticleForRender('  Mars-Rover-LANDS ');
    assert.equal(a?.id, String(articles.published._id));
  });

  test('falls back to the article id when no slug matches', async () => {
    const a = await getArticleForRender(String(articles.published._id));
    assert.equal(a?.slug, 'mars-rover-lands');
    assert.equal(a.body, publishedVersion(1).body);
  });

  test('returns null for never-published articles, by id', async () => {
    assert.equal(await getArticleForRender(String(articles.draft._id)), null);
    assert.equal(await getArticleForRender(String(articles.freshPending._id)), null);
  });

  test('returns null - never throws - for unknown or malformed input', async () => {
    for (const input of ['no-such-story', String(new mongoose.Types.ObjectId()), 'zzz', '', '   ', undefined, null, 42]) {
      assert.equal(await getArticleForRender(input), null, `expected null for ${JSON.stringify(input)}`);
    }
  });

  test('a deactivated author keeps their name; a deleted author gets a placeholder', async () => {
    const departed = await getArticleForRender('old-story');
    assert.deepEqual(departed.author, { id: String(users.departed._id), displayName: 'Dana Departed' });

    const orphan = await getArticleForRender('orphan-story');
    assert.equal(orphan.author.displayName, 'Unknown author');
    assert.equal(orphan.author.id, String(articles.byGhost.author));
  });

  test('does not count a view (the page controller calls recordView)', async () => {
    await getArticleForRender('mars-rover-lands');
    await getArticleForRender('mars-rover-lands');
    assert.equal(await ViewEvent.countDocuments(), 0);
    const stored = await Article.findById(articles.published._id).lean();
    assert.equal(stored.viewCount, 17);
  });
});
