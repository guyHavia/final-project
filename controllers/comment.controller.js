import { Buffer } from 'node:buffer';
import mongoose from 'mongoose';
import { Comment } from '../models/comment.model.js';
import { Article } from '../models/article.model.js';
import { AppError } from '../lib/AppError.js';
import { sendData } from '../lib/respond.js';

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

/** Escapes regex special characters so a search for "(" or ".*" matches that text literally. */
function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Keyset cursor: the last comment's `createdAt` plus its `_id`. The `_id` breaks
 * ties between comments posted in the same millisecond. Opaque to the client.
 */
function encodeCursor(comment) {
    return Buffer.from(JSON.stringify({ t: comment.createdAt.toISOString(), id: String(comment._id) })).toString('base64url');
}

/** Returns `{ createdAt, id }`, or throws 400 for a malformed cursor. */
function decodeCursor(cursor) {
    try {
        const { t, id } = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
        const createdAt = new Date(t);
        if (typeof t === 'string' && !Number.isNaN(createdAt.getTime()) && mongoose.isValidObjectId(id)) {
            return { createdAt, id: new mongoose.Types.ObjectId(id) };
        }
    } catch {
        // fall through to the 400 below
    }
    throw AppError.badRequest('invalid cursor');
}

export async function list(req, res) {
    const { articleId } = req.params;
    await checkArticlePublished(articleId);

    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const { cursor, q } = req.query;

    const filter = { article: articleId };
    
    if (cursor) {
        // Strictly after the last comment of the previous page, in (createdAt, _id) order.
        const after = decodeCursor(cursor);
        filter.$or = [
            { createdAt: { $lt: after.createdAt } },
            { createdAt: after.createdAt, _id: { $lt: after.id } }
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
        nextCursor = encodeCursor(items[items.length - 1]);
    }

    sendData(res, { items, nextCursor });
}

/**
 * Runs before the rate limiter: 404s for a missing/unpublished article and 400s
 * for an invalid body, so those requests never consume quota. Stashes the valid,
 * unsaved comment on `req.comment` for `create`.
 */
export async function prepare(req, res, next) {
    const { articleId } = req.params;
    const { authorName, body } = req.body;

    await checkArticlePublished(articleId);

    const comment = new Comment({
        article: articleId,
        authorName,
        body,
        deviceId: req.cookies?.deviceId
    });
    await comment.validate();

    req.comment = comment;
    next();
}

export async function create(req, res) {
    await req.comment.save();
    sendData(res, req.comment, 201);
}

export async function remove(req, res) {
    const { id } = req.params;

    const comment = await Comment.findByIdAndDelete(id);
    if (!comment) {
        throw AppError.notFound('comment not found');
    }

    sendData(res, { ok: true });
}