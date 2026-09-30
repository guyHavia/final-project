import mongoose from 'mongoose';
import { Comment } from '../models/comment.model.js';
import { Article } from '../models/article.model.js';
import { AppError } from '../lib/AppError.js';
import { encodeCursor, decodeCursor } from '../lib/cursor.js';
import { escapeRegex, clampLimit } from '../lib/query.js';

/**
 * Validates the article exists and is public — i.e. it has been published at
 * least once (`firstPublishedAt` is set). That includes a Published article whose
 * revision is Pending or Returned: its approved version is still on the site, so
 * its comments stay open.
 * Malformed IDs will naturally throw a CastError mapped to 400 invalid_id by the skeleton.
 */
async function checkArticlePublished(articleId) {
  const article = await Article.findById(articleId).select('firstPublishedAt');
  if (!article || !(article.firstPublishedAt instanceof Date)) {
    throw AppError.notFound('article not found or not published');
  }
}

/** One page of an article's comments, newest first, keyset-paginated on `(createdAt, _id)`. */
export async function listComments(articleId, { cursor, q, limit: rawLimit } = {}) {
  await checkArticlePublished(articleId);

  // `limit=0` (falsy) means "not given" here, so it gets the default rather than 1.
  const limit = clampLimit(Number.parseInt(rawLimit, 10) || undefined);

  const filter = { article: articleId };

  if (cursor) {
    // Strictly after the last comment of the previous page, in (createdAt, _id) order.
    const after = decodeCursor(cursor);
    if (!after || !(after.v instanceof Date)) throw AppError.badRequest('invalid cursor');
    const afterId = new mongoose.Types.ObjectId(after.id);
    filter.$or = [
      { createdAt: { $lt: after.v } },
      { createdAt: after.v, _id: { $lt: afterId } },
    ];
  }

  if (typeof q === 'string' && q.trim()) {
    filter.body = { $regex: escapeRegex(q.trim()), $options: 'i' };
  }

  // Fetch limit + 1 to determine if there is a next page
  const items = await Comment.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1);

  let nextCursor = null;
  if (items.length > limit) {
    items.pop();
    // The cursor points at the last comment actually returned on this page.
    const last = items[items.length - 1];
    nextCursor = encodeCursor({ v: last.createdAt, id: last._id });
  }

  return { items, nextCursor };
}

/**
 * Builds and validates (but does not save) a guest comment on a public article.
 * Throws 404 for a missing/unpublished article and 400 for an invalid body, so
 * callers can reject before spending rate-limit quota.
 */
export async function prepareComment(articleId, { authorName, body, deviceId }) {
  await checkArticlePublished(articleId);
  const comment = new Comment({ article: articleId, authorName, body, deviceId });
  await comment.validate();
  return comment;
}

/** Persists a comment returned by `prepareComment`. */
export async function saveComment(comment) {
  return comment.save();
}

/**
 * Editor moderation edit. Only `body` is editable; author, article and deviceId
 * are ignored. Goes through `save()` so the schema's trim/length validation
 * applies (a bad body → 400 validation).
 */
export async function editComment(id, body) {
  if (typeof body !== 'string') {
    throw AppError.badRequest('body is required');
  }

  const comment = await Comment.findById(id);
  if (!comment) {
    throw AppError.notFound('comment not found');
  }

  comment.body = body;
  await comment.save();
  return comment;
}

export async function deleteComment(id) {
  const comment = await Comment.findByIdAndDelete(id);
  if (!comment) {
    throw AppError.notFound('comment not found');
  }
}
