import { Router } from 'express';
import { list, create, remove } from '../controllers/comment.controller.js';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import rateLimit, { assignDeviceId } from '../middleware/rateLimit.js';

const router = Router();

// Article-scoped public routes
router.get('/articles/:articleId/comments', asyncHandler(list));

router.post(
    '/articles/:articleId/comments',
    assignDeviceId,
    rateLimit({ max: 3, windowMs: 60000 }),
    asyncHandler(create)
);

// Global comment management routes
router.delete('/comments/:id', requireRole('editor'), asyncHandler(remove));

export default router;