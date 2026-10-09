import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import { buildEnv, DEFAULT_SESSION_SECRET } from '../config/env.js';

/** A minimal, complete source object so each test only varies what it's checking. */
function source(overrides = {}) {
  return {
    NODE_ENV: 'development',
    PORT: '3000',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/the-daily-web',
    ...overrides,
  };
}

describe('buildEnv', () => {
  test('refuses to build a production env with SESSION_SECRET unset', () => {
    assert.throws(() => buildEnv(source({ NODE_ENV: 'production' })), /SESSION_SECRET/);
  });

  test('refuses to build a production env with SESSION_SECRET equal to the known default', () => {
    assert.throws(
      () => buildEnv(source({ NODE_ENV: 'production', SESSION_SECRET: DEFAULT_SESSION_SECRET })),
      /SESSION_SECRET/
    );
  });

  test('builds a production env when a real SESSION_SECRET is set', () => {
    const secret = randomBytes(64).toString('hex');
    const result = buildEnv(source({ NODE_ENV: 'production', SESSION_SECRET: secret }));
    assert.equal(result.sessionSecret, secret);
    assert.equal(result.nodeEnv, 'production');
  });

  test('development env keeps working with the friendly default when SESSION_SECRET is unset', () => {
    const result = buildEnv(source({ NODE_ENV: 'development' }));
    assert.equal(result.sessionSecret, DEFAULT_SESSION_SECRET);
  });

  test('refuses to build a test env with SESSION_SECRET unset or below 512 bits', () => {
    assert.throws(() => buildEnv(source({ NODE_ENV: 'test' })), /SESSION_SECRET/);
    const short = randomBytes(64).toString('hex').slice(1);
    assert.throws(() => buildEnv(source({ NODE_ENV: 'test', SESSION_SECRET: short })), /SESSION_SECRET/);
  });

  test('builds a test env with a 512-bit SESSION_SECRET', () => {
    const secret = randomBytes(64).toString('hex');
    assert.equal(buildEnv(source({ NODE_ENV: 'test', SESSION_SECRET: secret })).sessionSecret, secret);
  });
});
