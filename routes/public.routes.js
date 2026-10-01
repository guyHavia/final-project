import express from 'express';
import { listPublicFeed, getArticleForRender } from '../services/articleQuery.service.js';
import { recordView } from '../services/stats.service.js';

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

router.get('/article/:slug', async (req, res, next) => {
  try {
    const article = await getArticleForRender(req.params.slug);
    if (!article) {
      return res.status(404).render('404');
    }

    // D10 & P2-08: Record view once server-side per full render
    await recordView(article.id);

    res.render('article', { article });
  } catch (err) {
    next(err);
  }
});

export default router;