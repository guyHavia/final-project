/* global window */
// This test stubs the browser globals (window, fetch) that auth-client.js
// depends on, so it can be exercised directly under node:test.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { apiRequest, me, login, logout, ApiError } from '../public/js/auth-client.js';

/**
 * public/js/auth-client.js is a browser module (uses `fetch` and `window`).
 * We stub both globals the way the module would see them at runtime, per
 * issue #6's Seam 2: assert on fetch call args and on the emitted result/
 * error, never on real network or DOM behavior.
 */
function fakeResponse({ status, body }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

let calls;
beforeEach(() => {
  calls = [];
  globalThis.window = { location: { href: '' } };
});

describe('apiRequest', () => {
  test('always sends the session cookie', async () => {
    globalThis.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return fakeResponse({ status: 200, body: { data: { ok: true } } });
    };

    await apiRequest('/health');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].opts.credentials, 'same-origin');
  });

  test('a 2xx response unwraps the data payload', async () => {
    globalThis.fetch = async () => fakeResponse({ status: 200, body: { data: { id: 1 } } });

    const result = await apiRequest('/x');

    assert.deepEqual(result, { id: 1 });
  });

  test('a non-2xx response throws ApiError carrying the status and code', async () => {
    globalThis.fetch = async () =>
      fakeResponse({ status: 403, body: { error: { message: 'nope', code: 'forbidden' } } });

    await assert.rejects(
      () => apiRequest('/x'),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 403);
        assert.equal(err.code, 'forbidden');
        assert.equal(err.message, 'nope');
        return true;
      },
    );
  });

  test('a 401 sets the browser location to /login by default, without throwing', async () => {
    globalThis.fetch = async () =>
      fakeResponse({ status: 401, body: { error: { message: 'unauthorized', code: 'unauthorized' } } });

    const result = await apiRequest('/x');

    assert.equal(result, undefined);
    assert.equal(window.location.href, '/login');
  });

  test("on401: 'ignore' resolves to undefined without redirecting", async () => {
    globalThis.fetch = async () =>
      fakeResponse({ status: 401, body: { error: { message: 'unauthorized', code: 'unauthorized' } } });

    const result = await apiRequest('/x', { on401: 'ignore' });

    assert.equal(result, undefined);
    assert.equal(window.location.href, '');
  });

  test("on401: 'throw' treats 401 like any other error instead of redirecting", async () => {
    globalThis.fetch = async () =>
      fakeResponse({ status: 401, body: { error: { message: 'invalid credentials', code: 'unauthorized' } } });

    await assert.rejects(
      () => apiRequest('/x', { on401: 'throw' }),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 401);
        return true;
      },
    );
    assert.equal(window.location.href, '');
  });

  test('sends a JSON body and Content-Type header when body is given', async () => {
    globalThis.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return fakeResponse({ status: 200, body: { data: {} } });
    };

    await apiRequest('/x', { method: 'POST', body: { a: 1 } });

    assert.equal(calls[0].opts.method, 'POST');
    assert.equal(calls[0].opts.headers['Content-Type'], 'application/json');
    assert.equal(calls[0].opts.body, JSON.stringify({ a: 1 }));
  });
});

describe('me', () => {
  test('resolves to the user on success', async () => {
    globalThis.fetch = async () =>
      fakeResponse({ status: 200, body: { data: { id: '1', username: 'ana', role: 'reporter' } } });

    const user = await me();

    assert.equal(user.username, 'ana');
  });

  test('resolves to undefined on a 401, without redirecting', async () => {
    globalThis.fetch = async () =>
      fakeResponse({ status: 401, body: { error: { message: 'unauthorized', code: 'unauthorized' } } });

    const user = await me();

    assert.equal(user, undefined);
    assert.equal(window.location.href, '');
  });
});

describe('login', () => {
  test('resolves to the user on success', async () => {
    globalThis.fetch = async (url) => {
      calls.push(url);
      return fakeResponse({
        status: 200,
        body: { data: { id: '1', username: 'ana', role: 'editor', displayName: 'Ana' } },
      });
    };

    const user = await login('ana', 'secret');

    assert.equal(calls[0], '/api/auth/login');
    assert.equal(user.role, 'editor');
  });

  test('throws the generic "invalid credentials" message on a 401, without redirecting', async () => {
    globalThis.fetch = async () =>
      fakeResponse({
        status: 401,
        body: { error: { message: 'invalid credentials', code: 'unauthorized' } },
      });

    await assert.rejects(
      () => login('ana', 'wrong'),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.message, 'invalid credentials');
        assert.equal(err.status, 401);
        return true;
      },
    );
    assert.equal(window.location.href, '');
  });

  test('a 400 (missing field) still throws normally', async () => {
    globalThis.fetch = async () =>
      fakeResponse({ status: 400, body: { error: { message: 'username is required', code: 'bad_request' } } });

    await assert.rejects(() => login('', 'secret'), ApiError);
  });
});

describe('logout', () => {
  test('POSTs to /api/auth/logout', async () => {
    globalThis.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return fakeResponse({ status: 200, body: { data: { ok: true } } });
    };

    await logout();

    assert.equal(calls[0].url, '/api/auth/logout');
    assert.equal(calls[0].opts.method, 'POST');
  });
});
