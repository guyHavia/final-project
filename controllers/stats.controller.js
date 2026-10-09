import { AppError } from '../lib/AppError.js';
import { sendData } from '../lib/respond.js';
import { Article } from '../models/article.model.js';
import { getSeries, historyMarkers, listViews, getView, updateViewTime, deleteView } from '../services/stats.service.js';

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

/** An optional date query param → `Date`, `undefined` when absent, 400 when unparseable. */
function optionalDate(raw, name) {
  if (raw === undefined || raw === '') return undefined;
  const date = new Date(raw);
  if (typeof raw !== 'string' || Number.isNaN(date.getTime())) throw AppError.badRequest(`invalid ${name}`);
  return date;
}

/**
 * Impact Analytics for one article: a bucketed view-count series plus
 * publish/update markers read from the article's history. A malformed `:id`
 * surfaces as a Mongoose CastError, mapped by `errorHandler` to 400 `invalid_id`.
 */
export async function getArticleStats(req, res) {
  const bucket = parseBucket(req.query.bucket);
  const { from, to } = parseRange(req.query.from, req.query.to);

  const article = await Article.findById(req.params.id).select('history');
  if (!article) throw AppError.notFound();

  const series = await getSeries({ articleId: article.id, from, to, bucket });

  const markers = historyMarkers(article.history);

  sendData(res, { series, markers });
}

/** GET /api/articles/:id/views — one page of the article's view records. */
export async function listArticleViews(req, res) {
  const article = await Article.findById(req.params.id).select('_id');
  if (!article) throw AppError.notFound();
  const { cursor, limit } = req.query;
  const from = optionalDate(req.query.from, 'from');
  const to = optionalDate(req.query.to, 'to');
  sendData(res, await listViews(article._id, { from, to, cursor, limit }));
}

/** GET /api/views/:id */
export async function getViewRecord(req, res) {
  sendData(res, await getView(req.params.id));
}

/** PATCH /api/views/:id — body `{ at }`, the only editable field. */
export async function updateViewRecord(req, res) {
  const body = req.body ?? {};
  if (typeof body !== 'object' || Array.isArray(body)) throw AppError.badRequest('request body must be a JSON object');
  const extra = Object.keys(body).find((key) => key !== 'at');
  if (extra) throw AppError.badRequest(`unknown field: ${extra}`);
  const at = optionalDate(body.at, 'at');
  if (!at) throw AppError.badRequest('at is required');
  if (at.getTime() > Date.now()) throw AppError.badRequest('at cannot be in the future');
  sendData(res, await updateViewTime(req.params.id, at));
}

/** DELETE /api/views/:id */
export async function deleteViewRecord(req, res) {
  await deleteView(req.params.id);
  sendData(res, { ok: true });
}
