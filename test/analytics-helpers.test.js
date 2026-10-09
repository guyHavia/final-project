import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { validateRange, markerKindLabel, tickLimit, buildTicks, formatBucketTime } from '../public/js/analytics-helpers.js';

describe('formatBucketTime', () => {
  const ms = new Date(2026, 9, 9, 14, 0).getTime();

  test('an hour bucket reads as a date and an hour, never as epoch milliseconds', () => {
    const text = formatBucketTime(ms, 'hour', 'en-US');
    assert.doesNotMatch(text, /\d{10,}|\d{1,3}(,\d{3}){3,}/);
    assert.match(text, /Oct/);
    assert.match(text, /9/);
    assert.match(text, /2026/);
    assert.match(text, /0?2:00\s?PM|14:00/);
  });

  test('a day bucket reads as a date without a time', () => {
    const text = formatBucketTime(ms, 'day', 'en-US');
    assert.match(text, /Oct/);
    assert.doesNotMatch(text, /:/);
  });
});

describe('validateRange', () => {
  test('accepts empty or ordered ranges', () => {
    assert.equal(validateRange('', ''), null);
    assert.equal(validateRange('2026-08-01T00:00', ''), null);
    assert.equal(validateRange('2026-08-01T00:00', '2026-08-01T00:00'), null);
    assert.equal(validateRange('2026-08-01T00:00', '2026-09-01T00:00'), null);
  });

  test('rejects From later than To with a message', () => {
    assert.match(validateRange('2026-09-01T00:00', '2026-08-01T00:00'), /From.*before.*To/i);
  });

  test('rejects unparseable dates', () => {
    assert.match(validateRange('nonsense', ''), /valid/i);
  });
});

describe('markerKindLabel', () => {
  test('names publish and update markers', () => {
    assert.equal(markerKindLabel('publish'), 'Published');
    assert.equal(markerKindLabel('update'), 'Updated');
  });
});

describe('tickLimit', () => {
  test('fewer ticks on narrow charts, bounded on wide ones', () => {
    assert.equal(tickLimit(320), 4);
    assert.equal(tickLimit(700), 6);
    assert.equal(tickLimit(1200), 8);
  });
});

describe('buildTicks', () => {
  const HOUR = 3600 * 1000;
  const start = new Date(2026, 8, 27, 0, 0).getTime();

  test('hourly ticks land on whole hours, evenly spaced, within the limit', () => {
    const ticks = buildTicks(start + 40 * 60000, start + 3 * 24 * HOUR, 'hour', 6);
    assert.ok(ticks.length >= 2 && ticks.length <= 7);
    for (const t of ticks) assert.equal(new Date(t).getMinutes(), 0);
    const gaps = new Set(ticks.slice(1).map((t, i) => t - ticks[i]));
    assert.equal(gaps.size, 1);
  });

  test('daily ticks land on local midnights', () => {
    const ticks = buildTicks(start, start + 60 * 24 * HOUR, 'day', 6);
    assert.ok(ticks.length <= 7);
    for (const t of ticks) assert.equal(new Date(t).getHours(), 0);
  });

  test('long hourly spans fall back to day-aligned ticks instead of exceeding the limit', () => {
    const ticks = buildTicks(start, start + 11 * 24 * HOUR, 'hour', 4);
    assert.ok(ticks.length <= 5);
    for (const t of ticks) assert.equal(new Date(t).getHours(), 0);
  });

  test('returns nothing for an empty span', () => {
    assert.deepEqual(buildTicks(start, start, 'day', 6), []);
  });
});
