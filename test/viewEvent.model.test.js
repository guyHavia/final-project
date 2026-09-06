import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { ViewEvent } from '../models/viewEvent.model.js';
import { recordView } from '../services/stats.service.js';
import { logger } from '../lib/logger.js';

let mongod;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await ViewEvent.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
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

  test('a bad id resolves without throwing, records nothing, logs the failure', async () => {
    const calls = [];
    const original = logger.error;
    logger.error = (event, meta) => calls.push({ event, meta });

    try {
      const result = await recordView('not-a-valid-object-id');
      assert.equal(result, undefined);
    } finally {
      logger.error = original;
    }

    assert.equal(await ViewEvent.countDocuments(), 0);
    assert.ok(calls.some((c) => c.event === 'stats.record_failed'));
  });
});
