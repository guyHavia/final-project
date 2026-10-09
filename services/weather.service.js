import { env } from '../config/env.js';
import { AppError } from '../lib/AppError.js';
import { logger as defaultLogger } from '../lib/logger.js';

const CACHE_TTL = 15 * 60 * 1000; // CONTEXT.md: no older than 15 minutes
const FAILURE_BACKOFF_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const ENDPOINT = 'https://api.openweathermap.org/data/2.5/weather';

const unavailable = () => AppError.serviceUnavailable('weather unavailable');

/**
 * Weather source with a 15-minute cache. Upstream is contacted at most once per
 * TTL window while it is healthy, and at most once a minute after a failure;
 * data older than the TTL is never served.
 */
export function createWeatherService({
  fetchFn = fetch,
  now = Date.now,
  getConfig = () => ({ apiKey: env.weatherApiKey, city: env.weatherCity }),
  logger = defaultLogger,
} = {}) {
  let cache = null;
  let lastAttempt = null;
  let inflight = null;

  async function fetchUpstream({ apiKey, city }) {
    const params = new URLSearchParams({ q: city, units: 'metric', appid: apiKey });
    const res = await fetchFn(`${ENDPOINT}?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`weather upstream returned ${res.status}`);
    }
    const body = await res.json();
    const temp = body?.main?.temp;
    const entry = body?.weather?.[0];
    if (typeof temp !== 'number' || !entry) {
      throw new Error('weather upstream returned an unexpected payload');
    }
    return {
      city: typeof body.name === 'string' && body.name ? body.name : city.split(',')[0],
      tempC: temp,
      description: entry.description,
      icon: entry.icon,
      observedAt: new Date(now()).toISOString(),
    };
  }

  async function refresh(config) {
    lastAttempt = now(); // advance on success AND failure: backoff
    try {
      cache = { data: await fetchUpstream(config), at: lastAttempt };
      return cache.data;
    } catch (err) {
      // Never log the key: the message can echo the URL, so log the error name only.
      logger.error('weather.fetch_failed', {
        reason: err.name === 'TimeoutError' ? 'timeout' : err.message.replaceAll(config.apiKey, '[redacted]'),
      });
      throw unavailable();
    } finally {
      inflight = null;
    }
  }

  async function getWeather() {
    const config = getConfig();
    if (!config.apiKey) {
      throw unavailable();
    }

    const t = now();
    if (cache && t - cache.at < CACHE_TTL) {
      return cache.data;
    }
    if (inflight) {
      return inflight;
    }
    if (lastAttempt !== null && t - lastAttempt < FAILURE_BACKOFF_MS) {
      throw unavailable(); // recent failed attempt; do not hammer upstream
    }

    inflight = refresh(config);
    return inflight;
  }

  return { getWeather };
}

const defaultService = createWeatherService();

export const getWeather = () => defaultService.getWeather();
