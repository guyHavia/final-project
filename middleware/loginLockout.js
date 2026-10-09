/**
 * Login throttling, in memory (same style as middleware/rateLimit.js's guest
 * comment limiter, D8 - a restart resetting the counters is harmless).
 *
 * Two independent counters, both checked and bumped by one synchronous
 * `reserve()` call made BEFORE the async DB lookup + bcrypt, so a parallel
 * burst cannot slip past the limit:
 *  - per username: `maxUserAttempts` attempts within `windowMs` lock that
 *    username for `lockoutMs`;
 *  - per IP: `maxIpAttempts` attempts within `windowMs` lock that IP, so one
 *    client can neither spray many usernames nor keep re-locking a victim.
 *
 * Stores are capped at `maxEntries` (oldest non-locked entry evicted) and
 * swept on a timer by `prune()` - never rescanned per request.
 */

export const WINDOW_MS = 15 * 60 * 1000;
export const LOCKOUT_MS = 15 * 60 * 1000;
export const MAX_USER_ATTEMPTS = 5;
export const MAX_IP_ATTEMPTS = 20;
export const MAX_ENTRIES = 10_000;
export const PRUNE_INTERVAL_MS = 60 * 1000;

export function createLoginLimiter({
  windowMs = WINDOW_MS,
  lockoutMs = LOCKOUT_MS,
  maxUserAttempts = MAX_USER_ATTEMPTS,
  maxIpAttempts = MAX_IP_ATTEMPTS,
  maxEntries = MAX_ENTRIES,
} = {}) {
  const users = new Map();
  const ips = new Map();

  const isLocked = (entry, now) => !!entry && entry.lockedUntil != null && now < entry.lockedUntil;

  function evictOne(store, now) {
    for (const [key, entry] of store) {
      if (!isLocked(entry, now)) {
        store.delete(key);
        return;
      }
    }
    store.delete(store.keys().next().value);
  }

  function bump(store, key, max, now) {
    let entry = store.get(key);
    if (!entry) {
      if (store.size >= maxEntries) evictOne(store, now);
      entry = { attempts: [], lockedUntil: null };
      store.set(key, entry);
    }
    const cutoff = now - windowMs;
    entry.attempts = entry.attempts.filter((t) => t > cutoff);
    entry.attempts.push(now);
    if (entry.attempts.length > max) entry.attempts.shift();
    if (entry.attempts.length >= max) entry.lockedUntil = now + lockoutMs;
  }

  return {
    /** Check both locks and, if free, count this attempt. Synchronous. */
    reserve(username, ip, now = Date.now()) {
      if (isLocked(users.get(username), now) || isLocked(ips.get(ip), now)) {
        return { allowed: false };
      }
      bump(users, username, maxUserAttempts, now);
      bump(ips, ip, maxIpAttempts, now);
      return { allowed: true };
    },

    /** Correct password: forget the username's failures, refund the IP's attempt. */
    succeed(username, ip) {
      users.delete(username);
      const entry = ips.get(ip);
      if (entry) {
        entry.attempts.pop();
        if (entry.attempts.length === 0 && entry.lockedUntil == null) ips.delete(ip);
      }
    },

    /** Drop expired entries. Called on a timer, not per request. */
    prune(now = Date.now()) {
      const cutoff = now - windowMs;
      for (const store of [users, ips]) {
        for (const [key, entry] of store) {
          if (isLocked(entry, now)) continue;
          if (!entry.attempts.some((t) => t > cutoff)) store.delete(key);
        }
      }
    },

    size: () => ({ users: users.size, ips: ips.size }),

    clear() {
      users.clear();
      ips.clear();
    },
  };
}

/** The shared limiter used by the real login endpoint. */
export const loginLimiter = createLoginLimiter();

setInterval(() => loginLimiter.prune(), PRUNE_INTERVAL_MS).unref();
