import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { login, logout, me } from '../controllers/auth.controller.js';

export const authRoutes = Router();

authRoutes.post('/login', asyncHandler(login));
authRoutes.post('/logout', asyncHandler(logout));
authRoutes.get('/me', asyncHandler(me));
