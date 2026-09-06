import express from 'express';
import { apiRouter } from './routes/index.js';
import { sessionMiddleware } from './config/session.js';
import { notFound, errorHandler } from './middleware/error.js';

/**
 * Build the Express app WITHOUT starting a listener or opening a DB connection,
 * so tests can exercise it directly (supertest) and server.js owns the wiring.
 */
export function createApp() {
  const app = express();

  app.use(express.json());

  app.use(sessionMiddleware());
  // --- seam: EJS view engine + server-rendered page routes (P3 / P4) ---

  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
