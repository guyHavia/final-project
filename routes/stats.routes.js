import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { getArticleStats } from '../controllers/stats.controller.js';

// Mounted at `/articles` in routes/index.js, so the full path is
// `GET /api/articles/:id/stats`. A dedicated router because P2's full
// `/api/articles` router doesn't exist in this codebase yet.
export const statsRoutes = Router();

statsRoutes.get('/:id/stats', requireRole('editor'), getArticleStats);
