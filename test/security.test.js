import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import express from 'express';
import request from 'supertest';

import { createApp } from '../app.js';
import { errorHandler } from '../middleware/error.js';
import { buildEnv } from '../config/env.js';
import { securityHeaders, requireSameOrigin } from '../middleware/security.js';
import { buildPublicFeedQuery } from '../services/articleQuery.service.js';

describe('securityHeaders', () => {
  test('sets hardening headers and hides X-Powered-By', async () => {
    const res = await request(createApp()).get('/api/health');
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.equal(res.headers['referrer-policy'], 'same-origin');
    const csp = res.headers['content-security-policy'];
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
  });

  test('HSTS only in production', async () => {
    const mk = (nodeEnv) => {
      const app = express();
      app.use(securityHeaders({ nodeEnv }));
      app.get('/', (req, res) => res.end());
      return app;
    };
    const dev = await request(mk('development')).get('/');
    assert.equal(dev.headers['strict-transport-security'], undefined);
    const prod = await request(mk('production')).get('/');
    assert.match(prod.headers['strict-transport-security'], /max-age=/);
  });

  test('views carry no inline scripts or styles that the CSP would block', () => {
    const files = readdirSync('views', { recursive: true }).filter((n) => n.endsWith('.ejs'));
    assert.ok(files.length > 0);
    for (const f of files) {
      const src = readFileSync(`views/${f}`, 'utf8');
      assert.doesNotMatch(src, /<script(?![^>]*\ssrc=)[^>]*>/i, `${f}: inline script`);
      assert.doesNotMatch(src, /<style|\sstyle=|\son[a-z]+=/i, `${f}: inline style/handler`);
    }
  });
});

describe('requireSameOrigin', () => {
  const app = express();
  app.use(requireSameOrigin());
  app.all('/x', (req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  const SID = 'connect.sid=s%3Aabc';

  test('safe methods pass regardless of Origin', async () => {
    await request(app).get('/x').set('Origin', 'https://evil.test').expect(200);
  });
  test('same-origin Origin passes', async () => {
    await request(app)
      .post('/x')
      .set('Host', 'site.test')
      .set('Origin', 'http://site.test')
      .set('Cookie', SID)
      .expect(200);
  });
  test('cross-origin Origin is rejected with 403', async () => {
    const res = await request(app)
      .post('/x')
      .set('Host', 'site.test')
      .set('Origin', 'https://evil.test')
      .set('Cookie', SID);
    assert.equal(res.status, 403);
    assert.ok(res.body.error);
  });
  test('cross-origin Origin rejected even without a cookie', async () => {
    await request(app)
      .delete('/x')
      .set('Host', 'site.test')
      .set('Origin', 'https://evil.test')
      .expect(403);
  });
  test('falls back to Referer when Origin is absent', async () => {
    await request(app)
      .post('/x')
      .set('Host', 'site.test')
      .set('Referer', 'http://site.test/newsroom')
      .set('Cookie', SID)
      .expect(200);
    await request(app)
      .post('/x')
      .set('Host', 'site.test')
      .set('Referer', 'https://evil.test/a')
      .set('Cookie', SID)
      .expect(403);
  });
  test('no Origin/Referer and no session cookie (non-browser client) passes', async () => {
    await request(app).post('/x').expect(200);
  });
  test('no Origin/Referer but a session cookie is rejected', async () => {
    await request(app).post('/x').set('Cookie', SID).expect(403);
  });
});

describe('production SESSION_SECRET guard', () => {
  const prod = (s) => () => buildEnv({ NODE_ENV: 'production', SESSION_SECRET: s });
  test('rejects short secrets', () => assert.throws(prod('short-secret'), /SESSION_SECRET/));
  test('rejects the committed .env.test value', () =>
    assert.throws(
      prod('0db5075dde9211db4b742e8f6972a854e812ad219c9fb59576be6c6a2b001c9a'),
      /SESSION_SECRET/
    ));
  test('accepts a long random secret', () =>
    assert.doesNotThrow(prod('x'.repeat(16) + 'Zq9'.repeat(6))));
  test('trustProxy from env', () => {
    assert.equal(buildEnv({ TRUST_PROXY: '1' }).trustProxy, 1);
    assert.equal(buildEnv({}).trustProxy, false);
    assert.equal(buildEnv({ TRUST_PROXY: 'loopback' }).trustProxy, 'loopback');
  });
});

describe('PUBLIC_SORTS prototype keys', () => {
  for (const sort of ['__proto__', 'constructor', 'toString']) {
    test(`sort=${sort} is rejected`, () => {
      assert.throws(() => buildPublicFeedQuery({ sort }), /unknown sort/);
    });
  }
});
