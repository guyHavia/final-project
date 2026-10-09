/** Pure helpers for the Impact Analytics screen (kept DOM-free so they can be unit-tested). */

/** Returns an error message for an invalid From/To pair, or null when the range is usable. */
export function validateRange(fromValue, toValue) {
  const from = fromValue ? new Date(fromValue).getTime() : null;
  const to = toValue ? new Date(toValue).getTime() : null;
  if (Number.isNaN(from) || Number.isNaN(to)) return 'Enter a valid date and time.';
  if (from !== null && to !== null && from > to) return 'From must be before To.';
  return null;
}

const DEFAULT_LOOKBACK_MS = { hour: 24 * 60 * 60 * 1000, day: 7 * 24 * 60 * 60 * 1000 };

/** The From/To range a bucket starts with: hourly shows the last day, daily the last week. */
export function defaultRange(bucket, now = new Date()) {
  const lookback = DEFAULT_LOOKBACK_MS[bucket] ?? DEFAULT_LOOKBACK_MS.hour;
  return { from: new Date(now.getTime() - lookback), to: new Date(now.getTime()) };
}

/** A bucket's start time (ms) as readable text: "Oct 9, 2026, 2:00 PM" for hours, "Oct 9, 2026" for days. */
export function formatBucketTime(ms, bucket, locale) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  if (bucket !== 'day') Object.assign(options, { hour: '2-digit', minute: '2-digit' });
  return new Date(ms).toLocaleString(locale, options);
}

export function markerKindLabel(kind) {
  return kind === 'publish' ? 'Published' : 'Updated';
}

const HOUR_MS = 60 * 60 * 1000;
const HOUR_STEPS = [1, 2, 3, 6, 12, 24];
const DAY_STEPS = [1, 2, 7, 14, 30, 60, 90];

/**
 * Evenly spaced, human-aligned tick timestamps (ms) between min and max, at most `limit` of them.
 * Hourly charts tick on whole hours (steps that divide a day, aligned to local midnight);
 * daily charts tick on local midnights every 1/2/7/14/… days.
 */
export function buildTicks(min, max, bucket, limit) {
  const ticks = [];
  if (!(max > min)) return ticks;
  const spanHours = (max - min) / HOUR_MS;

  const hourStep = bucket === 'hour' ? HOUR_STEPS.find((s) => spanHours / s <= limit) : undefined;
  if (hourStep !== undefined) {
    const step = hourStep;
    const cursor = new Date(min);
    cursor.setMinutes(0, 0, 0);
    cursor.setHours(Math.floor(cursor.getHours() / step) * step);
    while (cursor.getTime() < min) cursor.setHours(cursor.getHours() + step);
    for (; cursor.getTime() <= max; cursor.setHours(cursor.getHours() + step)) ticks.push(cursor.getTime());
    return ticks;
  }

  const step = DAY_STEPS.find((s) => spanHours / 24 / s <= limit) ?? 90;
  const cursor = new Date(min);
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getTime() < min) cursor.setDate(cursor.getDate() + 1);
  for (; cursor.getTime() <= max; cursor.setDate(cursor.getDate() + step)) ticks.push(cursor.getTime());
  return ticks;
}

/** Max x-axis tick count for a chart of the given pixel width, so labels never crowd. */
export function tickLimit(widthPx) {
  if (widthPx < 480) return 4;
  if (widthPx < 900) return 6;
  return 8;
}
