import { Article, PUBLIC_FILTER } from '../models/article.model.js';
import { isObjectId } from '../lib/query.js';
import { logger } from '../lib/logger.js';
import { recordView } from './stats.service.js';

/**
 * P2-08 — count one read of a public article. P3's `GET /article/:slug` page
 * calls this once per render (D10); nothing else does — not the JSON API, not
 * comment loads.
 *
 *   await recordArticleView(article.id, { viewer: req.user });
 *
 * Two writes per counted view:
 * 1. `viewCount + 1` on the article — the key for `sort=popularity`. An atomic
 *    `$inc`, so simultaneous readers are never lost. `timestamps: false` keeps
 *    `updatedAt` unchanged, so reading an article never reorders the newsroom
 *    lists ("most recently updated").
 * 2. One `ViewEvent` via P1's `recordView` — the time series behind the Impact
 *    Analytics graph.
 *
 * Not counted: logged-in staff (`viewer` set — only reporters and editors can
 * log in), and anything that isn't a public article. Every entry by a reader
 * counts, refreshes included, as the brief says.
 *
 * Never throws: a failure is logged and the page still renders. Resolves to
 * `true` when the view was counted.
 */
export async function recordArticleView(articleId, { viewer } = {}) {
  if (viewer) return false;
  if (!isObjectId(articleId)) return false;

  try {
    const { modifiedCount } = await Article.updateOne(
      { _id: articleId, ...PUBLIC_FILTER },
      { $inc: { viewCount: 1 } },
      { timestamps: false },
    );
    if (modifiedCount === 0) return false;
  } catch (err) {
    logger.error('article.view_count_failed', { articleId: String(articleId), message: err.message });
    return false;
  }

  await recordView(articleId);
  return true;
}
