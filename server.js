import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main() {
  await connectDb(env.mongoUri);
  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info('server.listening', { port: env.port, env: env.nodeEnv });
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('server.shutting_down', { signal });
    // Force-exit if open keep-alive connections stall the graceful close.
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
    server.close(async () => {
      await mongoose.disconnect().catch(() => {});
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// A rejected promise nobody handled leaves the process in an unknown state:
// log it and exit non-zero so the supervisor restarts a clean process.
process.on('unhandledRejection', (reason) => {
  logger.error('process.unhandled_rejection', {
    message: reason?.message ?? String(reason),
    stack: reason?.stack,
  });
  process.exit(1);
});

main().catch((err) => {
  logger.error('server.startup_failed', { message: err.message });
  process.exitCode = 1;
});
