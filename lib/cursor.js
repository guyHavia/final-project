import { Buffer } from 'node:buffer';
import { isObjectId } from './query.js';

/**
 * Keyset-pagination cursor: the last item's sort value `v` and its `_id`, so the
 * next page starts strictly after that item. Opaque to clients (base64url JSON).
 * A Date is tagged as `{ d: ISOString }` so it round-trips as a Date, not a string.
 */

export function encodeCursor({ v, id }) {
  const value = v instanceof Date ? { d: v.toISOString() } : v;
  return Buffer.from(JSON.stringify({ v: value, id: String(id) })).toString('base64url');
}

/** Returns `{ v: Date | number, id }`, or `null` for anything malformed. Never throws. */
export function decodeCursor(cursor) {
  if (typeof cursor !== 'string' || cursor === '') return null;

  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const { v, id } = parsed;
  if (typeof id !== 'string' || !isObjectId(id)) return null;

  if (typeof v === 'number' && Number.isFinite(v)) return { v, id };
  if (v && typeof v === 'object' && typeof v.d === 'string') {
    const date = new Date(v.d);
    if (!Number.isNaN(date.getTime())) return { v: date, id };
  }
  return null;
}
