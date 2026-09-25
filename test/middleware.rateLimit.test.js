import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import rateLimit, { checkRateLimit, assignDeviceId } from '../middleware/rateLimit.js';
import { AppError } from '../lib/AppError.js';

test('Pure function: checkRateLimit handles sliding window and prunes empty buckets', () => {
    const store = new Map();
    const windowMs = 60000;
    const max = 3;
    const deviceId = 'device-1';
    let currentTime = 100000;

    // 1st, 2nd, 3rd requests pass
    assert.equal(checkRateLimit(store, deviceId, currentTime, windowMs, max), true);
    assert.equal(checkRateLimit(store, deviceId, currentTime, windowMs, max), true);
    assert.equal(checkRateLimit(store, deviceId, currentTime, windowMs, max), true);
    
    // 4th request in the same window is rejected
    assert.equal(checkRateLimit(store, deviceId, currentTime, windowMs, max), false);

    // Advance clock past the window
    currentTime += windowMs + 1;

    // 5th request should now pass
    assert.equal(checkRateLimit(store, deviceId, currentTime, windowMs, max), true);

    // Verify pruning behavior
    const device2 = 'device-2';
    checkRateLimit(store, device2, currentTime, windowMs, max);
    
    // Advance time far enough to expire device-1's old timestamps completely
    currentTime += windowMs * 2;
    checkRateLimit(store, 'device-3', currentTime, windowMs, max); 
    
    assert.equal(store.has(deviceId), false, 'Expired bucket should be deleted');
    assert.equal(store.has(device2), false, 'Expired bucket should be deleted');
    assert.equal(store.has('device-3'), true, 'Active bucket should remain');
});

test('HTTP integration: Issues cookie, limits requests, and delegates errors', async () => {
    const app = express();
    const store = new Map();
    
    app.use(cookieParser());
    
    // Mount the defensive cookie assigner and the rate limiter together
    app.post('/comment', assignDeviceId, rateLimit({ store, max: 3, windowMs: 60000 }), (req, res) => {
        res.status(201).json({ data: 'ok' });
    });

    // Skeleton error middleware mock matching the provided errorHandler behavior
    app.use((err, req, res, next) => {
        const status = err.status || 500;
        const code = err.code || 'internal';
        res.status(status).json({ error: { message: err.message, code } });
    });

    // 1. Initial request gets a cookie and passes
    const res1 = await request(app).post('/comment');
    assert.equal(res1.status, 201);
    
    const setCookieHeader = res1.headers['set-cookie'][0];
    assert.match(setCookieHeader, /deviceId=[a-f0-9-]+/);
    assert.match(setCookieHeader, /HttpOnly/i);
    assert.match(setCookieHeader, /SameSite=Lax/);

    const cookie = setCookieHeader.split(';')[0];

    // 2. Make 2 more requests with the same cookie
    await request(app).post('/comment').set('Cookie', cookie).expect(201);
    await request(app).post('/comment').set('Cookie', cookie).expect(201);

    // 3. 4th request with same cookie should be blocked
    const res4 = await request(app).post('/comment').set('Cookie', cookie);
    assert.equal(res4.status, 429);
    assert.equal(res4.body.error.code, 'rate_limited');
    assert.equal(res4.body.error.message, 'you are posting too fast, wait a moment');

    // 4. Request from a different device (no cookie) succeeds immediately
    await request(app).post('/comment').expect(201);
});