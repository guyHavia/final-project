import { sendData } from '../lib/respond.js';
import { listComments, createComment, editComment, deleteComment } from '../services/comment.service.js';

export async function list(req, res) {
  const { cursor, q, limit } = req.query;
  sendData(res, await listComments(req.params.articleId, { cursor, q, limit }));
}

export async function create(req, res) {
  const { authorName, body } = req.body;
  const comment = await createComment(req.params.articleId, {
    authorName,
    body,
    deviceId: req.cookies?.deviceId,
  });
  sendData(res, comment, 201);
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
