import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { validationError } from './support/validation.js';
import { Article, CATEGORIES } from '../models/article.model.js';

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

describe('Article model', () => {
  const author = () => new mongoose.Types.ObjectId();

  const valid = () => ({
    category: 'politics',
    author: author(),
    title: 'A headline',
  });

  test('title is optional at the model level so autosave can store a half-written draft', async () => {
    // A title is still required on create, full edit and submit - enforced by
    // articleAuthoring.service.js and the state machine, not the schema.
    const err = await validationError(new Article({ ...valid(), title: '' }));
    assert.equal(err?.errors?.title, undefined);
  });

  test('requires category', async () => {
    const err = await validationError(new Article({ ...valid(), category: undefined }));
    assert.ok(err.errors.category);
  });

  test('requires author', async () => {
    const err = await validationError(new Article({ ...valid(), author: undefined }));
    assert.ok(err.errors.author);
  });

  test('defaults state to In Preparation when not specified', () => {
    const article = new Article(valid());
    assert.equal(article.state, 'In Preparation');
  });

  test('rejects a state outside the 4-value enum', async () => {
    const err = await validationError(new Article({ ...valid(), state: 'Deleted' }));
    assert.ok(err.errors.state);
  });

  test('accepts each of the 4 exact state strings', async () => {
    const states = [
      'In Preparation',
      'Pending Editor Approval',
      'Published',
      'Returned for Corrections',
    ];
    for (const state of states) {
      assert.equal(await validationError(new Article({ ...valid(), state })), undefined);
    }
  });

  test('rejects a category outside the shared CATEGORIES list', async () => {
    const err = await validationError(new Article({ ...valid(), category: 'underwater-basket-weaving' }));
    assert.ok(err.errors.category);
  });

  test('accepts each of the agreed CATEGORIES values', async () => {
    for (const category of CATEGORIES) {
      assert.equal(await validationError(new Article({ ...valid(), category })), undefined);
    }
  });

  test('published defaults to unset, and an article saves fine without it', async () => {
    const article = await Article.create(valid());
    assert.equal(article.published, null);

    const fetched = await Article.findById(article._id);
    assert.equal(fetched.published, null);
  });

  test('setting published persists and round-trips on re-fetch', async () => {
    const publishedAt = new Date();
    const article = await Article.create({
      ...valid(),
      published: {
        title: 'Published title',
        abstract: 'Published abstract',
        body: 'Published body',
        image: 'https://example.com/image.jpg',
        category: 'politics',
        publishedAt,
        version: 1,
      },
    });

    const fetched = await Article.findById(article._id);
    assert.equal(fetched.published.title, 'Published title');
    assert.equal(fetched.published.abstract, 'Published abstract');
    assert.equal(fetched.published.body, 'Published body');
    assert.equal(fetched.published.image, 'https://example.com/image.jpg');
    assert.equal(fetched.published.category, 'politics');
    assert.equal(fetched.published.publishedAt.getTime(), publishedAt.getTime());
    assert.equal(fetched.published.version, 1);
  });

  test('history defaults to an empty array', () => {
    const article = new Article(valid());
    assert.deepEqual(article.history, []);
  });

  test('pushing publish and update history entries persists both in order', async () => {
    const by = author();
    const at1 = new Date('2024-01-01T00:00:00Z');
    const at2 = new Date('2024-02-01T00:00:00Z');

    const article = await Article.create(valid());
    article.history.push({ at: at1, kind: 'publish', by });
    article.history.push({ at: at2, kind: 'update', by });
    await article.save();

    const fetched = await Article.findById(article._id);
    assert.equal(fetched.history.length, 2);
    assert.equal(fetched.history[0].kind, 'publish');
    assert.equal(fetched.history[0].at.getTime(), at1.getTime());
    assert.equal(fetched.history[0].by.toString(), by.toString());
    assert.equal(fetched.history[1].kind, 'update');
    assert.equal(fetched.history[1].at.getTime(), at2.getTime());
    assert.equal(fetched.history[1].by.toString(), by.toString());
  });

  test('rejects a history kind outside publish|update', async () => {
    const article = new Article(valid());
    article.history.push({ at: new Date(), kind: 'delete', by: author() });
    const err = await validationError(article);
    assert.ok(err.errors['history.0.kind']);
  });

  test('viewCount defaults to 0', () => {
    const article = new Article(valid());
    assert.equal(article.viewCount, 0);
  });

  test('sets createdAt and updatedAt on save', async () => {
    const article = await Article.create(valid());
    assert.ok(article.createdAt instanceof Date);
    assert.ok(article.updatedAt instanceof Date);
  });

  test('CRUD sanity: create, find by author, find by state, delete', async () => {
    const authorId = author();
    const doc = await Article.create({ ...valid(), author: authorId });

    const byAuthor = await Article.find({ author: authorId });
    assert.equal(byAuthor.length, 1);
    assert.equal(byAuthor[0].id, doc.id);

    const byState = await Article.find({ state: 'In Preparation' });
    assert.equal(byState.length, 1);
    assert.equal(byState[0].id, doc.id);

    await Article.deleteOne({ _id: doc._id });
    assert.equal(await Article.countDocuments({ _id: doc._id }), 0);
  });

  test('declares one index per list the app serves, and no unused ones', () => {
    const byName = Object.fromEntries(
      Article.schema.indexes().map(([spec, options]) => [options.name, { spec, options }]),
    );
    const publicOnly = { firstPublishedAt: { $type: 'date' } };

    assert.deepEqual(byName.mine_by_updated.spec, { author: 1, updatedAt: -1, _id: -1 });
    assert.deepEqual(byName.newsroom_by_state.spec, { state: 1, updatedAt: -1, _id: -1 });
    assert.deepEqual(byName.newsroom_all.spec, { updatedAt: -1, _id: -1 });
    assert.deepEqual(byName.public_by_date.spec, { firstPublishedAt: -1, _id: -1 });
    assert.deepEqual(byName.public_by_popularity.spec, { viewCount: -1, _id: -1 });
    assert.deepEqual(byName.public_by_category_date.spec, {
      'published.category': 1,
      firstPublishedAt: -1,
      _id: -1,
    });
    for (const name of ['public_by_date', 'public_by_popularity', 'public_by_category_date']) {
      assert.deepEqual(byName[name].options.partialFilterExpression, publicOnly, name);
    }

    // The six above plus the unique slug index (declared on the field); nothing else.
    assert.equal(Article.schema.indexes().length, 7);
    assert.equal(Article.schema.path('slug').options.unique, true);
    for (const field of ['author', 'state', 'viewCount']) {
      assert.ok(!Article.schema.path(field).options.index, `${field} must not have a single-field index`);
    }
  });
});
