import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  article: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true,
  },
  authorName: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 60,
  },
  body: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 2000,
  },
  deviceId: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

// The only index on `article`: its prefix also serves plain per-article lookups.
// Serves the newest-first per-article list; `_id` is the tie-break for comments
// posted in the same millisecond, so keyset paging never skips or repeats one.
commentSchema.index({ article: 1, createdAt: -1, _id: -1 });

// Ensure deviceId is never serialized in API responses
commentSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.deviceId;
    return ret;
  },
});

export const Comment = mongoose.model('Comment', commentSchema);