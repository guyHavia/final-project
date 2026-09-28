import mongoose from 'mongoose';
import { Article, CATEGORIES, STATES, PUBLIC_FILTER } from '../models/article.model.js';
import { User } from '../models/user.model.js';
import { AppError } from '../lib/AppError.js';
import { encodeCursor, decodeCursor } from '../lib/cursor.js';

/**
 * Every article read in the system: the public feed, the editor's newsroom view,
 * a reporter's own list, and a single article. All lists use keyset pagination
 * (no skip/offset) ordered `{ <field>: -1, _id: -1 }`, each backed by one index.
 */

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;
const MAX_QUERY_LENGTH = 200;
const UNKNOWN_AUTHOR = 'Unknown author';

/** Sort keys of the public feed. Both are only ever set on public articles. */
const PUBLIC_SORTS = {
  date: 'firstPublishedAt',
  popularity: 'viewCount',
};

/** `limit` → an integer in 1..MAX_LIMIT; anything non-numeric → DEFAULT_LIMIT. */
export function parseLimit(raw) {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, n));
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" match on `field`, or `null` when `q` is empty. */
function titleContains(field, q) {
  const text = typeof q === 'string' ? q.trim().slice(0, MAX_QUERY_LENGTH) : '';
  if (!text) return null;
  return { [field]: { $regex: escapeRegex(text), $options: 'i' } };
}

function checkCategory(category) {
  if (category === undefined || category === '') return null;
  if (!CATEGORIES.includes(category)) throw AppError.badRequest('unknown category');
  return category;
}

/**
 * The "start after the last item" condition for a descending keyset sort on
 * `field`: a smaller value, or the same value with a smaller `_id`. The cursor's
 * value type must match the field's (a cursor from another sort is rejected).
 */
function afterCursor(field, cursor, valueIsDate) {
  if (cursor === undefined || cursor === '') return null;
  const decoded = decodeCursor(cursor);
  if (!decoded || decoded.v instanceof Date !== valueIsDate) {
    throw AppError.badRequest('invalid cursor');
  }
  const id = new mongoose.Types.ObjectId(decoded.id);
  return { $or: [{ [field]: { $lt: decoded.v } }, { [field]: decoded.v, _id: { $lt: id } }] };
}

function build(field, clauses) {
  const present = clauses.filter(Boolean);
  return {
    filter: present.length === 1 ? present[0] : { $and: present },
    sort: { [field]: -1, _id: -1 },
    field,
  };
}

/**
 * Public feed query. Only articles with a published version; search and the
 * category filter read the published version, never the working copy.
 * Throws `AppError.badRequest` for an unknown sort/category or a bad cursor.
 */
export function buildPublicFeedQuery({ q, category, sort = 'date', cursor } = {}) {
  const field = PUBLIC_SORTS[sort || 'date'];
  if (!field) throw AppError.badRequest('unknown sort');
  const checkedCategory = checkCategory(category);

  return build(field, [
    PUBLIC_FILTER,
    checkedCategory && { 'published.category': checkedCategory },
    titleContains('published.title', q),
    afterCursor(field, cursor, field === 'firstPublishedAt'),
  ]);
}

/**
 * Editor newsroom query: `state` is one of the four states or `'all'`. Search and
 * category read the working copy — what the newsroom is working on. Always
 * ordered by most recently updated.
 */
export function buildNewsroomQuery({ state, q, category, cursor } = {}) {
  if (state !== 'all' && !STATES.includes(state)) throw AppError.badRequest('unknown state');
  const checkedCategory = checkCategory(category);

  return build('updatedAt', [
    state === 'all' ? {} : { state },
    checkedCategory && { category: checkedCategory },
    titleContains('title', q),
    afterCursor('updatedAt', cursor, true),
  ]);
}

/** A reporter's own articles in every state (or one `state`), most recently updated first. */
export function buildMineQuery(authorId, { state, cursor } = {}) {
  if (state !== undefined && state !== '' && !STATES.includes(state)) {
    throw AppError.badRequest('unknown state');
  }
  return build('updatedAt', [
    { author: authorId },
    state ? { state } : null,
    afterCursor('updatedAt', cursor, true),
  ]);
}

/** Runs a built query for one page: fetches `limit + 1` to know whether another page exists. */
async function runPage({ filter, sort, field }, limit) {
  const docs = await Article.find(filter)
    .sort(sort)
    .limit(limit + 1)
    .select('-body -published.body -history')
    .lean();

  let nextCursor = null;
  if (docs.length > limit) {
    docs.pop();
    const last = docs[docs.length - 1];
    nextCursor = encodeCursor({ v: last[field], id: last._id });
  }
  return { docs: await attachAuthors(docs), nextCursor };
}

/**
 * Resolves each article's byline to `{ id, displayName }` with one query for the
 * whole page (D1). Never filters on `active`: a deactivated author keeps their
 * name (D2); an author whose document is gone gets a placeholder.
 */
async function attachAuthors(docs) {
  const authorIds = [...new Set(docs.map((d) => String(d.author)))];
  const users = await User.find({ _id: { $in: authorIds } }, 'displayName').lean();
  const names = new Map(users.map((u) => [String(u._id), u.displayName]));
  return docs.map((d) => ({
    ...d,
    author: { id: String(d.author), displayName: names.get(String(d.author)) ?? UNKNOWN_AUTHOR },
  }));
}

