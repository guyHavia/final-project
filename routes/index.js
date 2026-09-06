import { Router } from 'express';
import { sendData } from '../lib/respond.js';
import { authRoutes } from './auth.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (req, res) => {
  sendData(res, { status: 'ok' });
});

apiRouter.use('/auth', authRoutes);

// Resource routers mount here as they land:
//   apiRouter.use('/users', userRouter);       // P5
//   apiRouter.use('/articles', articleRouter); // P2 (+ comments, stats nested)
