import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  listArticles,
  listMyArticles,
  getArticle,
  createArticleHandler,
  editArticleHandler,
  autosaveArticleHandler,
  submitArticleHandler,
} from '../controllers/article.controller.js';

// Mounted at `/articles` in routes/index.js. `/mine` is declared before `/:id`
// so it is not captured as an id.
export const articleRoutes = Router();

articleRoutes.get('/', asyncHandler(listArticles));
articleRoutes.get('/mine', requireAuth, asyncHandler(listMyArticles));
articleRoutes.get('/:id', asyncHandler(getArticle));

// P2-03 — reporter authoring (reporters and editors).
articleRoutes.post('/', requireAuth, asyncHandler(createArticleHandler));
articleRoutes.patch('/:id', requireAuth, asyncHandler(editArticleHandler));
articleRoutes.patch('/:id/autosave', requireAuth, asyncHandler(autosaveArticleHandler));
articleRoutes.post('/:id/submit', requireAuth, asyncHandler(submitArticleHandler));
