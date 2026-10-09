import { sendData } from '../lib/respond.js';
import { listComments, prepareComment, saveComment, editComment, deleteComment } from '../services/comment.service.js';

export async function list(req, res) {
  const { cursor, q, limit } = req.query;
  sendData(res, await listComments(req.params.articleId, { cursor, q, limit }));
}

/**
 * Runs before the rate limiter: 404s for a missing/unpublished article and 400s
 * for an invalid body, so those requests never consume quota. Stashes the valid,
 * unsaved comment on `req.comment` for `create`.
 */
export async function prepare(req, res, next) {
  const { authorName, body } = req.body ?? {};
  req.comment = await prepareComment(req.params.articleId, {
    authorName,
    body,
    deviceId: req.cookies?.deviceId,
  });
  next();
}

export async function create(req, res) {
  sendData(res, await saveComment(req.comment), 201);
}

/** PATCH /api/comments/:id — editor-only moderation edit of `body`. */
export async function update(req, res) {
  const { body } = req.body ?? {};
  sendData(res, await editComment(req.params.id, body));
}

export async function remove(req, res) {
  await deleteComment(req.params.id);
  sendData(res, { ok: true });
}
