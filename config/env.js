import 'dotenv/config';

/**
 * Friendly fallback for local dev/test only. It's committed to a public repo,
 * so it is not a secret — production must never run with this value (#13).
 */
export const DEFAULT_SESSION_SECRET = 'dev-insecure-secret-change-me';

/**
 * Build the process configuration from a source of env vars (defaults to
 * `process.env`). Pulled out as a pure function so the production guard
 * below can be unit-tested without touching `process.env` or fighting ESM's
 * module cache.
 */
export function buildEnv(source = process.env) {
  const nodeEnv = source.NODE_ENV ?? 'development';
  const sessionSecret = source.SESSION_SECRET ?? DEFAULT_SESSION_SECRET;

  if (nodeEnv === 'production' && sessionSecret === DEFAULT_SESSION_SECRET) {
    throw new Error(
      'Refusing to start: SESSION_SECRET is unset (or equal to the known dev default) while NODE_ENV=production. ' +
        'Set a real, random SESSION_SECRET before running in production (see .env.example).'
    );
  }

  return {
    nodeEnv,
    port: Number(source.PORT ?? 3000),
    mongoUri: source.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/the-daily-web',
    sessionSecret,
    weatherApiKey: source.WEATHER_API_KEY,
    weatherCity: source.WEATHER_CITY ?? 'Tel Aviv,IL',
  };
}

/** All process configuration, read once. See .env.example. */
export const env = buildEnv();
