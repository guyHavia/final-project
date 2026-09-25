const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Comment = require('../models/comment.model');
const Article = require('../models/article.model');

describe('Comment Model (P3-01)', () => {
  let mongoServer;
  let sampleArticleId;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Comment.deleteMany({});
    await Article.deleteMany({});

    // Create a mock published article for testing references
    const article = await Article.create({
      title: 'Test Article',
      slug: 'test-article',
      body: 'Content of test article...',
      state: 'published',
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
    // Blank authorName
    await assert.rejects(async () => {
      await Comment.create({
        article: sampleArticleId,
        authorName: '',
        body: 'Valid body',
        deviceId: 'device-1',
      });
    }, /ValidationError/);

    // Over-long authorName (> 60 chars)
    await assert.rejects(async () => {
      await Comment.create({
        article: sampleArticleId,
        authorName: 'a'.repeat(61),
        body: 'Valid body',
        deviceId: 'device-1',
      });
    }, /ValidationError/);

    // Over-long body (> 2000 chars)
    await assert.rejects(async () => {
      await Comment.create({
        article: sampleArticleId,
        authorName: 'Dana',
        body: 'a'.repeat(2001),
        deviceId: 'device-1',
      });
    }, /ValidationError/);
  });

  it('should make createdAt immutable', async () => {
    const comment = await Comment.create({
      article: sampleArticleId,
      authorName: 'Dana',
      body: 'Immutability test',
      deviceId: 'device-1',
    });

    comment.createdAt = new Date(2020, 0, 1);
    
    await assert.rejects(async () => {
      await comment.save();
    });
  });
});