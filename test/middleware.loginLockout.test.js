import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoginLimiter } from '../middleware/loginLockout.js';

const opts = { windowMs: 1000, lockoutMs: 1000, maxUserAttempts: 5, maxIpAttempts: 8, maxEntries: 100 };

test('reserve counts the attempt immediately, so a synchronous burst cannot exceed the limit', () => {
  const l = createLoginLimiter(opts);
  const results = Array.from({ length: 15 }, () => l.reserve('alice', '1.1.1.1', 0).allowed);
  assert.equal(results.filter(Boolean).length, 5);
});

test('username lock expires after lockoutMs', () => {
  const l = createLoginLimiter(opts);
  for (let i = 0; i < 5; i += 1) l.reserve('bob', '1.1.1.1', 0);
  assert.equal(l.reserve('bob', '2.2.2.2', 10).allowed, false);
  assert.equal(l.reserve('bob', '2.2.2.2', 1001).allowed, true);
});

test('attempts older than the window do not count', () => {
  const l = createLoginLimiter(opts);
  for (let i = 0; i < 4; i += 1) l.reserve('carol', '1.1.1.1', 0);
  assert.equal(l.reserve('carol', '1.1.1.1', 1001).allowed, true);
  assert.equal(l.reserve('carol', '1.1.1.1', 1002).allowed, true);
});

test('succeed clears the username count so the next failures start fresh', () => {
  const l = createLoginLimiter(opts);
  for (let i = 0; i < 5; i += 1) l.reserve('dave', '1.1.1.1', 0);
  l.succeed('dave', '1.1.1.1');
  for (let i = 0; i < 4; i += 1) assert.equal(l.reserve('dave', '9.9.9.9', 1).allowed, true);
});

test('one ip cannot exceed maxIpAttempts across many usernames; other ips are unaffected', () => {
  const l = createLoginLimiter(opts);
  const res = Array.from({ length: 12 }, (_, i) => l.reserve(`user${i}`, '3.3.3.3', 0).allowed);
  assert.equal(res.filter(Boolean).length, 8);
  assert.equal(l.reserve('fresh', '4.4.4.4', 0).allowed, true);
});

test('a blocked ip cannot keep extending a victim username lock', () => {
  const l = createLoginLimiter(opts);
  for (let i = 0; i < 20; i += 1) l.reserve('victim', '5.5.5.5', 0);
  assert.equal(l.reserve('victim', '6.6.6.6', 1001).allowed, true);
});

test('store is bounded by maxEntries', () => {
  const l = createLoginLimiter({ ...opts, maxEntries: 10, maxIpAttempts: 1000 });
  for (let i = 0; i < 50; i += 1) l.reserve(`u${i}`, `10.0.0.${i}`, 0);
  assert.ok(l.size().users <= 10);
  assert.ok(l.size().ips <= 10);
});

test('prune drops expired entries and keeps active ones', () => {
  const l = createLoginLimiter(opts);
  l.reserve('old', '1.1.1.1', 0);
  l.reserve('new', '2.2.2.2', 900);
  l.prune(1500);
  assert.deepEqual(l.size(), { users: 1, ips: 1 });
});
