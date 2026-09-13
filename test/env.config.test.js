import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

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
    const result = buildEnv(
      source({ NODE_ENV: 'production', SESSION_SECRET: 'a-real-randomly-generated-secret' })
    );
    assert.equal(result.sessionSecret, 'a-real-randomly-generated-secret');
    assert.equal(result.nodeEnv, 'production');
  });

  test('development env keeps working with the friendly default when SESSION_SECRET is unset', () => {
    const result = buildEnv(source({ NODE_ENV: 'development' }));
    assert.equal(result.sessionSecret, DEFAULT_SESSION_SECRET);
  });

  test('test env keeps working with the friendly default when SESSION_SECRET is unset', () => {
    const result = buildEnv(source({ NODE_ENV: 'test' }));
    assert.equal(result.sessionSecret, DEFAULT_SESSION_SECRET);
  });
});
