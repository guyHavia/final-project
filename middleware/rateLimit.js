import crypto from 'node:crypto';
import { AppError } from '../lib/AppError.js';
import { env } from '../config/env.js';

/**
 * Middleware to ensure a deviceId cookie exists.
 * Can be mounted on public page routes to issue the cookie early,
 * and defensively on the comment POST route.
 */
export function assignDeviceId(req, res, next) {
    if (!req.cookies?.deviceId) {
        const deviceId = crypto.randomUUID();
        res.cookie('deviceId', deviceId, {
            httpOnly: true,
            sameSite: 'Lax',
            path: '/',
            maxAge: 365 * 24 * 60 * 60 * 1000, // ≈ 1 year
            secure: env.nodeEnv === 'production'
        });
        
        // Ensure the cookie is available to subsequent middleware in the same request
        if (!req.cookies) req.cookies = {};
        req.cookies.deviceId = deviceId;
    }
    next();
}

/**
 * Pure function to evaluate one key's sliding window and record the hit.
 * Only this key's bucket is touched (O(max)); expired buckets of other keys are
 * removed by `pruneStore`. The store is bounded by `maxKeys`: touching a key moves
 * it to the end of the Map, and when a new key would exceed the cap the
 * least-recently-used key is evicted, so a client that keeps posting cannot be
 * evicted by others minting fresh keys.
 */
export function checkRateLimit(store, key, now, windowMs, maxRequests, maxKeys = Infinity) {
    const cutoff = now - windowMs;
    const timestamps = (store.get(key) || []).filter(t => t > cutoff);

    if (timestamps.length >= maxRequests) {
        return false;
    }

    timestamps.push(now);
    store.delete(key);
    store.set(key, timestamps);
    while (store.size > maxKeys) {
        store.delete(store.keys().next().value);
    }
    return true;
}

/** True when `key` has no room left in the window (records nothing). */
function isLimited(store, key, now, windowMs, maxRequests) {
    const cutoff = now - windowMs;
    return (store.get(key) || []).filter(t => t > cutoff).length >= maxRequests;
}

/** Drops buckets whose timestamps have all expired. Run on an interval. */
export function pruneStore(store, now, windowMs) {
    const cutoff = now - windowMs;
    for (const [key, timestamps] of store.entries()) {
        if (!timestamps.some(t => t > cutoff)) {
            store.delete(key);
        }
    }
}

/**
 * Express middleware factory for guest comment rate limiting.
 * A request must be under BOTH its per-device cap (`max`, keyed on the deviceId
 * cookie) and its per-IP cap (`ipMax`, keyed on `req.ip`). The cookie is
 * client-controlled, so the IP is what stops cookie dropping/forging; `ipMax` is
 * higher than `max` to tolerate several people behind one NAT. `req.ip` honours
 * the app's `trust proxy` setting.
 */
export default function rateLimit({
    windowMs = 60 * 1000,
    max = 3,
    ipMax = 10,
    maxKeys = 10000,
    pruneIntervalMs = 60 * 1000,
    store = new Map(),
    clock = Date
} = {}) {
    setInterval(() => pruneStore(store, clock.now(), windowMs), pruneIntervalMs).unref();

    return (req, res, next) => {
        const deviceId = req.cookies?.deviceId;

        // If no deviceId exists even after defensive assignment, block as a bad request
        if (!deviceId) {
            return next(AppError.badRequest('missing device identifier'));
        }

        const now = clock.now();
        const ipKey = `ip:${req.ip}`;
        const deviceKey = `device:${deviceId}`;

        // Check both before recording either, so a refused request consumes nothing.
        const allowed =
            !isLimited(store, ipKey, now, windowMs, ipMax) &&
            !isLimited(store, deviceKey, now, windowMs, max) &&
            checkRateLimit(store, ipKey, now, windowMs, ipMax, maxKeys) &&
            checkRateLimit(store, deviceKey, now, windowMs, max, maxKeys);

        if (!allowed) {
            return next(AppError.tooManyRequests('you are posting too fast, wait a moment'));
        }

        next();
    };
}