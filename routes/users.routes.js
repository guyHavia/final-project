import { Router } from 'express';
import { create, list, getOne, update, remove, updateMe } from '../controllers/users.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const userRoutes = Router();

userRoutes.patch('/me', requireAuth, asyncHandler(updateMe));

userRoutes.post('/', requireRole('editor'), asyncHandler(create));
userRoutes.get('/', requireRole('editor'), asyncHandler(list));
userRoutes.get('/:id', requireRole('editor'), asyncHandler(getOne));
userRoutes.patch('/:id', requireRole('editor'), asyncHandler(update));
userRoutes.delete('/:id', requireRole('editor'), asyncHandler(remove));
