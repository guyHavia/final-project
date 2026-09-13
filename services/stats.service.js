import mongoose from 'mongoose';
import { logger } from '../lib/logger.js';
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
