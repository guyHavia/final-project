import 'dotenv/config';

/**
 * Friendly fallback for local development only. It's committed to a public
 * repo, so it is not a secret - production and tests never accept it (#13).
 */
export const DEFAULT_SESSION_SECRET = 'dev-insecure-secret-change-me';

/** 512 bits written as hex (4 bits per character), as produced by `openssl rand -hex 64`. */
const MIN_SECRET_LENGTH = 128;

/** Environments that must run with a real 512-bit secret instead of the default. */
const STRICT_SECRET_ENVS = new Set(['production', 'test']);

function isWeakSecret(secret) {
  return secret.length < MIN_SECRET_LENGTH || secret === DEFAULT_SESSION_SECRET;
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

  if (STRICT_SECRET_ENVS.has(nodeEnv) && isWeakSecret(sessionSecret)) {
    throw new Error(
      `Refusing to start: SESSION_SECRET is unset, shorter than ${MIN_SECRET_LENGTH} characters (512 bits) or the committed default while NODE_ENV=${nodeEnv}. ` +
        'Generate one with `openssl rand -hex 64` (see .env.example).'
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
