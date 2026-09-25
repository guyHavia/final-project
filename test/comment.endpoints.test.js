import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';

import commentRoutes from '../routes/comment.routes.js';
import { Article } from '../models/article.model.js';
import { Comment } from '../models/comment.model.js';
import { AppError } from '../lib/AppError.js';

let mongoServer;
let app;
let publishedArticle;
let draftArticle;

// Minimal mock of P1's session/RBAC middleware for testing delete roles
function mockSession(req, res, next) {
    const role = req.headers['x-mock-role'];
    if (role) {
        req.session = { user: { id: new mongoose.Types.ObjectId(), role } };
    }
    next();
}

test.before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(mockSession);
    
    // Mount router exactly as expected centrally at /api
    app.use('/api', commentRoutes);

    // Skeleton Terminal Error Handler Mock
    app.use((err, req, res, next) => {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: { message: err.message, code: 'validation' } });
        }
        if (err.name === 'CastError') {
            return res.status(400).json({ error: { message: err.message, code: 'invalid_id' } });
        }
        const status = err.status || 500;
        const code = err.code || 'internal';
        res.status(status).json({ error: { message: err.message, code } });
    });

    // Seed test articles
    publishedArticle = await Article.create({
        title: 'Public News',
        category: 'politics',
        author: new mongoose.Types.ObjectId(),
        state: 'Published',
        firstPublishedAt: new Date()
    });

    draftArticle = await Article.create({
        title: 'Draft News',
        category: 'politics',
        author: new mongoose.Types.ObjectId(),
        state: 'In Preparation'
    });
});

test.after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

test.afterEach(async () => {
    await Comment.deleteMany({});
});

test('HTTP Create: Valid create returns 201 without deviceId and creates exactly one DB doc', async () => {
    const res = await request(app)
        .post(`/api/articles/${publishedArticle._id}/comments`)
        .send({ authorName: 'Dana', body: 'Clear reporting, thanks.' });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.authorName, 'Dana');
    assert.equal(res.body.data.body, 'Clear reporting, thanks.');
    assert.equal(res.body.data.article, publishedArticle.id);
    assert.equal(res.body.data.deviceId, undefined, 'deviceId must not be serialized');

    const dbCount = await Comment.countDocuments();
    assert.equal(dbCount, 1);
});

test('HTTP Create: Fails with 400 validation for blank/over-long fields', async () => {
    const res = await request(app)
        .post(`/api/articles/${publishedArticle._id}/comments`)
        .send({ authorName: '', body: 'A' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'validation');
});

test('HTTP Create & List: Rejects unknown/non-published articles with 404', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    
    // Create
    await request(app).post(`/api/articles/${draftArticle._id}/comments`).send({ authorName: 'A', body: 'B' }).expect(404);
    await request(app).post(`/api/articles/${fakeId}/comments`).send({ authorName: 'A', body: 'B' }).expect(404);
    
    // List
    await request(app).get(`/api/articles/${draftArticle._id}/comments`).expect(404);
    await request(app).get(`/api/articles/${fakeId}/comments`).expect(404);
});

test('HTTP Create: Applies rate limiting correctly (4 creates in 60s -> 3 pass, 1 blocked)', async () => {
    let cookie;

    for (let i = 0; i < 3; i++) {
        const req = request(app).post(`/api/articles/${publishedArticle._id}/comments`).send({ authorName: 'Test', body: 'Pass' });
        if (cookie) req.set('Cookie', cookie);
        
        const res = await req;
        assert.equal(res.status, 201);
        if (!cookie) cookie = res.headers['set-cookie'][0].split(';')[0];
    }

    // 4th request must fail and create no document
    const resBlocked = await request(app)
        .post(`/api/articles/${publishedArticle._id}/comments`)
        .set('Cookie', cookie)
        .send({ authorName: 'Test', body: 'Blocked' });

    assert.equal(resBlocked.status, 429);
    assert.equal(resBlocked.body.error.code, 'rate_limited');

    const dbCount = await Comment.countDocuments();
    assert.equal(dbCount, 3, '4th comment must not be stored in the database');
});

test('HTTP List: Returns newest-first, honors limit, nextCursor, and q filters', async () => {
    // Seed 3 comments sequentially
    await Comment.create([
        { article: publishedArticle._id, authorName: 'A', body: 'First comment', deviceId: '123' },
        { article: publishedArticle._id, authorName: 'B', body: 'Second comment', deviceId: '123' },
        { article: publishedArticle._id, authorName: 'C', body: 'Target query match', deviceId: '123' }
    ]);

    // Test limit and pagination (newest first)
    const resPage1 = await request(app).get(`/api/articles/${publishedArticle._id}/comments?limit=2`);
    assert.equal(resPage1.status, 200);
    assert.equal(resPage1.body.data.items.length, 2);
    assert.equal(resPage1.body.data.items[0].authorName, 'C'); // Newest
    assert.ok(resPage1.body.data.nextCursor);

    const resPage2 = await request(app).get(`/api/articles/${publishedArticle._id}/comments?limit=2&cursor=${resPage1.body.data.nextCursor}`);
    assert.equal(resPage2.status, 200);
    assert.equal(resPage2.body.data.items.length, 1);
    assert.equal(resPage2.body.data.items[0].authorName, 'A'); // Oldest
    assert.equal(resPage2.body.data.nextCursor, null);

    // Test text search
    const resSearch = await request(app).get(`/api/articles/${publishedArticle._id}/comments?q=target`);
    assert.equal(resSearch.status, 200);
    assert.equal(resSearch.body.data.items.length, 1);
    assert.equal(resSearch.body.data.items[0].authorName, 'C');
});

test('HTTP Delete: Restricts access by role and deletes target', async () => {
    const comment = await Comment.create({ article: publishedArticle._id, authorName: 'Spam', body: 'Buy this', deviceId: '123' });

    // No session
    await request(app).delete(`/api/comments/${comment._id}`).expect(401);

    // Reporter
    await request(app).delete(`/api/comments/${comment._id}`).set('x-mock-role', 'reporter').expect(403);

    // Editor (Success)
    const res = await request(app).delete(`/api/comments/${comment._id}`).set('x-mock-role', 'editor');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.ok, true);

    const check = await Comment.findById(comment._id);
    assert.equal(check, null);

    // Unknown ID
    await request(app).delete(`/api/comments/${comment._id}`).set('x-mock-role', 'editor').expect(404);
});