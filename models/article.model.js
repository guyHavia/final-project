import mongoose from 'mongoose';

/** The four lifecycle states an article can be in. Single source of truth — no parallel booleans. */
export const STATE = {
  IN_PREPARATION: 'In Preparation',
  PENDING: 'Pending Editor Approval',
  PUBLISHED: 'Published',
  RETURNED: 'Returned for Corrections',
};
export const STATES = Object.values(STATE);

/**
 * The shared category list (issue #4, P2-01 schema section: "constrained to a
 * shared category list constant"). Single source of truth for every place a
 * category value is read or written — the working copy, the `published`
 * snapshot, the category-filter index, and P5's seed all use this list.
 */
export const CATEGORIES = [
  'politics',
  'business',
  'technology',
  'science',
  'health',
  'sports',
  'entertainment',
  'world',
  'opinion',
  'culture',
];

/**
 * The frozen public snapshot of an article's most recently approved content.
 * Overwritten wholesale on every approval; `version` increments; `publishedAt`
 * is the current published version's time. `null` until the first approval.
 */
const publishedSchema = new mongoose.Schema(
  {
    title: String,
    abstract: String,
    body: String,
    image: String,
    category: { type: String, enum: CATEGORIES },
    publishedAt: Date,
    version: Number,
  },
  { _id: false },
);

/**
 * One workflow event. Read by the Impact Analytics endpoint for graph markers —
 * shape is frozen as `{ at, kind, by }`, do not deviate.
 */
const historyEntrySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    kind: { type: String, enum: ['publish', 'update'], required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
);

const articleSchema = new mongoose.Schema(
  {
    // Identity & querying.
    // Sparse because it stays unset until first publish; Mongo unique indexes
    // require sparse to allow multiple null/missing values. Generation logic
    // (slugify) is out of scope for this ticket.
    slug: { type: String, unique: true, lowercase: true, trim: true, sparse: true },
    category: { type: String, required: true, trim: true, enum: CATEGORIES },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    state: { type: String, enum: STATES, default: STATE.IN_PREPARATION, required: true },

    // Working copy — what the reporter edits, what autosave writes.
    // `title` is not required here so autosave can store a half-written draft;
    // create, full edit and submit require it (articleAuthoring.service.js and
    // the state machine's content guard).
    title: { type: String, default: '' },
    abstract: String,
    body: String,
    image: String,

    // Published version — the frozen public snapshot. Default null until first approval.
    published: { type: publishedSchema, default: null },
    // Set once on first approval, immutable thereafter (enforced at the service layer, not here).
    firstPublishedAt: Date,

    // Workflow bookkeeping.
    // Most recent return-for-corrections note; cleared on next submit.
    editorNote: String,
    // Set when entering Pending Editor Approval; cleared on approve/return.
    submittedAt: Date,
    history: [historyEntrySchema],
    // Denormalized popularity counter; not wired to anything yet in this ticket.
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

/**
 * "Public" means the article has a published version — `firstPublishedAt` is set
 * on first approval together with `published` and never cleared. That includes a
 * Published article whose revision is Pending or Returned: its approved version
 * keeps serving readers. The public-feed indexes are partial on this filter, so
 * they hold only public articles and every public query must include it.
 */
export const PUBLIC_FILTER = { firstPublishedAt: { $type: 'date' } };

// One index per list the app serves. Each ends in `_id` so keyset pagination has
// a unique tie-break. Named so tests (and explain()) can refer to them.

// Reporter work area: my articles, most recently updated first.
articleSchema.index({ author: 1, updatedAt: -1, _id: -1 }, { name: 'mine_by_updated' });
// Editor newsroom: one state, most recently updated first.
articleSchema.index({ state: 1, updatedAt: -1, _id: -1 }, { name: 'newsroom_by_state' });
// Editor newsroom: every state, most recently updated first.
articleSchema.index({ updatedAt: -1, _id: -1 }, { name: 'newsroom_all' });
// Public feed, newest first (by first publication, so an update doesn't re-sort it).
articleSchema.index(
  { firstPublishedAt: -1, _id: -1 },
  { name: 'public_by_date', partialFilterExpression: PUBLIC_FILTER },
);
// Public feed, most viewed first.
articleSchema.index(
  { viewCount: -1, _id: -1 },
  { name: 'public_by_popularity', partialFilterExpression: PUBLIC_FILTER },
);
// Public feed filtered by the category readers see, newest first.
articleSchema.index(
  { 'published.category': 1, firstPublishedAt: -1, _id: -1 },
  { name: 'public_by_category_date', partialFilterExpression: PUBLIC_FILTER },
);

export const Article = mongoose.model('Article', articleSchema);
