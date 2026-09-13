import mongoose from 'mongoose';

/** The four lifecycle states an article can be in. Single source of truth — no parallel booleans. */
const STATES = ['In Preparation', 'Pending Editor Approval', 'Published', 'Returned for Corrections'];

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
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    state: { type: String, enum: STATES, default: 'In Preparation', required: true, index: true },

    // Working copy — what the reporter edits, what autosave writes.
    title: { type: String, required: true },
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
    viewCount: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

// Reporter's own articles, most-recently-updated first.
articleSchema.index({ author: 1, updatedAt: -1, _id: -1 });
// Public feed of published articles, newest first.
articleSchema.index({ state: 1, firstPublishedAt: -1, _id: -1 });
// Most-viewed published articles.
articleSchema.index({ state: 1, viewCount: -1, _id: -1 });
// Public feed filtered by category, newest first.
articleSchema.index({ state: 1, category: 1, firstPublishedAt: -1, _id: -1 });
// Full-text search over titles.
articleSchema.index({ title: 'text' });

export const Article = mongoose.model('Article', articleSchema);
