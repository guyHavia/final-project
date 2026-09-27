import { Router } from 'express';
import { sendData } from '../lib/respond.js';
import { authRoutes } from './auth.routes.js';
import { statsRoutes } from './stats.routes.js';
import { weatherRoutes } from './weather.routes.js';
import { userRoutes } from './users.routes.js';
import commentRoutes from './comment.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (req, res) => {
  sendData(res, { status: 'ok' });
});

apiRouter.use('/auth', authRoutes);
// P1-07: stats.routes.js defines GET /:id/stats, so this serves
// GET /api/articles/:id/stats. P2's full articles router will mount here too.
apiRouter.use('/articles', statsRoutes);
apiRouter.use('/weather', weatherRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/', commentRoutes); // Maps /articles/:articleId/comments and /comments/:id

