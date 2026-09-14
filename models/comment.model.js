const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  article: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true,
    index: true,
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

// Compound index to serve newest-first per-article lists efficiently at scale
commentSchema.index({ article: 1, createdAt: 1 });

// Ensure deviceId is never serialized in API responses[cite: 2]
commentSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.deviceId;
    return ret;
  },
});

module.exports = mongoose.model('Comment', commentSchema);