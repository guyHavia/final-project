import { logger } from '../lib/logger.js';
import { ViewEvent } from '../models/viewEvent.model.js';

/**
 * Record one article view. Fire-and-forget: it never throws into the caller, so
 * a failing insert can never break an article read path. A failure is logged
 * and swallowed.
 */
export async function recordView(articleId) {
  try {
    await ViewEvent.create({ article: articleId });
  } catch (err) {
    logger.error('stats.record_failed', {
      articleId: String(articleId),
      message: err.message,
    });
  }
}
