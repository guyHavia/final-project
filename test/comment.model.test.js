import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { Comment } from '../models/comment.model.js';
import { Article } from '../models/article.model.js';

describe('Comment Model (P3-01)', () => {
  let stopMongo;
  let sampleArticleId;

  before(async () => {
    stopMongo = await startMongo();
  });

  after(async () => {
    await stopMongo();
  });

  beforeEach(async () => {
    await Comment.deleteMany({});
    await Article.deleteMany({});

    // A published article to attach comments to (valid against the Article schema).
    const article = await Article.create({
      title: 'Test Article',
      body: 'Content of test article...',
      category: 'politics',
      author: new mongoose.Types.ObjectId(),
      state: 'Published',
      firstPublishedAt: new Date(),
    });
    sampleArticleId = article._id;
  });

  it('should create a valid comment with required fields', async () => {
    const comment = await Comment.create({
      article: sampleArticleId,
      authorName: 'Dana',
      body: 'Clear reporting, thanks.',
      deviceId: 'opaque-device-uuid',
    });

    assert.equal(comment.authorName, 'Dana');
    assert.equal(comment.body, 'Clear reporting, thanks.');
    assert.equal(comment.deviceId, 'opaque-device-uuid');
    assert.ok(comment.createdAt instanceof Date);
  });

  it('should strip deviceId in toJSON serialization', async () => {
    const comment = await Comment.create({
      article: sampleArticleId,
      authorName: 'Eli',
      body: 'Great read.',
      deviceId: 'secret-device-id',
    });

    const json = comment.toJSON();
    assert.equal(json.deviceId, undefined);
    assert.equal(json.authorName, 'Eli');
    assert.ok(json.id);
  });

  it('should enforce validation rules for authorName and body lengths', async () => {
    const attempt = (fields) =>
      Comment.create({
        article: sampleArticleId,
        authorName: 'Dana',
        body: 'Valid body',
        deviceId: 'device-1',
        ...fields,
      });

    await assert.rejects(attempt({ authorName: '' }), { name: 'ValidationError' });
    await assert.rejects(attempt({ authorName: 'a'.repeat(61) }), { name: 'ValidationError' });
    await assert.rejects(attempt({ body: '   ' }), { name: 'ValidationError' });
    await assert.rejects(attempt({ body: 'a'.repeat(2001) }), { name: 'ValidationError' });
  });

  it('should make createdAt immutable', async () => {
    const comment = await Comment.create({
      article: sampleArticleId,
      authorName: 'Dana',
      body: 'Immutability test',
      deviceId: 'device-1',
    });
    const original = comment.createdAt.getTime();

    // Mongoose ignores writes to an immutable path on an existing document.
    comment.createdAt = new Date(2020, 0, 1);
    await comment.save();

    const reloaded = await Comment.findById(comment._id);
    assert.equal(reloaded.createdAt.getTime(), original);
  });
});
