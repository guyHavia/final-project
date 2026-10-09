// Preloaded before the test run (see `npm test`). Global test setup lives here.
// Runs before config/env.js reads a developer's .env, and dotenv never
// overrides variables that are already set, so these test values win over
// .env (anything exported in the shell still wins over them).
// No secrets are committed here: the session secret is generated per run, and
// DB tests use mongodb-memory-server, so MONGODB_URI is only a placeholder.
import { randomBytes } from 'node:crypto';

const TEST_ENV = {
  NODE_ENV: 'test',
  PORT: '3000',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/the-daily-web-test',
  SESSION_SECRET: randomBytes(64).toString('hex'),
  // Empty, not unset: an unset key would be filled from .env, and tests must
  // never call the real weather upstream.
  WEATHER_API_KEY: '',
  WEATHER_CITY: 'Tel Aviv,IL',
  TRUST_PROXY: '',
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] ??= value;
}
