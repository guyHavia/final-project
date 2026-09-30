import path from 'node:path';
import express from 'express';
import { apiRouter } from './routes/index.js';
import { sessionMiddleware } from './config/session.js';
import { loadUser } from './middleware/auth.js';
import { asyncHandler } from './lib/asyncHandler.js';
import { notFound, errorHandler } from './middleware/error.js';
import { newsroomRouter } from './routes/newsroom.routes.js';

import cookieParser from 'cookie-parser';
import { assignDeviceId } from './middleware/rateLimit.js';

/**
 * Build the Express app WITHOUT starting a listener or opening a DB connection,
 * so tests can exercise it directly (supertest) and server.js owns the wiring.
 */
export function createApp() {
  const app = express();

  // req.ip feeds the comment rate limiter. Untrusted by default (X-Forwarded-For is
  // ignored, so it can't be forged); behind a reverse proxy set TRUST_PROXY to the
  // number of proxy hops (e.g. 1) so req.ip is the real client address.
  if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.set('trust proxy', Number.isInteger(hops) ? hops : process.env.TRUST_PROXY);
  }

  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use(assignDeviceId);

  app.use(sessionMiddleware());
  app.use(asyncHandler(loadUser));
  // --- seam: EJS view engine + server-rendered page routes (P3 / P4) ---
  app.set('view engine', 'ejs');
  app.set('views', path.join(import.meta.dirname, 'views'));
  app.use(express.static(path.join(import.meta.dirname, 'public')));

  app.use(newsroomRouter); // P4: /login, /newsroom, /newsroom/review, /newsroom/analytics
  // P3 mounts their own page router (/, /article/:slug) here too.

  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
