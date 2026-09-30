import { Router } from 'express';
import { list, prepare, create, remove } from '../controllers/comment.controller.js';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import rateLimit, { assignDeviceId } from '../middleware/rateLimit.js';

const router = Router();

// Exported so tests can reset the guest comment quota between cases.
export const commentRateLimitStore = new Map();

// Article-scoped public routes
router.get('/articles/:articleId/comments', asyncHandler(list));

router.post(
    '/articles/:articleId/comments',
    assignDeviceId,
    // Validate first (404 / 400) so rejected posts don't consume quota.
    asyncHandler(prepare),
    rateLimit({ max: 3, ipMax: 10, windowMs: 60000, store: commentRateLimitStore }),
    asyncHandler(create)
);

// Global comment management routes
router.delete('/comments/:id', requireRole('editor'), asyncHandler(remove));

export default router;