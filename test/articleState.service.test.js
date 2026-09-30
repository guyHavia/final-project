import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { applyTransition, slugify, saveWithSlugRetry } from '../services/articleState.service.js';
import { AppError } from '../lib/AppError.js';
import { Article } from '../models/article.model.js';
import { startMongo } from './support/mongo.js';

/** Minimal fixture shaped like an Article doc — see P2-02 spec. */
function makeArticle(overrides = {}) {
  return {
    state: 'In Preparation',
    author: 'reporter-1',
    title: 'A title',
    abstract: 'abs',
    body: 'body text',
    category: 'News',
    image: undefined,
    published: null,
    firstPublishedAt: undefined,
    editorNote: undefined,
    submittedAt: undefined,
    history: [],
    slug: undefined,
    ...overrides,
  };
}

const reporter = (id = 'reporter-1') => ({ id, role: 'reporter' });
const editor = (id = 'editor-1') => ({ id, role: 'editor' });

/** Builds a `published` snapshot matching an article's current working fields. */
function publishedFrom(article, overrides = {}) {
  return {
    title: article.title,
    abstract: article.abstract,
    body: article.body,
    image: article.image,
    category: article.category,
    publishedAt: new Date('2024-01-01T00:00:00Z'),
    version: 1,
    ...overrides,
  };
}

function assertAppError(fn, code) {
  assert.throws(fn, (err) => err instanceof AppError && err.code === code);
}

