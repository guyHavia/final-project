import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createSaveIndicator } from '../public/js/save-indicator.js';

/** A save() whose resolution/rejection you control by hand, to pin down in-flight timing. */
function deferredSave() {
  let resolve;
  let reject;
  const calls = [];
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const save = (snapshot) => {
    calls.push(snapshot);
    return promise;
  };
  return { save, calls, resolve, reject };
}

describe('createSaveIndicator', () => {
  test('a successful save goes dirty -> saving -> saved', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const states = [];
    const { save, calls, resolve } = deferredSave();
    const indicator = createSaveIndicator({ save, onStateChange: (s) => states.push(s.state), debounceMs: 100 });

    indicator.notify(() => ({ title: 'a' }));
    assert.deepEqual(states, ['dirty']);

    t.mock.timers.tick(100);
    assert.deepEqual(states, ['dirty', 'saving']);
    assert.deepEqual(calls, [{ title: 'a' }]);

    resolve({ savedAt: '2026-01-01T00:00:00.000Z' });
    await Promise.resolve().then().then(); // let the microtask queue drain

    assert.deepEqual(states, ['dirty', 'saving', 'saved']);
    assert.equal(indicator.getState().savedAt.toISOString(), '2026-01-01T00:00:00.000Z');
  });

  test('a failed save goes dirty -> saving -> error and keeps the buffer for retry', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const states = [];
    const { save, reject } = deferredSave();
    const indicator = createSaveIndicator({ save, onStateChange: (s) => states.push(s.state), debounceMs: 100 });

    indicator.notify(() => ({ title: 'a' }));
    t.mock.timers.tick(100);
    reject(new Error('network down'));
    await Promise.resolve().then().then();

    assert.deepEqual(states, ['dirty', 'saving', 'error']);
    assert.equal(indicator.getState().errorMessage, 'network down');
  });

  test('input arriving while a save is in flight coalesces into a second save', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const states = [];
    const first = deferredSave();
    const snapshots = [{ title: 'first' }, { title: 'second' }];
    let call = 0;
    const seen = [];
    const save = (snapshot) => {
      seen.push(snapshot);
      call += 1;
      return call === 1 ? first.promise : Promise.resolve({ savedAt: '2026-01-01T00:00:01.000Z' });
    };
    const indicator = createSaveIndicator({ save, onStateChange: (s) => states.push(s.state), debounceMs: 100 });

    indicator.notify(() => snapshots[0]);
    t.mock.timers.tick(100); // first save starts
    assert.deepEqual(states, ['dirty', 'saving']);

    indicator.notify(() => snapshots[1]); // arrives mid-flight
    assert.deepEqual(states, ['dirty', 'saving', 'dirty']); // visible as dirty again
    t.mock.timers.tick(100); // debounce for the second edit elapses while still in flight -> coalesced, no new state yet
    assert.deepEqual(states, ['dirty', 'saving', 'dirty']);

    first.resolve({ savedAt: '2026-01-01T00:00:00.000Z' });
    await Promise.resolve().then().then().then();

    // the coalesced save runs automatically once the first resolves
    assert.deepEqual(states, ['dirty', 'saving', 'dirty', 'saving', 'saved']);
    assert.deepEqual(seen, [snapshots[0], snapshots[1]]);
  });

  test('flush forces a save immediately, without waiting for the debounce', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const states = [];
    const { save, resolve } = deferredSave();
    const indicator = createSaveIndicator({ save, onStateChange: (s) => states.push(s.state), debounceMs: 100_000 });

    indicator.notify(() => ({ title: 'a' }));
    assert.deepEqual(states, ['dirty']);

    const flushed = indicator.flush();
    assert.deepEqual(states, ['dirty', 'saving']);

    resolve({ savedAt: '2026-01-01T00:00:00.000Z' });
    await flushed;

    assert.deepEqual(states, ['dirty', 'saving', 'saved']);
  });

  test('flush is a no-op when there is nothing pending', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const states = [];
    const save = () => Promise.resolve({ savedAt: '2026-01-01T00:00:00.000Z' });
    const indicator = createSaveIndicator({ save, onStateChange: (s) => states.push(s.state), debounceMs: 100 });

    await indicator.flush();

    assert.deepEqual(states, []);
  });
});
