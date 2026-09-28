import { Router } from 'express';
import { sendData } from '../lib/respond.js';
import { authRoutes } from './auth.routes.js';
import { statsRoutes } from './stats.routes.js';
import { weatherRoutes } from './weather.routes.js';
import { userRoutes } from './users.routes.js';
import commentRoutes from './comment.routes.js';
import { articleRoutes } from './article.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (req, res) => {
  sendData(res, { status: 'ok' });
});

apiRouter.use('/auth', authRoutes);
// Both routers share `/articles`: articleRoutes serves `/`, `/mine` and `/:id`;
// statsRoutes serves `/:id/stats` (P1-07). `/:id` matches one path segment only,
// so the two never collide.
apiRouter.use('/articles', articleRoutes);
apiRouter.use('/articles', statsRoutes);
apiRouter.use('/weather', weatherRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/', commentRoutes); // Maps /articles/:articleId/comments and /comments/:id
