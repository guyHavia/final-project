import express from 'express';
import { apiRouter } from './routes/index.js';
import { sessionMiddleware } from './config/session.js';
import { loadUser } from './middleware/auth.js';
import { parseCookies } from './middleware/cookies.js';
import { asyncHandler } from './lib/asyncHandler.js';
import { notFound, errorHandler } from './middleware/error.js';

/**
 * Build the Express app WITHOUT starting a listener or opening a DB connection,
 * so tests can exercise it directly (supertest) and server.js owns the wiring.
 */
export function createApp() {
  const app = express();

  app.use(express.json());
  // Fills req.cookies — the comment rate limit reads the guest's deviceId from it.
  app.use(parseCookies);

  app.use(sessionMiddleware());
  app.use(asyncHandler(loadUser));
  // --- seam: EJS view engine + server-rendered page routes (P3 / P4) ---

  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
