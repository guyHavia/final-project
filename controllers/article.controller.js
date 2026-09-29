import { sendData } from '../lib/respond.js';
import {
  listPublicFeed,
  listNewsroom,
  listMine,
  getArticleForViewer,
} from '../services/articleQuery.service.js';

/**
 * GET /api/articles — the public feed for everyone. An editor who sends `state`
 * (one of the four states, or `all`) gets the newsroom view instead; for anyone
 * else `state` is ignored, so the feed can never expose unpublished work.
 */
export async function listArticles(req, res) {
  const { q, category, sort, cursor, limit, state } = req.query;
  const wantsNewsroom = req.user?.role === 'editor' && state !== undefined && state !== '';

  const page = wantsNewsroom
    ? await listNewsroom({ state, q, category, cursor, limit })
    : await listPublicFeed({ q, category, sort, cursor, limit });
  sendData(res, page);
}

/** GET /api/articles/mine — the caller's own articles, any state. Behind `requireAuth`. */
export async function listMyArticles(req, res) {
  const { state, cursor, limit } = req.query;
  sendData(res, await listMine(req.user._id, { state, cursor, limit }));
}

/** GET /api/articles/:id — full document for its author or an editor, published version for everyone else. */
export async function getArticle(req, res) {
  sendData(res, await getArticleForViewer(req.params.id, req.user));
}
