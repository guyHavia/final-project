import { Buffer } from 'node:buffer';
import { Comment } from '../models/comment.model.js';
import { Article } from '../models/article.model.js';
import { AppError } from '../lib/AppError.js';
import { sendData } from '../lib/respond.js';

/**
 * Validates the article exists and is published.
 * Malformed IDs will naturally throw a CastError mapped to 400 invalid_id by the skeleton.
 */
async function checkArticlePublished(articleId) {
    const article = await Article.findById(articleId);
    if (!article || article.state !== 'Published') {
        throw AppError.notFound('article not found or not published');
    }
}

export async function list(req, res) {
    const { articleId } = req.params;
    await checkArticlePublished(articleId);

    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const { cursor, q } = req.query;

    const filter = { article: articleId };
    
    if (cursor) {
        const decodedTime = Buffer.from(cursor, 'base64').toString('utf-8');
        filter.createdAt = { $lt: new Date(decodedTime) };
    }
    
    if (q) {
        filter.body = { $regex: q, $options: 'i' };
    }

    // Fetch limit + 1 to determine if there is a next page
    const items = await Comment.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit + 1);

    let nextCursor = null;
    if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = Buffer.from(nextItem.createdAt.toISOString()).toString('base64');
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

export async function remove(req, res) {
    const { id } = req.params;

    const comment = await Comment.findByIdAndDelete(id);
    if (!comment) {
        throw AppError.notFound('comment not found');
    }

    sendData(res, { ok: true });
}