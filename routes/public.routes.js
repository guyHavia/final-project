import express from 'express';
import { listPublicFeed, getArticleForRender } from '../services/articleQuery.service.js';
import { recordArticleView } from '../services/articleViews.service.js';

const router = express.Router();

/** The sidebar's "Most read" list: the 5 public articles with the most views. */
async function mostRead() {
  const { items } = await listPublicFeed({ sort: 'popularity', limit: 5 });
  return items;
}

router.get('/favicon.ico', (req, res) => res.redirect(301, '/favicon-32.png'));

router.get('/', async (req, res, next) => {
  try {
    const { q, category, sort } = req.query;
    const [result, popular] = await Promise.all([
      listPublicFeed({
        q,
        category,
        sort: sort || 'date',
        limit: 20
      }),
      mostRead()
    ]);
    res.render('index', {
      items: result.items,
      nextCursor: result.nextCursor,
      query: { q: q || '', category: category || '', sort: sort || 'date' },
      mostRead: popular,
      activeCategory: category || ''
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

    // Counted server-side, once per device per 30 minutes. Logged-in
    // staff (req.user) are not counted; this also bumps viewCount for popularity.
    await recordArticleView(article.id, { viewer: req.user, deviceId: req.cookies?.deviceId });

    res.render('article', { article, mostRead: await mostRead(), activeCategory: article.category });
  } catch (err) {
    next(err);
  }
});

export default router;
