import mongoose from 'mongoose';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import { clampLimit } from '../lib/query.js';
import { encodeCursor, decodeCursor } from '../lib/cursor.js';
import { Article } from '../models/article.model.js';
import { ViewEvent } from '../models/viewEvent.model.js';

/**
 * Record one article view. Fire-and-forget: it never throws into the caller, so
 * a failing insert can never break an article read path. A failure is logged
 * and swallowed.
 */
export async function recordView(articleId) {
  try {
    await ViewEvent.create({ article: articleId });
  } catch (err) {
    logger.error('stats.record_failed', {
      articleId: String(articleId),
      message: err.message,
    });
  }
}

const BUCKET_STEP_MS = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
};

/** Truncate `date` down to the start of its bucket, UTC-aligned to match `$dateTrunc`'s default. */
function truncateToBucket(date, bucket) {
  const truncated = new Date(date);
  if (bucket === 'day') {
    truncated.setUTCHours(0, 0, 0, 0);
  } else {
    truncated.setUTCMinutes(0, 0, 0, 0);
  }
  return truncated;
}

/** Most buckets one stats request may span (about 83 days hourly, 5.5 years daily). */
export const MAX_BUCKETS = 2000;

/** Number of buckets `[from, to]` spans — what `bucketBoundaries` would return, without building it. */
function bucketCount(from, to, bucket) {
  const span = truncateToBucket(to, bucket).getTime() - truncateToBucket(from, bucket).getTime();
  return Math.floor(span / BUCKET_STEP_MS[bucket]) + 1;
}

/** Every bucket boundary from `from` through `to`, inclusive, ascending — no gaps. */
function bucketBoundaries(from, to, bucket) {
  const step = BUCKET_STEP_MS[bucket];
  const end = truncateToBucket(to, bucket).getTime();
  const boundaries = [];
  for (let t = truncateToBucket(from, bucket).getTime(); t <= end; t += step) {
    boundaries.push(new Date(t));
  }
  return boundaries;
}

/**
 * The Impact Analytics series for one article: view counts bucketed by hour or
 * day across `[from, to]`, with every bucket present in the result — buckets
 * the aggregation found no events for are zero-filled. Knows nothing about
 * Article/history/markers; the controller composes those on top.
 */
export async function getSeries({ articleId, from, to, bucket }) {
  if (bucketCount(from, to, bucket) > MAX_BUCKETS) {
    throw AppError.badRequest(`range too large: at most ${MAX_BUCKETS} ${bucket} buckets`);
  }

  const rows = await ViewEvent.aggregate([
    {
      $match: {
        article: new mongoose.Types.ObjectId(articleId),
        at: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: { $dateTrunc: { date: '$at', unit: bucket } },
        count: { $sum: 1 },
      },
    },
  ]);

  const countByBucket = new Map(rows.map((row) => [row._id.getTime(), row.count]));

  return bucketBoundaries(from, to, bucket).map((t) => ({
    t: t.toISOString(),
    count: countByBucket.get(t.getTime()) ?? 0,
  }));
}

function toView(doc) {
  return { id: String(doc._id), article: String(doc.article), at: doc.at.toISOString() };
}

/**
 * One page of an article's view records, newest first, optionally limited to
 * `[from, to]`. Keyset-paginated on `(at, _id)`.
 */
export async function listViews(articleId, { from, to, cursor, limit } = {}) {
  const pageSize = clampLimit(limit);
  const filter = { article: articleId };
  if (from || to) filter.at = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

  if (cursor) {
    const after = decodeCursor(cursor);
    if (!after || !(after.v instanceof Date)) throw AppError.badRequest('invalid cursor');
    const afterId = new mongoose.Types.ObjectId(after.id);
    filter.$or = [{ at: { $lt: after.v } }, { at: after.v, _id: { $lt: afterId } }];
  }

  const docs = await ViewEvent.find(filter).sort({ at: -1, _id: -1 }).limit(pageSize + 1).lean();
  let nextCursor = null;
  if (docs.length > pageSize) {
    docs.pop();
    const last = docs[docs.length - 1];
    nextCursor = encodeCursor({ v: last.at, id: last._id });
  }
  return { items: docs.map(toView), nextCursor };
}

export async function getView(id) {
  const doc = await ViewEvent.findById(id).lean();
  if (!doc) throw AppError.notFound('view not found');
  return toView(doc);
}

/** Corrects the time of one view record. `at` must be a valid date, not in the future. */
export async function updateViewTime(id, at) {
  const doc = await ViewEvent.findByIdAndUpdate(id, { $set: { at } }, { new: true }).lean();
  if (!doc) throw AppError.notFound('view not found');
  return toView(doc);
}

/** Deletes one view record and takes it off its article's `viewCount` (never below zero). */
export async function deleteView(id) {
  const doc = await ViewEvent.findByIdAndDelete(id).lean();
  if (!doc) throw AppError.notFound('view not found');
  await Article.updateOne(
    { _id: doc.article, viewCount: { $gt: 0 } },
    { $inc: { viewCount: -1 } },
    { timestamps: false },
  );
  logger.info('stats.view_deleted', { viewId: String(doc._id), articleId: String(doc.article) });
}

/** Publish/update markers from an article's `history`, ascending by `at`. Does not mutate the input. */
export function historyMarkers(history) {
  return [...history]
    .sort((a, b) => a.at - b.at)
    .map((entry) => ({ t: entry.at.toISOString(), kind: entry.kind }));
}