describe('articleState.service', () => {
  describe('legal transitions', () => {
    test('In Preparation -> Pending Editor Approval by the owner', () => {
      const article = makeArticle();
      const result = applyTransition(article, 'Pending Editor Approval', reporter());
      assert.equal(result, article);
      assert.equal(article.state, 'Pending Editor Approval');
      assert.ok(article.submittedAt instanceof Date);
      assert.equal(article.editorNote, undefined);
    });

    test('In Preparation -> Pending Editor Approval by any editor, even a non-owner', () => {
      const article = makeArticle({ author: 'reporter-1' });
      applyTransition(article, 'Pending Editor Approval', editor('editor-9'));
      assert.equal(article.state, 'Pending Editor Approval');
    });

    test('In Preparation -> Pending Editor Approval clears a stale editorNote', () => {
      const article = makeArticle({ editorNote: 'leftover note' });
      applyTransition(article, 'Pending Editor Approval', reporter());
      assert.equal(article.editorNote, undefined);
    });

    test('Returned for Corrections -> Pending Editor Approval clears editorNote and sets submittedAt', () => {
      const article = makeArticle({ state: 'Returned for Corrections', editorNote: 'fix typo' });
      applyTransition(article, 'Pending Editor Approval', reporter());
      assert.equal(article.state, 'Pending Editor Approval');
      assert.equal(article.editorNote, undefined);
      assert.ok(article.submittedAt instanceof Date);
    });

    test('Published -> Pending Editor Approval (shadow submit) when the working copy differs', () => {
      const publishedSnapshot = publishedFrom(makeArticle());
      const article = makeArticle({
        state: 'Published',
        title: 'A changed title',
        published: publishedSnapshot,
        firstPublishedAt: new Date('2024-01-01T00:00:00Z'),
      });
      const publishedBefore = article.published;
      applyTransition(article, 'Pending Editor Approval', reporter());
      assert.equal(article.state, 'Pending Editor Approval');
      assert.equal(article.published, publishedBefore);
      assert.deepEqual(article.published, publishedSnapshot);
      assert.ok(article.submittedAt instanceof Date);
    });

    test('Pending Editor Approval -> Published: first approval sets version 1, firstPublishedAt, slug, and a "publish" history entry', () => {
      const article = makeArticle({
        state: 'Pending Editor Approval',
        title: 'My Great Article!',
        submittedAt: new Date(),
      });
      applyTransition(article, 'Published', editor('editor-1'));
      assert.equal(article.state, 'Published');
      assert.equal(article.published.title, 'My Great Article!');
      assert.equal(article.published.abstract, article.abstract);
      assert.equal(article.published.body, article.body);
      assert.equal(article.published.image, article.image);
      assert.equal(article.published.category, article.category);
      assert.equal(article.published.version, 1);
      assert.ok(article.published.publishedAt instanceof Date);
      assert.ok(article.firstPublishedAt instanceof Date);
      assert.equal(article.slug, 'my-great-article');
      assert.equal(article.history.length, 1);
      assert.equal(article.history[0].kind, 'publish');
      assert.equal(article.history[0].by, 'editor-1');
      assert.equal(article.submittedAt, undefined);
    });

    test('Pending Editor Approval -> Published: a title that slugifies to \'\' (all punctuation) falls back to a non-empty base slug', () => {
      const article = makeArticle({
        state: 'Pending Editor Approval',
        title: '!!!',
        submittedAt: new Date(),
      });
      applyTransition(article, 'Published', editor('editor-1'));
      assert.equal(article.state, 'Published');
      assert.notEqual(article.slug, '');
      assert.ok(article.slug, 'slug must be a non-empty fallback, not left blank');
    });

    test('Pending Editor Approval -> Published: a Hebrew title gets a readable unicode slug, not article-<id>', () => {
      const article = makeArticle({ state: 'Pending Editor Approval', title: 'חדשות מהעולם: הבחירות 2025!', submittedAt: new Date() });
      applyTransition(article, 'Published', editor('editor-1'));
      assert.equal(article.slug, 'חדשות-מהעולם-הבחירות-2025');
    });

    test('Pending Editor Approval -> Published: a later approval increments version, keeps firstPublishedAt/slug, and pushes "update"', () => {
      const firstPublishedAt = new Date('2024-01-01T00:00:00Z');
      const article = makeArticle({
        state: 'Pending Editor Approval',
        title: 'Second Pass',
        slug: 'my-great-article',
        firstPublishedAt,
        published: {
          title: 'My Great Article!',
          abstract: 'abs',
          body: 'body text',
          image: undefined,
          category: 'News',
          publishedAt: firstPublishedAt,
          version: 1,
        },
        history: [{ at: firstPublishedAt, kind: 'publish', by: 'editor-1' }],
      });
      applyTransition(article, 'Published', editor('editor-2'));
      assert.equal(article.published.title, 'Second Pass');
      assert.equal(article.published.version, 2);
      assert.equal(article.firstPublishedAt, firstPublishedAt);
      assert.equal(article.slug, 'my-great-article');
      assert.equal(article.history.length, 2);
      assert.equal(article.history[0].kind, 'publish');
      assert.equal(article.history[1].kind, 'update');
      assert.equal(article.history[1].by, 'editor-2');
    });

    test('Pending Editor Approval -> Returned for Corrections sets editorNote and clears submittedAt', () => {
      const article = makeArticle({ state: 'Pending Editor Approval', submittedAt: new Date() });
      applyTransition(article, 'Returned for Corrections', editor(), { note: 'fix the intro' });
      assert.equal(article.state, 'Returned for Corrections');
      assert.equal(article.editorNote, 'fix the intro');
      assert.equal(article.submittedAt, undefined);
    });
  });

  describe('shadow-submit guard', () => {
    test('throws conflict("no changes to submit") when the working copy is identical to published', () => {
      const publishedSnapshot = publishedFrom(makeArticle());
      const article = makeArticle({
        state: 'Published',
        published: publishedSnapshot,
        firstPublishedAt: new Date('2024-01-01T00:00:00Z'),
      });
      const before = structuredClone(article);
      let caught;
      try {
        applyTransition(article, 'Pending Editor Approval', reporter());
      } catch (err) {
        caught = err;
      }
      assert.ok(caught instanceof AppError);
      assert.equal(caught.code, 'conflict');
      assert.equal(caught.message, 'no changes to submit');
      assert.deepEqual(article, before);
    });
  });

  describe('illegal transitions leave the document unmutated', () => {
    const cases = [
      ['In Preparation', 'Published'],
      ['In Preparation', 'Returned for Corrections'],
      ['Pending Editor Approval', 'In Preparation'],
      ['Published', 'In Preparation'],
      ['Published', 'Returned for Corrections'],
      ['Returned for Corrections', 'Published'],
      ['Returned for Corrections', 'In Preparation'],
      ['In Preparation', 'In Preparation'],
      ['Pending Editor Approval', 'Pending Editor Approval'],
      ['Published', 'Published'],
      ['Returned for Corrections', 'Returned for Corrections'],
    ];

    for (const [from, to] of cases) {
      test(`${from} -> ${to} throws conflict and does not mutate`, () => {
        const article = makeArticle({
          state: from,
          published: from === 'Published' ? publishedFrom(makeArticle()) : null,
          firstPublishedAt: from === 'Published' ? new Date('2024-01-01T00:00:00Z') : undefined,
        });
        const before = structuredClone(article);
        assertAppError(() => applyTransition(article, to, editor()), 'conflict');
        assert.deepEqual(article, before);
      });
    }

    test('a reporter attempting Pending Editor Approval -> Published gets forbidden, not conflict', () => {
      const article = makeArticle({ state: 'Pending Editor Approval' });
      const before = structuredClone(article);
      assertAppError(() => applyTransition(article, 'Published', reporter()), 'forbidden');
      assert.deepEqual(article, before);
    });

    test("a reporter transitioning another reporter's article gets forbidden", () => {
      const article = makeArticle({ state: 'In Preparation', author: 'reporter-2' });
      const before = structuredClone(article);
      assertAppError(
        () => applyTransition(article, 'Pending Editor Approval', reporter('reporter-1')),
        'forbidden',
      );
      assert.deepEqual(article, before);
    });

    test('a non-editor attempting return gets forbidden', () => {
      const article = makeArticle({ state: 'Pending Editor Approval' });
      const before = structuredClone(article);
      assertAppError(
        () => applyTransition(article, 'Returned for Corrections', reporter(), { note: 'x' }),
        'forbidden',
      );
      assert.deepEqual(article, before);
    });

    test('an editor CAN transition any article regardless of ownership', () => {
      const article = makeArticle({ state: 'In Preparation', author: 'reporter-99' });
      applyTransition(article, 'Pending Editor Approval', editor('editor-1'));
      assert.equal(article.state, 'Pending Editor Approval');
    });
  });

  describe('content and note guards', () => {
    for (const field of ['title', 'body', 'category']) {
      test(`submit with a blank "${field}" throws badRequest and does not mutate`, () => {
        const article = makeArticle({ [field]: '   ' });
        const before = structuredClone(article);
        assertAppError(() => applyTransition(article, 'Pending Editor Approval', reporter()), 'bad_request');
        assert.deepEqual(article, before);
      });
    }

    test('return with a blank note throws badRequest("a note is required")', () => {
      const article = makeArticle({ state: 'Pending Editor Approval' });
      const before = structuredClone(article);
      let caught;
      try {
        applyTransition(article, 'Returned for Corrections', editor(), { note: '   ' });
      } catch (err) {
        caught = err;
      }
      assert.ok(caught instanceof AppError);
      assert.equal(caught.code, 'bad_request');
      assert.equal(caught.message, 'a note is required');
      assert.deepEqual(article, before);
    });

    test('return with no options at all throws badRequest', () => {
      const article = makeArticle({ state: 'Pending Editor Approval' });
      assertAppError(() => applyTransition(article, 'Returned for Corrections', editor()), 'bad_request');
    });

    test('return with a real note succeeds', () => {
      const article = makeArticle({ state: 'Pending Editor Approval' });
      applyTransition(article, 'Returned for Corrections', editor(), { note: 'please fix the lede' });
      assert.equal(article.state, 'Returned for Corrections');
      assert.equal(article.editorNote, 'please fix the lede');
    });
  });

  describe('content guard on every submit and on approve', () => {
    for (const field of ['title', 'body', 'category']) {
      test(`shadow submit of a Published article with a blank "${field}" throws badRequest and does not mutate`, () => {
        const original = makeArticle();
        const article = makeArticle({
          state: 'Published',
          published: publishedFrom(original),
          firstPublishedAt: new Date('2024-01-01T00:00:00Z'),
          [field]: '   ',
        });
        const before = structuredClone(article);
        assertAppError(() => applyTransition(article, 'Pending Editor Approval', reporter()), 'bad_request');
        assert.deepEqual(article, before);
      });

      test(`approve with a blank "${field}" throws badRequest and does not mutate`, () => {
        const article = makeArticle({ state: 'Pending Editor Approval', submittedAt: new Date(), [field]: '' });
        const before = structuredClone(article);
        assertAppError(() => applyTransition(article, 'Published', editor()), 'bad_request');
        assert.deepEqual(article, before);
      });
    }
  });

  describe('ownership with a populated author', () => {
    const populatedAuthor = (id) => ({ _id: id, displayName: 'Rina Reporter' });

    test('the owner can submit when article.author is a populated User object', () => {
      const article = makeArticle({ author: populatedAuthor('reporter-1') });
      applyTransition(article, 'Pending Editor Approval', reporter('reporter-1'));
      assert.equal(article.state, 'Pending Editor Approval');
    });

    test('a different reporter is still forbidden when article.author is populated', () => {
      const article = makeArticle({ author: populatedAuthor('reporter-1') });
      assertAppError(() => applyTransition(article, 'Pending Editor Approval', reporter('reporter-2')), 'forbidden');
    });
  });

  describe('slugify', () => {
    test('keeps letters and digits of any script, drops punctuation, stays lowercase and dash-separated', () => {
      assert.equal(slugify('  שלום, עולם!! '), 'שלום-עולם');
      assert.equal(slugify('Привет Мир'), 'привет-мир');
      assert.equal(slugify('Über 5 café'), 'über-5-café');
    });

    test('never emits characters that break a URL path or mongo key', () => {
      const slug = slugify('a/b?c#d%e\\f g<h>"i');
      assert.match(slug, /^[\p{L}\p{N}]+(-[\p{L}\p{N}]+)*$/u);
    });

    test('a title with no letters or digits still slugifies to empty (caller falls back)', () => {
      assert.equal(slugify('!!! ???'), '');
    });

    test('lowercases, trims, and collapses non-alphanumeric runs to a single dash', () => {
      assert.equal(slugify('  My Great Article!! '), 'my-great-article');
      assert.equal(slugify('Already-slugged'), 'already-slugged');
      assert.equal(slugify('Foo   Bar___Baz'), 'foo-bar-baz');
    });
  });

  describe('saveWithSlugRetry', () => {
    /** Builds a duplicate-key error shaped like the one Mongo/Mongoose raises on a violated unique index. */
    function slugDuplicateKeyError(slug) {
      const err = new Error(
        `E11000 duplicate key error collection: test.articles index: slug_1 dup key: { slug: "${slug}" }`,
      );
      err.code = 11000;
      err.keyPattern = { slug: 1 };
      err.keyValue = { slug };
      return err;
    }

    test('retries with an incrementing numeric suffix on a slug conflict, then succeeds', async () => {
      const article = { slug: 'same-headline' };
      const slugsAttempted = [];
      let attempts = 0;
      article.save = async () => {
        attempts += 1;
        slugsAttempted.push(article.slug);
        if (attempts < 3) throw slugDuplicateKeyError(article.slug);
        return article;
      };

      const result = await saveWithSlugRetry(article);

      assert.equal(result, article);
      assert.deepEqual(slugsAttempted, ['same-headline', 'same-headline-2', 'same-headline-3']);
      assert.equal(article.slug, 'same-headline-3');
    });

    test('succeeds on the first attempt when there is no conflict', async () => {
      const article = { slug: 'unique-title' };
      article.save = async () => article;
      await saveWithSlugRetry(article);
      assert.equal(article.slug, 'unique-title');
    });

    test('rethrows a duplicate-key error on a different field without touching slug', async () => {
      const article = { slug: 'same-headline' };
      article.save = async () => {
        const err = new Error('E11000 duplicate key error on author');
        err.code = 11000;
        err.keyPattern = { author: 1 };
        err.keyValue = { author: 'x' };
        throw err;
      };

      await assert.rejects(() => saveWithSlugRetry(article), (err) => err.code === 11000);
      assert.equal(article.slug, 'same-headline');
    });

    test('rethrows a non-duplicate-key error unchanged', async () => {
      const article = { slug: 'same-headline' };
      const boom = new Error('connection lost');
      article.save = async () => {
        throw boom;
      };

      await assert.rejects(() => saveWithSlugRetry(article), (err) => err === boom);
    });
  });

  describe('publish slug collisions (real Article model + Mongo)', () => {
    let stopMongo;

    before(async () => {
      stopMongo = await startMongo();
      await Article.syncIndexes();
    });

    after(async () => {
      await stopMongo();
    });

    afterEach(async () => {
      await Article.deleteMany({});
    });

    /** Creates and persists a Pending-Editor-Approval article ready to be published. */
    async function makePendingArticle(title) {
      return Article.create({
        category: 'politics',
        author: new mongoose.Types.ObjectId(),
        title,
        body: 'body text',
        state: 'Pending Editor Approval',
        submittedAt: new Date(),
      });
    }

    const publish = (article) =>
      applyTransition(article, 'Published', { id: new mongoose.Types.ObjectId(), role: 'editor' });

    test('two articles publishing with the same title get "same-headline" then "same-headline-2", not a duplicate-key crash', async () => {
      const articleA = await makePendingArticle('Same Headline');
      const articleB = await makePendingArticle('Same Headline');

      publish(articleA);
      await saveWithSlugRetry(articleA);
      assert.equal(articleA.slug, 'same-headline');

      publish(articleB);
      await saveWithSlugRetry(articleB);
      assert.equal(articleB.slug, 'same-headline-2');

      const fetchedA = await Article.findById(articleA._id);
      const fetchedB = await Article.findById(articleB._id);
      assert.equal(fetchedA.slug, 'same-headline');
      assert.equal(fetchedB.slug, 'same-headline-2');
    });

    test('a third same-title article continues the suffix to "same-headline-3"', async () => {
      const articleA = await makePendingArticle('Same Headline');
      const articleB = await makePendingArticle('Same Headline');
      const articleC = await makePendingArticle('Same Headline');

      for (const article of [articleA, articleB, articleC]) {
        publish(article);
        await saveWithSlugRetry(article);
      }

      assert.equal(articleA.slug, 'same-headline');
      assert.equal(articleB.slug, 'same-headline-2');
      assert.equal(articleC.slug, 'same-headline-3');
    });

    test('titles that slugify to \'\' fall back to an id-based slug, so they never collide', async () => {
      const articleA = await makePendingArticle('!!!');
      const articleB = await makePendingArticle('???');

      publish(articleA);
      await saveWithSlugRetry(articleA);
      publish(articleB);
      await saveWithSlugRetry(articleB);

      assert.equal(articleA.slug, `article-${articleA._id}`);
      assert.equal(articleB.slug, `article-${articleB._id}`);
    });

    test('60 symbol-only titles all publish (no retry-limit crash on a shared fallback slug)', async () => {
      const slugs = new Set();
      for (let i = 0; i < 60; i += 1) {
        const article = await makePendingArticle('!!! ???');
        publish(article);
        await saveWithSlugRetry(article);
        slugs.add(article.slug);
      }
      assert.equal(slugs.size, 60);
    });

    test('same-title Hebrew articles get the readable slug plus the collision suffix', async () => {
      const articleA = await makePendingArticle('כותרת בעברית');
      const articleB = await makePendingArticle('כותרת בעברית');
      for (const article of [articleA, articleB]) {
        publish(article);
        await saveWithSlugRetry(article);
      }
      assert.equal(articleA.slug, 'כותרת-בעברית');
      assert.equal(articleB.slug, 'כותרת-בעברית-2');
    });
  });
});
