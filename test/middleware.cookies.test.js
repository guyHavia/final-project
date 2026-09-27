import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseCookies } from '../middleware/cookies.js';

/** Runs the middleware against a fake request with the given Cookie header. */
function run(cookieHeader) {
  const req = { headers: cookieHeader === undefined ? {} : { cookie: cookieHeader } };
  let calledNext = false;
  parseCookies(req, {}, () => {
    calledNext = true;
  });
  assert.equal(calledNext, true, 'must always call next()');
  return req.cookies;
}

describe('parseCookies', () => {
  test('splits the Cookie header into req.cookies', () => {
    assert.deepEqual(run('deviceId=abc-123; connect.sid=s%3Axyz'), {
      deviceId: 'abc-123',
      'connect.sid': 's:xyz',
    });
  });

  test('no Cookie header gives an empty object, never undefined', () => {
    assert.deepEqual(run(undefined), {});
    assert.deepEqual(run(''), {});
  });

  test('keeps "=" inside a value and trims spaces around names and values', () => {
    assert.deepEqual(run('  token = a=b=c ;theme=dark'), { token: 'a=b=c', theme: 'dark' });
  });

  test('skips malformed pieces instead of throwing', () => {
    assert.deepEqual(run('novalue; =nokey; ok=1;;'), { ok: '1' });
  });

  test('keeps a value that is not valid URL encoding as-is', () => {
    assert.deepEqual(run('bad=%E0%A4%A'), { bad: '%E0%A4%A' });
  });

  test('the first occurrence of a name wins', () => {
    assert.deepEqual(run('deviceId=first; deviceId=second'), { deviceId: 'first' });
  });
});
