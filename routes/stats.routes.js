import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import {
  getArticleStats,
  listArticleViews,
  getViewRecord,
  updateViewRecord,
  deleteViewRecord,
} from '../controllers/stats.controller.js';

// Mounted at `/articles` in routes/index.js, so the full paths are
// `GET /api/articles/:id/stats` and `GET /api/articles/:id/views`.
export const statsRoutes = Router();

statsRoutes.get('/:id/stats', requireRole('editor'), asyncHandler(getArticleStats));
statsRoutes.get('/:id/views', requireRole('editor'), asyncHandler(listArticleViews));

// Mounted at `/views`: one view record by id. Created by the article page render.
export const viewRoutes = Router();

viewRoutes.get('/:id', requireRole('editor'), asyncHandler(getViewRecord));
viewRoutes.patch('/:id', requireRole('editor'), asyncHandler(updateViewRecord));
viewRoutes.delete('/:id', requireRole('editor'), asyncHandler(deleteViewRecord));
