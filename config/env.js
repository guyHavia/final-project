import 'dotenv/config';

/**
 * Friendly fallback for local dev/test only. It's committed to a public repo,
 * so it is not a secret - production must never run with this value (#13).
 */
export const DEFAULT_SESSION_SECRET = 'dev-insecure-secret-change-me';

/** Secret committed in test.preload.js; public, so never acceptable in production. */
export const TEST_SESSION_SECRET = 'test-only-dummy-secret-do-not-use-elsewhere';

const MIN_PRODUCTION_SECRET_LENGTH = 32;

function isWeakSecret(secret) {
  return (
    secret.length < MIN_PRODUCTION_SECRET_LENGTH ||
    secret === DEFAULT_SESSION_SECRET ||
    secret === TEST_SESSION_SECRET
  );
}

/**
 * TRUST_PROXY env -> Express 'trust proxy' value. Unset -> false; digits -> hop
 * count; 'true'/'false' -> boolean; anything else (e.g. 'loopback', a CIDR) passes through.
 */
function parseTrustProxy(raw) {
  if (raw === undefined || raw === '') return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

/**
 * Build the process configuration from a source of env vars (defaults to
 * `process.env`). Pulled out as a pure function so the production guard
 * below can be unit-tested without touching `process.env` or fighting ESM's
 * module cache.
 */
export function buildEnv(source = process.env) {
  const nodeEnv = source.NODE_ENV ?? 'development';
  const sessionSecret = source.SESSION_SECRET ?? DEFAULT_SESSION_SECRET;

  if (nodeEnv === 'production' && isWeakSecret(sessionSecret)) {
    throw new Error(
      `Refusing to start: SESSION_SECRET is unset, too short (< ${MIN_PRODUCTION_SECRET_LENGTH} chars) or a known committed value while NODE_ENV=production. ` +
        'Set a real, random SESSION_SECRET before running in production (see .env.example).'
    );
  }

  return {
    nodeEnv,
    port: Number(source.PORT ?? 3000),
    mongoUri: source.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/the-daily-web',
    sessionSecret,
    trustProxy: parseTrustProxy(source.TRUST_PROXY),
    weatherApiKey: source.WEATHER_API_KEY,
    weatherCity: source.WEATHER_CITY ?? 'Tel Aviv,IL',
    seedPassword: source.SEED_PASSWORD,
  };
}

/** All process configuration, read once. See .env.example. */
export const env = buildEnv();
