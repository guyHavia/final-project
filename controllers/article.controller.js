import { sendData } from '../lib/respond.js';
import {
  listPublicFeed,
  listNewsroom,
  listMine,
  getArticleForViewer,
} from '../services/articleQuery.service.js';
import {
  createArticle,
  editArticle,
  autosaveArticle,
  submitArticle,
} from '../services/articleAuthoring.service.js';
import { approveArticle, returnArticle, deleteArticle } from '../services/articleReview.service.js';

/**
 * GET /api/articles — the public feed for everyone. An editor who sends `state`
 * (one of the four states, or `all`) gets the newsroom view instead; for anyone
 * else `state` is ignored, so the feed can never expose unpublished work.
 */
export async function listArticles(req, res) {
  const { q, category, sort, order, cursor, limit, state } = req.query;
  const wantsNewsroom = req.user?.role === 'editor' && state !== undefined && state !== '';

  const page = wantsNewsroom
    ? await listNewsroom({ state, q, category, cursor, limit })
    : await listPublicFeed({ q, category, sort, order, cursor, limit });
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

// --- P2-03: reporter authoring. All behind `requireAuth`; the service enforces
// ownership and state rules, so the controllers only pass the session user on.

/** POST /api/articles — 201 with the new article (In Preparation). */
export async function createArticleHandler(req, res) {
  sendData(res, await createArticle(req.user, req.body), 201);
}

/** PATCH /api/articles/:id — full edit of the working copy. */
export async function editArticleHandler(req, res) {
  sendData(res, await editArticle(req.params.id, req.user, req.body));
}

/** PATCH /api/articles/:id/autosave — `{ id, savedAt }`. */
export async function autosaveArticleHandler(req, res) {
  sendData(res, await autosaveArticle(req.params.id, req.user, req.body));
}

/** POST /api/articles/:id/submit — to Pending Editor Approval. */
export async function submitArticleHandler(req, res) {
  sendData(res, await submitArticle(req.params.id, req.user));
}

// --- P2-04: editor decisions. Behind `requireRole('editor')`.

/** POST /api/articles/:id/approve — Pending → Published. */
export async function approveArticleHandler(req, res) {
  sendData(res, await approveArticle(req.params.id, req.user));
}

/** POST /api/articles/:id/return — Pending → Returned for Corrections, body `{ note }`. */
export async function returnArticleHandler(req, res) {
  sendData(res, await returnArticle(req.params.id, req.user, req.body));
}

/** DELETE /api/articles/:id — the article plus its comments and view records. */
export async function deleteArticleHandler(req, res) {
  sendData(res, await deleteArticle(req.params.id, req.user));
}
