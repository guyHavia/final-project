import mongoose from 'mongoose';

/** How long one device's view of one article is remembered: repeat entries inside it are not counted. */
export const VIEW_DEDUP_WINDOW_MS = 30 * 60 * 1000;

/**
 * "This device last counted a view of this article at `at`." Keyed
 * `<articleId>:<deviceId>`, so claiming a view is one atomic upsert on `_id`.
 * Short-lived bookkeeping, not analytics: MongoDB's TTL monitor deletes each
 * document once the window has passed (it runs about once a minute, so the
 * service also compares `at` itself).
 */
const viewSeenSchema = new mongoose.Schema(
  {
    _id: { type: String },
    at: { type: Date, required: true },
  },
  { versionKey: false },
);

viewSeenSchema.index({ at: 1 }, { expireAfterSeconds: VIEW_DEDUP_WINDOW_MS / 1000 });

export const ViewSeen = mongoose.model('ViewSeen', viewSeenSchema);
