import { Article, PUBLIC_FILTER } from '../models/article.model.js';
import { ViewSeen, VIEW_DEDUP_WINDOW_MS } from '../models/viewSeen.model.js';
import { isObjectId } from '../lib/query.js';
import { logger } from '../lib/logger.js';
import { recordView } from './stats.service.js';

export { VIEW_DEDUP_WINDOW_MS };

const DUPLICATE_KEY_CODE = 11000;
const MAX_DEVICE_ID_LENGTH = 100;

/**
 * Claims this device's view of this article for the dedup window. The filter
 * matches only an expired claim; when a fresh one exists the upsert tries to
 * insert the same `_id` and fails with a duplicate key, so concurrent requests
 * from one device can never all win. Resolves `true` when the view should count.
 * If the bookkeeping itself fails, the view is counted rather than lost.
 */
async function claimView(articleId, deviceId, now) {
  try {
    await ViewSeen.updateOne(
      { _id: `${articleId}:${deviceId}`, at: { $lte: new Date(now.getTime() - VIEW_DEDUP_WINDOW_MS) } },
      { $set: { at: now } },
      { upsert: true },
    );
    return true;
  } catch (err) {
    if (err?.code === DUPLICATE_KEY_CODE) return false;
    logger.error('article.view_dedup_failed', { articleId: String(articleId), message: err.message });
    return true;
  }
}

/**
 * P2-08 - count one read of a public article. P3's `GET /article/:slug` page
 * calls this once per render (D10); nothing else does - not the JSON API, not
 * comment loads.
 *
 *   await recordArticleView(article.id, { viewer: req.user });
 *
 * Two writes per counted view:
 * 1. `viewCount + 1` on the article - the key for `sort=popularity`. An atomic
 *    `$inc`, so simultaneous readers are never lost. `timestamps: false` keeps
 *    `updatedAt` unchanged, so reading an article never reorders the newsroom
 *    lists ("most recently updated").
 * 2. One `ViewEvent` via P1's `recordView` - the time series behind the Impact
 *    Analytics graph.
 *
 * Not counted: logged-in staff (`viewer` set - only reporters and editors can
 * log in), anything that isn't a public article, and a repeat entry by the same
 * device (`deviceId`, the guest cookie) within VIEW_DEDUP_WINDOW_MS - so
 * refreshing does not inflate the count, while a reader who comes back later is
 * a new visit. Without a `deviceId` every call counts.
 *
 * Never throws: a failure is logged and the page still renders. Resolves to
 * `true` when the view was counted.
 */
export async function recordArticleView(articleId, { viewer, deviceId, now = new Date() } = {}) {
  if (viewer) return false;
  if (!isObjectId(articleId)) return false;
  const hasDevice = typeof deviceId === 'string' && deviceId.length > 0 && deviceId.length <= MAX_DEVICE_ID_LENGTH;
  if (hasDevice && !(await claimView(articleId, deviceId, now))) return false;

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
