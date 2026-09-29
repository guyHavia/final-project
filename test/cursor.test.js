import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { encodeCursor, decodeCursor } from '../lib/cursor.js';

const ID = '652f1c2ab4d5e6f708192a3b';

describe('cursor', () => {
  test('round-trips a numeric sort value', () => {
    const decoded = decodeCursor(encodeCursor({ v: 42, id: ID }));
    assert.deepEqual(decoded, { v: 42, id: ID });
  });

  test('round-trips a Date sort value as a Date', () => {
    const at = new Date('2025-03-04T05:06:07.000Z');
    const decoded = decodeCursor(encodeCursor({ v: at, id: ID }));
    assert.ok(decoded.v instanceof Date);
    assert.equal(decoded.v.toISOString(), at.toISOString());
    assert.equal(decoded.id, ID);
  });

  test('is an opaque URL-safe string', () => {
    const cursor = encodeCursor({ v: new Date(), id: ID });
    assert.equal(typeof cursor, 'string');
    assert.match(cursor, /^[A-Za-z0-9_-]+$/);
  });

  test('returns null for malformed input instead of throwing', () => {
    const bad = [
      undefined,
      null,
      '',
      'not a cursor!!',
      Buffer.from('not json').toString('base64url'),
      Buffer.from(JSON.stringify({ v: 1 })).toString('base64url'),
      Buffer.from(JSON.stringify({ v: 1, id: 'nope' })).toString('base64url'),
      Buffer.from(JSON.stringify({ v: 'text', id: ID })).toString('base64url'),
      Buffer.from(JSON.stringify({ v: { d: 'not a date' }, id: ID })).toString('base64url'),
      Buffer.from(JSON.stringify({ v: null, id: ID })).toString('base64url'),
      Buffer.from(JSON.stringify([1, 2])).toString('base64url'),
    ];
    for (const input of bad) {
      assert.equal(decodeCursor(input), null, `expected null for ${JSON.stringify(input)}`);
    }
  });
});
