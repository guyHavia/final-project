import test from 'node:test';
import assert from 'node:assert/strict';
import { isLockedOut, recordFailedLogin, clearLoginFailures } from '../middleware/loginLockout.js';

test('recordFailedLogin locks out after maxAttempts within the window, isLockedOut reports it', () => {
  const store = new Map();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;
  const lockoutMs = 15 * 60 * 1000;
  let now = 1_000_000;

  for (let i = 0; i < 4; i += 1) {
    recordFailedLogin(store, 'alice', now, windowMs, maxAttempts, lockoutMs);
    assert.equal(isLockedOut(store, 'alice', now), false, `not locked after ${i + 1} attempts`);
  }

  recordFailedLogin(store, 'alice', now, windowMs, maxAttempts, lockoutMs);
  assert.equal(isLockedOut(store, 'alice', now), true, 'locked after the 5th attempt');
});

test('lockout expires after lockoutMs', () => {
  const store = new Map();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;
  const lockoutMs = 15 * 60 * 1000;
  let now = 1_000_000;

  for (let i = 0; i < 5; i += 1) {
    recordFailedLogin(store, 'bob', now, windowMs, maxAttempts, lockoutMs);
  }
  assert.equal(isLockedOut(store, 'bob', now), true);

  now += lockoutMs + 1;
  assert.equal(isLockedOut(store, 'bob', now), false, 'unlocked once lockoutMs has passed');
});

test('attempts older than the window do not count toward the threshold', () => {
  const store = new Map();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;
  const lockoutMs = 15 * 60 * 1000;
  let now = 1_000_000;

  for (let i = 0; i < 4; i += 1) {
    recordFailedLogin(store, 'carol', now, windowMs, maxAttempts, lockoutMs);
  }

  now += windowMs + 1; // the 4 earlier attempts age out
  recordFailedLogin(store, 'carol', now, windowMs, maxAttempts, lockoutMs);
  assert.equal(isLockedOut(store, 'carol', now), false, 'only 1 attempt inside the current window');
});

test('clearLoginFailures resets a username so the next failure starts a fresh count', () => {
  const store = new Map();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;
  const lockoutMs = 15 * 60 * 1000;
  const now = 1_000_000;

  for (let i = 0; i < 5; i += 1) {
    recordFailedLogin(store, 'dave', now, windowMs, maxAttempts, lockoutMs);
  }
  assert.equal(isLockedOut(store, 'dave', now), true);

  clearLoginFailures(store, 'dave');
  assert.equal(isLockedOut(store, 'dave', now), false);

  recordFailedLogin(store, 'dave', now, windowMs, maxAttempts, lockoutMs);
  assert.equal(isLockedOut(store, 'dave', now), false, 'one failure after a clear is not a lockout');
});

test('a different username is never affected by another username\'s failures', () => {
  const store = new Map();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;
  const lockoutMs = 15 * 60 * 1000;
  const now = 1_000_000;

  for (let i = 0; i < 5; i += 1) {
    recordFailedLogin(store, 'eve', now, windowMs, maxAttempts, lockoutMs);
  }
  assert.equal(isLockedOut(store, 'eve', now), true);
  assert.equal(isLockedOut(store, 'frank', now), false);
});
