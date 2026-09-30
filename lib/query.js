import mongoose from 'mongoose';

/** Escapes regex special characters so a search for "(" or ".*" matches that text literally. */
export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True for an ObjectId instance or a 24-character hex string. */
export function isObjectId(value) {
  if (value instanceof mongoose.Types.ObjectId) return true;
  return typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value);
}

/** `raw` → an integer in 1..maxLimit; anything non-numeric → defaultLimit. */
export function clampLimit(raw, { defaultLimit, maxLimit }) {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return defaultLimit;
  return Math.min(maxLimit, Math.max(1, n));
}
