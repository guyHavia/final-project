import mongoose from 'mongoose';

/** One document per article page view. Aggregated into the Impact Analytics series. */
const viewEventSchema = new mongoose.Schema({
  article: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true,
  },
  at: { type: Date, default: Date.now },
});

// Serves the stats aggregation: filter by article, bucket/sort by time.
viewEventSchema.index({ article: 1, at: 1 });

export const ViewEvent = mongoose.model('ViewEvent', viewEventSchema);
