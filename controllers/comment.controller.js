import mongoose from 'mongoose';
import { Comment } from '../models/comment.model.js';
import { Article } from '../models/article.model.js';
import { AppError } from '../lib/AppError.js';
import { sendData } from '../lib/respond.js';
import { encodeCursor, decodeCursor } from '../lib/cursor.js';
import { escapeRegex, clampLimit } from '../lib/query.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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

export async function list(req, res) {
    const { articleId } = req.params;
    await checkArticlePublished(articleId);

    const limit = clampLimit(Number.parseInt(req.query.limit, 10) || undefined, { defaultLimit: DEFAULT_LIMIT, maxLimit: MAX_LIMIT });
    const { cursor, q } = req.query;

    const filter = { article: articleId };
    
    if (cursor) {
        // Strictly after the last comment of the previous page, in (createdAt, _id) order.
        const after = decodeCursor(cursor);
        if (!after || !(after.v instanceof Date)) throw AppError.badRequest('invalid cursor');
        const afterId = new mongoose.Types.ObjectId(after.id);
        filter.$or = [
            { createdAt: { $lt: after.v } },
            { createdAt: after.v, _id: { $lt: afterId } }
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

    sendData(res, { items, nextCursor });
}

export async function create(req, res) {
    const { articleId } = req.params;
    const { authorName, body } = req.body;
    const deviceId = req.cookies?.deviceId;

    await checkArticlePublished(articleId);

    const comment = await Comment.create({
        article: articleId,
        authorName,
        body,
        deviceId
    });

    sendData(res, comment, 201);
}

/**
 * PATCH /api/comments/:id — editor-only moderation edit. Only `body` is editable;
 * author, article and deviceId are ignored. Goes through `save()` so the schema's
 * trim/length validation applies (a bad body → 400 validation).
 */
export async function update(req, res) {
    const { body } = req.body ?? {};
    if (typeof body !== 'string') {
        throw AppError.badRequest('body is required');
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
        throw AppError.notFound('comment not found');
    }

    comment.body = body;
    await comment.save();
    sendData(res, comment);
}

export async function remove(req, res) {
    const { id } = req.params;

    const comment = await Comment.findByIdAndDelete(id);
    if (!comment) {
        throw AppError.notFound('comment not found');
    }

    sendData(res, { ok: true });
}