/** Public card: the published version only. `updatedAt` is when that version was approved. */
function toPublicCard(doc) {
  return {
    id: String(doc._id),
    slug: doc.slug ?? null,
    title: doc.published.title,
    abstract: doc.published.abstract ?? null,
    image: doc.published.image ?? null,
    category: doc.published.category,
    author: doc.author,
    publishedAt: doc.firstPublishedAt,
    updatedAt: doc.published.publishedAt ?? doc.firstPublishedAt,
    viewCount: doc.viewCount ?? 0,
  };
}

/** Newsroom / work-area list item: the working copy plus workflow fields, no body. */
function toWorkItem(doc) {
  return {
    id: String(doc._id),
    slug: doc.slug ?? null,
    state: doc.state,
    title: doc.title,
    abstract: doc.abstract ?? null,
    image: doc.image ?? null,
    category: doc.category,
    author: doc.author,
    editorNote: doc.state === 'Returned for Corrections' ? (doc.editorNote ?? null) : null,
    hasPublishedVersion: Boolean(doc.published),
    publishedAt: doc.firstPublishedAt ?? null,
    submittedAt: doc.submittedAt ?? null,
    updatedAt: doc.updatedAt,
    viewCount: doc.viewCount ?? 0,
  };
}

export async function listPublicFeed({ limit, ...params }) {
  const { docs, nextCursor } = await runPage(buildPublicFeedQuery(params), parseLimit(limit));
  return { items: docs.map(toPublicCard), nextCursor };
}

export async function listNewsroom({ limit, ...params }) {
  const { docs, nextCursor } = await runPage(buildNewsroomQuery(params), parseLimit(limit));
  return { items: docs.map(toWorkItem), nextCursor };
}

export async function listMine(authorId, { limit, ...params }) {
  const { docs, nextCursor } = await runPage(buildMineQuery(authorId, params), parseLimit(limit));
  return { items: docs.map(toWorkItem), nextCursor };
}

/**
 * One article for `viewer` (`req.user`, or undefined for a guest).
 * - Its author or any editor: the full document — working copy, published
 *   version, state, editor note, history — so the newsroom can show a diff.
 * - Everyone else: the published version only; 404 if it was never published,
 *   so a draft's existence is not revealed.
 * Does not count a view (D10 — the article page render does that).
 */
export async function getArticleForViewer(id, viewer) {
  const doc = await Article.findById(id).lean();
  if (!doc) throw AppError.notFound('article not found');

  const isEditor = viewer?.role === 'editor';
  const isOwner = viewer && String(doc.author) === String(viewer._id);
  const [withAuthor] = await attachAuthors([doc]);

  if (isEditor || isOwner) return toFullArticle(withAuthor);
  if (!doc.published || !doc.firstPublishedAt) throw AppError.notFound('article not found');
  return toPublicArticle(withAuthor);
}

const OBJECT_ID = /^[0-9a-f]{24}$/i;

/**
 * P2-07 — the server-render hook for P3's `GET /article/:slug` page. Returns one
 * public article with its FULL body (the SEO requirement: the text is in the
 * first HTML response), or `null` so the page can render its own 404.
 *
 * - Looks up by slug (case-insensitive: slugs are stored lowercase), then falls
 *   back to the article id when no slug matches (D5).
 * - Only ever reads the published version — never the working copy — so a
 *   pending or returned revision can't leak into the page.
 * - Never throws for bad input and does not count a view (P2-08 / D10).
 *
 * Shape: the feed card (`toPublicCard`) plus `body`, so the feed and the article
 * page use the same field names.
 */
export async function getArticleForRender(slugOrId) {
  if (typeof slugOrId !== 'string') return null;
  const key = slugOrId.trim();
  if (!key) return null;

  let doc = await Article.findOne({ slug: key.toLowerCase(), ...PUBLIC_FILTER }).lean();
  if (!doc && OBJECT_ID.test(key)) {
    doc = await Article.findOne({ _id: key, ...PUBLIC_FILTER }).lean();
  }
  if (!doc?.published) return null;

  const [withAuthor] = await attachAuthors([doc]);
  return toPublicArticle(withAuthor);
}

/**
 * The full document for its author or an editor, byline resolved. Used by the
 * write endpoints (P2-03/P2-04) to answer with the same shape as GET /:id.
 */
export async function presentFullArticle(doc) {
  const [withAuthor] = await attachAuthors([doc]);
  return toFullArticle(withAuthor);
}

/** The public view of one article: the published version plus its full body. */
function toPublicArticle(doc) {
  return { ...toPublicCard(doc), body: doc.published.body ?? '' };
}

function toFullArticle(doc) {
  return {
    id: String(doc._id),
    slug: doc.slug ?? null,
    state: doc.state,
    title: doc.title,
    abstract: doc.abstract ?? null,
    body: doc.body ?? '',
    image: doc.image ?? null,
    category: doc.category,
    author: doc.author,
    editorNote: doc.editorNote ?? null,
    submittedAt: doc.submittedAt ?? null,
    published: doc.published ?? null,
    firstPublishedAt: doc.firstPublishedAt ?? null,
    history: (doc.history ?? []).map((h) => ({ at: h.at, kind: h.kind, by: h.by ? String(h.by) : null })),
    viewCount: doc.viewCount ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
