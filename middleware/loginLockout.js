/**
 * Login lockout: after `maxAttempts` failed logins for a username within
 * `windowMs`, that username is locked out for `lockoutMs`. Same in-memory
 * Map style as middleware/rateLimit.js's guest comment limiter (D8) — a
 * restart resetting the counters is harmless.
 */

export const WINDOW_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

/** The shared store used by the real login endpoint. */
export const loginAttempts = new Map();

export function isLockedOut(store, username, now) {
  const entry = store.get(username);
  return !!entry && entry.lockedUntil != null && now < entry.lockedUntil;
}

export function recordFailedLogin(
  store,
  username,
  now,
  windowMs = WINDOW_MS,
  maxAttempts = MAX_ATTEMPTS,
  lockoutMs = LOCKOUT_MS
) {
  const cutoff = now - windowMs;

  // Prune globally so usernames that stop failing don't sit in memory forever.
  for (const [key, entry] of store.entries()) {
    const lockedActive = entry.lockedUntil != null && now < entry.lockedUntil;
    const recent = entry.attempts.filter((t) => t > cutoff);
    if (!lockedActive && recent.length === 0) {
      store.delete(key);
    } else {
      store.set(key, { attempts: recent, lockedUntil: lockedActive ? entry.lockedUntil : null });
    }
  }

  const entry = store.get(username) || { attempts: [], lockedUntil: null };
  const attempts = entry.attempts.filter((t) => t > cutoff);
  attempts.push(now);

  const lockedUntil = attempts.length >= maxAttempts ? now + lockoutMs : entry.lockedUntil;
  store.set(username, { attempts, lockedUntil });
}

export function clearLoginFailures(store, username) {
  store.delete(username);
}
