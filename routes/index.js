import { Router } from 'express';
import { sendData } from '../lib/respond.js';

export const apiRouter = Router();

apiRouter.get('/health', (req, res) => {
  sendData(res, { status: 'ok' });
});

// Resource routers mount here as they land:
//   apiRouter.use('/auth', authRouter);        // P1
//   apiRouter.use('/users', userRouter);       // P5
//   apiRouter.use('/articles', articleRouter); // P2 (+ comments, stats nested)
