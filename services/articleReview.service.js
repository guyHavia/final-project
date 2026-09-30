import { Article } from '../models/article.model.js';
import { Comment } from '../models/comment.model.js';
import { ViewEvent } from '../models/viewEvent.model.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import { applyTransition, guardTransition, saveTransition } from './articleState.service.js';
import { presentFullArticle } from './articleQuery.service.js';

/**
 * P2-04 — the editor's decisions: approve, return with a note, delete.
 * The routes allow editors only (requireRole('editor')); which transitions are
 * legal is decided by the state machine, never here.
 */

const MAX_NOTE_LENGTH = 1000;

function toActor(user) {
  return { id: String(user._id), role: user.role };
}

async function loadArticle(id) {
  const article = await Article.findById(id);
  if (!article) throw AppError.notFound('article not found');
  return article;
}

/**
 * POST /api/articles/:id/approve — Pending → Published. The state machine copies
 * the working copy into `published`, bumps the version, sets the slug and first
 * publish date the first time, and records a publish/update marker for the
 * Impact Analytics graph. A slug already taken gets a -2, -3, … suffix.
 */
export async function approveArticle(id, user) {
  const article = await loadArticle(id);
  guardTransition(article);
  applyTransition(article, 'Published', toActor(user));
  await saveTransition(article);

  const marker = article.history[article.history.length - 1];
  logger.info('article.approved', {
    articleId: String(article._id),
    userId: String(user._id),
    kind: marker.kind,
    version: article.published.version,
  });
  return presentFullArticle(article.toObject());
}

/** Reads `{ note }` — the only accepted field — as a trimmed, non-blank string of at most 1,000 characters. */
function readNote(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw AppError.badRequest('request body must be a JSON object');
  }
  const extra = Object.keys(input).find((key) => key !== 'note');
  if (extra) throw AppError.badRequest(`unknown field: ${extra}`);
  if (typeof input.note !== 'string' || !input.note.trim()) {
    throw AppError.badRequest('a note is required');
  }
  const note = input.note.trim();
  if (note.length > MAX_NOTE_LENGTH) {
    throw AppError.badRequest(`note is too long (max ${MAX_NOTE_LENGTH} characters)`);
  }
  return note;
}

/**
 * POST /api/articles/:id/return — Pending → Returned for Corrections, with a
 * note the reporter sees on their article. A returned revision of a Published
 * article keeps its approved version on the public site.
 */
export async function returnArticle(id, user, input) {
  const note = readNote(input);
  const article = await loadArticle(id);
  guardTransition(article);
  applyTransition(article, 'Returned for Corrections', toActor(user), { note });
  await saveTransition(article);
  logger.info('article.returned', { articleId: String(article._id), userId: String(user._id) });
  return presentFullArticle(article.toObject());
}

/**
 * DELETE /api/articles/:id — removes the article, then its comments and view
 * records so nothing is left pointing at a missing article. The article goes
 * first: once it is gone, no new comment or view can be attached to it.
 */
export async function deleteArticle(id, user) {
  const article = await Article.findByIdAndDelete(id);
  if (!article) throw AppError.notFound('article not found');

  const [comments, views] = await Promise.all([
    Comment.deleteMany({ article: article._id }),
    ViewEvent.deleteMany({ article: article._id }),
  ]);
  logger.info('article.deleted', {
    articleId: String(article._id),
    userId: String(user._id),
    commentsDeleted: comments.deletedCount,
    viewsDeleted: views.deletedCount,
  });
  return { ok: true };
}
