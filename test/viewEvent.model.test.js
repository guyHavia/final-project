import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { ViewEvent } from '../models/viewEvent.model.js';
import { recordView } from '../services/stats.service.js';

let stopMongo;

before(async () => {
  stopMongo = await startMongo();
  await ViewEvent.syncIndexes();
});

after(async () => {
  await stopMongo();
});

afterEach(async () => {
  await ViewEvent.deleteMany({});
});

describe('ViewEvent model', () => {
  test('declares the { article: 1, at: 1 } compound index', () => {
    const specs = ViewEvent.schema.indexes().map(([spec]) => JSON.stringify(spec));
    assert.ok(specs.includes(JSON.stringify({ article: 1, at: 1 })));
  });

  test('CRUD sanity: create, find by article, delete', async () => {
    const article = new mongoose.Types.ObjectId();
    const doc = await ViewEvent.create({ article });

    const found = await ViewEvent.find({ article });
    assert.equal(found.length, 1);
    assert.equal(found[0].id, doc.id);
    assert.ok(found[0].at instanceof Date);

    await ViewEvent.deleteOne({ _id: doc._id });
    assert.equal(await ViewEvent.countDocuments({ article }), 0);
  });
});

describe('recordView', () => {
  test('inserts exactly one event for the article, timestamped ~now', async () => {
    const article = new mongoose.Types.ObjectId();
    const start = Date.now();

    await recordView(article);

    const events = await ViewEvent.find({ article });
    assert.equal(events.length, 1);
    assert.ok(events[0].at.getTime() >= start - 1000);
    assert.ok(events[0].at.getTime() <= Date.now() + 1000);
  });

  test('a bad id resolves without throwing and records nothing', async () => {
    const result = await recordView('not-a-valid-object-id');

    assert.equal(result, undefined);
    assert.equal(await ViewEvent.countDocuments(), 0);
  });
});
