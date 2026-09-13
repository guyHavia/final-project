import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { Article } from '../models/article.model.js';

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

  test('requires title', () => {
    const err = new Article({ ...valid(), title: undefined }).validateSync();
    assert.ok(err.errors.title);
  });

  test('requires category', () => {
    const err = new Article({ ...valid(), category: undefined }).validateSync();
    assert.ok(err.errors.category);
  });

  test('requires author', () => {
    const err = new Article({ ...valid(), author: undefined }).validateSync();
    assert.ok(err.errors.author);
  });

  test('defaults state to In Preparation when not specified', () => {
    const article = new Article(valid());
    assert.equal(article.state, 'In Preparation');
  });

  test('rejects a state outside the 4-value enum', () => {
    const err = new Article({ ...valid(), state: 'Deleted' }).validateSync();
    assert.ok(err.errors.state);
  });

  test('accepts each of the 4 exact state strings', () => {
    const states = [
      'In Preparation',
      'Pending Editor Approval',
      'Published',
      'Returned for Corrections',
    ];
    for (const state of states) {
      assert.equal(new Article({ ...valid(), state }).validateSync(), undefined);
    }
  });

  test('accepts an arbitrary category string with no enum restriction', () => {
    const err = new Article({ ...valid(), category: 'underwater-basket-weaving' }).validateSync();
    assert.equal(err, undefined);
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

  test('rejects a history kind outside publish|update', () => {
    const article = new Article(valid());
    article.history.push({ at: new Date(), kind: 'delete', by: author() });
    const err = article.validateSync();
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

  test('declares the required indexes', () => {
    const specs = Article.schema.indexes().map(([spec]) => JSON.stringify(spec));

    assert.ok(specs.includes(JSON.stringify({ author: 1, updatedAt: -1, _id: -1 })));
    assert.ok(specs.includes(JSON.stringify({ state: 1, firstPublishedAt: -1, _id: -1 })));
    assert.ok(specs.includes(JSON.stringify({ state: 1, viewCount: -1, _id: -1 })));
    assert.ok(
      specs.includes(JSON.stringify({ state: 1, category: 1, firstPublishedAt: -1, _id: -1 })),
    );
    assert.ok(specs.includes(JSON.stringify({ title: 'text' })));
  });
});
