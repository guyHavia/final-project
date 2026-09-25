import crypto from 'node:crypto';
import AppError from '../lib/AppError.js';

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
            secure: process.env.NODE_ENV === 'production'
        });
        
        // Ensure the cookie is available to subsequent middleware in the same request
        if (!req.cookies) req.cookies = {};
        req.cookies.deviceId = deviceId;
    }
    next();
}

/**
 * Pure function to evaluate rate limits and clear empty buckets.
 */
export function checkRateLimit(store, deviceId, now, windowMs, maxRequests) {
    const cutoff = now - windowMs;

    // Prune empty buckets globally to prevent memory leaks
    for (const [key, timestamps] of store.entries()) {
        const validTimestamps = timestamps.filter(t => t > cutoff);
        if (validTimestamps.length === 0) {
            store.delete(key);
        } else {
            store.set(key, validTimestamps);
        }
    }

    const timestamps = store.get(deviceId) || [];
    if (timestamps.length >= maxRequests) {
        return false;
    }

    timestamps.push(now);
    store.set(deviceId, timestamps);
    return true;
}

/**
 * Express middleware factory for guest comment rate limiting.
 */
export default function rateLimit({
    windowMs = 60 * 1000,
    max = 3,
    store = new Map(),
    clock = Date
} = {}) {
    return (req, res, next) => {
        const deviceId = req.cookies?.deviceId;

        // If no deviceId exists even after defensive assignment, block as a bad request
        if (!deviceId) {
            return next(AppError.badRequest('missing device identifier'));
        }

        const allowed = checkRateLimit(store, deviceId, clock.now(), windowMs, max);

        if (!allowed) {
            return next(AppError.tooManyRequests('you are posting too fast, wait a moment'));
        }

        next();
    };
}