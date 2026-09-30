// Preloaded before the test run (see `npm test`). Global test setup lives here.
// Load the committed test config first; dotenv never overrides variables that
// are already set, so this wins over a developer's .env (read later by
// config/env.js) and over anything exported in the shell.
import dotenv from 'dotenv';

process.env.NODE_ENV ??= 'test';
dotenv.config({ path: new URL('./.env.test', import.meta.url), quiet: true });
