import { Router } from 'express';
import { list, create, update, remove } from '../controllers/comment.controller.js';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import rateLimit, { assignDeviceId } from '../middleware/rateLimit.js';

export const commentRoutes = Router();

// Article-scoped public routes
commentRoutes.get('/articles/:articleId/comments', asyncHandler(list));

commentRoutes.post(
  '/articles/:articleId/comments',
  assignDeviceId,
  rateLimit({ max: 3, windowMs: 60000 }),
  asyncHandler(create),
);

// Global comment management routes
commentRoutes.patch('/comments/:id', requireRole('editor'), asyncHandler(update));
commentRoutes.delete('/comments/:id', requireRole('editor'), asyncHandler(remove));
