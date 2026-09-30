import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import rateLimit, { checkRateLimit, pruneStore, assignDeviceId } from '../middleware/rateLimit.js';

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

    // Pruning is a separate, interval-driven sweep (not per request)
    checkRateLimit(store, 'device-2', currentTime, windowMs, max);
    currentTime += windowMs * 2;
    checkRateLimit(store, 'device-3', currentTime, windowMs, max);
    assert.equal(store.has(deviceId), true, 'checking one key must not sweep the others');

    pruneStore(store, currentTime, windowMs);
    assert.equal(store.has(deviceId), false, 'Expired bucket should be deleted');
    assert.equal(store.has('device-2'), false, 'Expired bucket should be deleted');
    assert.equal(store.has('device-3'), true, 'Active bucket should remain');
});

test('Pure function: checkRateLimit keeps the store within maxKeys, evicting the least recently used key', () => {
    const store = new Map();
    for (let i = 0; i < 20; i++) checkRateLimit(store, `k${i}`, 1000, 60000, 3, 5);
    assert.equal(store.size, 5);
    assert.equal(store.has('k19'), true);
    assert.equal(store.has('k0'), false);
});

test('HTTP integration: Issues cookie, limits requests, and delegates errors', async () => {
    const app = express();
    const store = new Map();
    
    app.use(cookieParser());
    
    // Mount the defensive cookie assigner and the rate limiter together
    app.post('/comment', assignDeviceId, rateLimit({ store, max: 3, ipMax: 100, windowMs: 60000 }), (req, res) => {
        res.status(201).json({ data: 'ok' });
    });

    // Skeleton error middleware mock matching the provided errorHandler behavior
    // eslint-disable-next-line no-unused-vars -- Express identifies error handlers by their 4-argument arity
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

function buildApp(options) {
    const app = express();
    app.use(cookieParser());
    app.post('/comment', assignDeviceId, rateLimit(options), (req, res) => {
        res.status(201).json({ data: 'ok' });
    });
    // eslint-disable-next-line no-unused-vars -- Express identifies error handlers by their 4-argument arity
    app.use((err, req, res, next) => {
        res.status(err.status || 500).json({ error: { message: err.message, code: err.code || 'internal' } });
    });
    return app;
}

test('Dropping the cookie does not reset the limit: the client IP is limited too', async () => {
    const app = buildApp({ store: new Map(), max: 3, ipMax: 5, windowMs: 60000 });
    for (let i = 0; i < 5; i++) {
        await request(app).post('/comment').expect(201); // fresh deviceId every time
    }
    const blocked = await request(app).post('/comment');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error.code, 'rate_limited');
});

test('Forging deviceId cookies does not reset the limit', async () => {
    const app = buildApp({ store: new Map(), max: 3, ipMax: 5, windowMs: 60000 });
    for (let i = 1; i <= 5; i++) {
        await request(app).post('/comment').set('Cookie', `deviceId=r${i}`).expect(201);
    }
    await request(app).post('/comment').set('Cookie', 'deviceId=r6').expect(429);
});

test('Forged X-Forwarded-For is ignored unless trust proxy is enabled', async () => {
    const app = buildApp({ store: new Map(), max: 3, ipMax: 2, windowMs: 60000 });
    await request(app).post('/comment').set('X-Forwarded-For', '1.1.1.1').expect(201);
    await request(app).post('/comment').set('X-Forwarded-For', '2.2.2.2').expect(201);
    await request(app).post('/comment').set('X-Forwarded-For', '3.3.3.3').expect(429);
});

test('Minting device ids cannot grow the store past maxKeys', async () => {
    const store = new Map();
    const app = buildApp({ store, max: 3, ipMax: 1000, maxKeys: 10, windowMs: 60000 });
    for (let i = 0; i < 40; i++) {
        await request(app).post('/comment').set('Cookie', `deviceId=m${i}`).expect(201);
    }
    assert.ok(store.size <= 10, `store size ${store.size} exceeds maxKeys`);
});

test('The interval sweep prunes expired buckets without a request', async () => {
    const store = new Map();
    let now = 1000;
    const app = buildApp({ store, max: 3, ipMax: 100, windowMs: 50, pruneIntervalMs: 10, clock: { now: () => now } });
    await request(app).post('/comment').expect(201);
    assert.ok(store.size > 0);
    now += 1000;
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(store.size, 0);
});
