import { Router } from 'express';
import { get } from '../controllers/weather.controller.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const weatherRoutes = Router();

weatherRoutes.get('/', asyncHandler(get));
