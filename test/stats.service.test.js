import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { ViewEvent } from '../models/viewEvent.model.js';
import { getSeries } from '../services/stats.service.js';

let stopMongo;

before(async () => {
  stopMongo = await startMongo();
});

after(async () => {
  await stopMongo();
});

afterEach(async () => {
  await ViewEvent.deleteMany({});
});

describe('stats.service getSeries', () => {
  test('buckets events by hour, filling the zero-event gap hour with count: 0', async () => {
    const article = new mongoose.Types.ObjectId();
    const hour0 = new Date('2024-06-01T00:00:00.000Z');
    const hour1 = new Date('2024-06-01T01:00:00.000Z');
    const hour2 = new Date('2024-06-01T02:00:00.000Z');

    await ViewEvent.create([
      { article, at: new Date('2024-06-01T00:10:00.000Z') },
      { article, at: new Date('2024-06-01T00:40:00.000Z') },
      // hour1 deliberately empty — the gap.
      { article, at: new Date('2024-06-01T02:05:00.000Z') },
      { article, at: new Date('2024-06-01T02:20:00.000Z') },
      { article, at: new Date('2024-06-01T02:50:00.000Z') },
    ]);

    const series = await getSeries({
      articleId: article,
      from: hour0,
      to: new Date('2024-06-01T02:59:59.999Z'),
      bucket: 'hour',
    });

    assert.equal(series.length, 3);
    assert.deepEqual(series.map((p) => p.count), [2, 0, 3]);
    assert.deepEqual(series.map((p) => p.t), [
      hour0.toISOString(),
      hour1.toISOString(),
      hour2.toISOString(),
    ]);
  });

  test('a window with zero events returns all-zero buckets spanning it, never throws', async () => {
    const article = new mongoose.Types.ObjectId();
    const from = new Date('2024-01-01T00:00:00.000Z');
    const to = new Date('2024-01-01T02:00:00.000Z');

    const series = await getSeries({ articleId: article, from, to, bucket: 'hour' });

    assert.equal(series.length, 3);
    assert.deepEqual(series.map((p) => p.count), [0, 0, 0]);
    assert.deepEqual(series.map((p) => p.t), [
      new Date('2024-01-01T00:00:00.000Z').toISOString(),
      new Date('2024-01-01T01:00:00.000Z').toISOString(),
      new Date('2024-01-01T02:00:00.000Z').toISOString(),
    ]);
  });

  test('bucket: "day" truncates to day boundaries instead of hour boundaries', async () => {
    const article = new mongoose.Types.ObjectId();
    const day0 = new Date('2024-06-01T00:00:00.000Z');
    const day1 = new Date('2024-06-02T00:00:00.000Z');

    await ViewEvent.create([
      { article, at: new Date('2024-06-01T05:00:00.000Z') },
      { article, at: new Date('2024-06-01T20:00:00.000Z') },
      { article, at: new Date('2024-06-02T10:00:00.000Z') },
    ]);

    const series = await getSeries({
      articleId: article,
      from: day0,
      to: new Date('2024-06-02T23:59:59.999Z'),
      bucket: 'day',
    });

    assert.equal(series.length, 2);
    assert.deepEqual(series.map((p) => p.count), [2, 1]);
    assert.deepEqual(series.map((p) => p.t), [day0.toISOString(), day1.toISOString()]);
  });

  test('events for a different articleId are never counted', async () => {
    const article = new mongoose.Types.ObjectId();
    const otherArticle = new mongoose.Types.ObjectId();
    const hour0 = new Date('2024-06-01T00:00:00.000Z');

    await ViewEvent.create([
      { article, at: new Date('2024-06-01T00:10:00.000Z') },
      { article: otherArticle, at: new Date('2024-06-01T00:20:00.000Z') },
      { article: otherArticle, at: new Date('2024-06-01T00:30:00.000Z') },
    ]);

    const series = await getSeries({
      articleId: article,
      from: hour0,
      to: new Date('2024-06-01T00:59:59.999Z'),
      bucket: 'hour',
    });

    assert.equal(series.length, 1);
    assert.equal(series[0].count, 1);
  });
});
