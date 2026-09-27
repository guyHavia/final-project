import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

let cache = null;
let lastFetch = 0;
let fetchPromise = null; // single-flight: concurrent callers share one in-flight request

/**
 * Fetch Tel Aviv weather, served from a 15-minute server-side cache.
 * Concurrent callers during a cache miss share one upstream request (single-flight).
 *
 * @param {object} [opts]
 * @param {function} [opts.fetchFn=fetch] - injectable fetch for unit tests
 * @returns {Promise<{ tempC: number, description: string, icon: string, observedAt: string }>}
 */
export async function getWeather({ fetchFn = fetch } = {}) {
    const now = Date.now();

    // Serve from cache if still fresh
    if (cache && now - lastFetch < CACHE_TTL) {
        return cache;
    }

    // Single-flight: reuse an in-flight request instead of firing duplicates
    if (fetchPromise) {
        return fetchPromise;
    }

    // Dev / test fallback when no API key is configured
    if (!env.weatherApiKey) {
        cache = { tempC: 25, description: 'Sunny', icon: '01d', observedAt: new Date().toISOString() };
        lastFetch = now;
        return cache;
    }

    fetchPromise = (async () => {
        try {
            const url =
                `https://api.openweathermap.org/data/2.5/weather` +
                `?q=${encodeURIComponent(env.weatherCity)}&units=metric&appid=${env.weatherApiKey}`;

            const res = await fetchFn(url);
            if (!res.ok) {
                throw new Error(`Weather API responded ${res.status}`);
            }

            const data = await res.json();
            cache = {
                tempC: data.main.temp,
                description: data.weather[0].description,
                icon: data.weather[0].icon,
                observedAt: new Date().toISOString(),
            };
            lastFetch = Date.now();
            logger.info('weather.cache.refreshed', { tempC: cache.tempC });
            return cache;
        } catch (err) {
            logger.error('weather.fetch.failed', { message: err.message });
            // Return stale cache if available rather than surfacing the error
            if (cache) return cache;
            throw err;
        } finally {
            fetchPromise = null;
        }
    })();

    return fetchPromise;
}
