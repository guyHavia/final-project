import { User } from '../models/user.model.js';
import { Article } from '../models/article.model.js';
import { AppError } from '../lib/AppError.js';
import { escapeRegex, isObjectId, clampLimit } from '../lib/query.js';
import { destroySessionsForUser } from '../config/session.js';

/**
 * One page of users, oldest first, keyset-paginated on `_id`. `q` matches the
 * username (case-insensitive, literal); `cursor` is the last user id of the previous page.
 */
export async function listUsers({ q, cursor, limit: rawLimit } = {}) {
  const limit = clampLimit(rawLimit);

  if (q !== undefined && typeof q !== 'string') throw AppError.badRequest('q must be a string');
  if (cursor !== undefined && !isObjectId(cursor)) throw AppError.badRequest('invalid cursor');

  const query = {};
  if (q) {
    query.username = { $regex: escapeRegex(q), $options: 'i' };
  }
  if (cursor) {
    query._id = { $gt: cursor };
  }

  const users = await User.find(query).sort({ _id: 1 }).limit(limit + 1);

  let nextCursor = null;
  if (users.length > limit) {
    users.pop();
    nextCursor = users[users.length - 1].id;
  }
  return { users, nextCursor };
}

/**
 * Removes `user`: hard-deleted when they have no articles, otherwise deactivated
 * so their byline survives. Either way every session of theirs is ended.
 * Resolves to `'hard'` or `'soft'`.
 */
export async function deleteOrDeactivateUser(user) {
  const articleCount = await Article.countDocuments({ author: user.id });
  if (articleCount === 0) {
    await user.deleteOne();
    await destroySessionsForUser(user.id);
    return 'hard';
  }
  user.active = false;
  await user.save();
  await destroySessionsForUser(user.id);
  return 'soft';
}
