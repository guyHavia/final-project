import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/AppError.js';
import { sendData } from '../lib/respond.js';
import { Article } from '../models/article.model.js';
import { getSeries } from '../services/stats.service.js';

const VALID_BUCKETS = ['hour', 'day'];
const DEFAULT_BUCKET = 'hour';
// `from` defaults to 24h before the effective `to` when omitted.
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** `bucket` query param → validated bucket unit, defaulting to `'hour'`. */
function parseBucket(raw) {
  if (!raw) return DEFAULT_BUCKET;
  if (!VALID_BUCKETS.includes(raw)) throw AppError.badRequest('invalid bucket');
  return raw;
}

/** `from`/`to` query params → validated `Date`s, with `to` defaulting to now and `from` to 24h before it. */
function parseRange(fromRaw, toRaw) {
  const to = toRaw ? new Date(toRaw) : new Date();
  if (toRaw && Number.isNaN(to.getTime())) throw AppError.badRequest('invalid from/to');

  const from = fromRaw ? new Date(fromRaw) : new Date(to.getTime() - DEFAULT_WINDOW_MS);
  if (fromRaw && Number.isNaN(from.getTime())) throw AppError.badRequest('invalid from/to');

  return { from, to };
}

/**
 * Impact Analytics for one article: a bucketed view-count series plus
 * publish/update markers read from the article's history. A malformed `:id`
 * surfaces as a Mongoose CastError, mapped by `errorHandler` to 400 `invalid_id`.
 */
export const getArticleStats = asyncHandler(async (req, res) => {
  const bucket = parseBucket(req.query.bucket);
  const { from, to } = parseRange(req.query.from, req.query.to);

  const article = await Article.findById(req.params.id);
  if (!article) throw AppError.notFound();

  const series = await getSeries({ articleId: article.id, from, to, bucket });

  const markers = [...article.history]
    .sort((a, b) => a.at - b.at)
    .map((entry) => ({ t: entry.at.toISOString(), kind: entry.kind }));

  sendData(res, { series, markers });
});
