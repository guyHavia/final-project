import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';

async function main() {
  await connectDb(env.mongoUri);
  const app = createApp();
  app.listen(env.port, () => {
    logger.info('server.listening', { port: env.port, env: env.nodeEnv });
  });
}

main().catch((err) => {
  logger.error('server.startup_failed', { message: err.message });
  process.exitCode = 1;
});
