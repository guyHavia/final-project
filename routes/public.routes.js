import express from 'express';
import { listPublicFeed } from '../services/articleQuery.service.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { q, category, sort } = req.query;
    const result = await listPublicFeed({
      q,
      category,
      sort: sort || 'date',
      limit: 20
    });
    res.render('index', {
      items: result.items,
      nextCursor: result.nextCursor,
      query: { q: q || '', category: category || '', sort: sort || 'date' }
    });
  } catch (err) {
    next(err);
  }
});

export default router;