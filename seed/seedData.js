import mongoose from 'mongoose';
import { CATEGORIES } from '../models/article.model.js';
import {
  DRAFT_ADDITIONS,
  EDITOR_NOTES,
  FILLER,
  GUEST_COMMENTS,
  GUEST_NAMES,
  STORIES,
  UPDATES,
} from './content.js';

/**
 * Pure demo-data generators for `npm run seed`. Nothing here touches the
 * database, so the shape of the dataset is unit-testable (test/seed.data.test.js).
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const ARTICLES_PER_CATEGORY = 50;
export const ARTICLE_COUNT = CATEGORIES.length * ARTICLES_PER_CATEGORY;

/**
 * Layout of the 50 articles in each category, by index k. Every state and every
 * category is therefore guaranteed at least ten articles regardless of the rng.
 *
 *   0-19   Published            (0-3 also carry unsubmitted edits; 0-15 have 1-4 updates)
 *   20-29  Pending Approval     (20-21 are revisions of an already-published article)
 *   30-39  In Preparation
 *   40-49  Returned             (40 is a revision of an already-published article)
 */
const UNSUBMITTED_EDITS_UNTIL = 4;
const UPDATED_UNTIL = 16;
const PUBLISHED_UNTIL = 20;
const PENDING_UNTIL = 30;
const PREPARATION_UNTIL = 40;
const PENDING_FROM = PUBLISHED_UNTIL;
const PENDING_REVISIONS_UNTIL = 22;
const RETURNED_REVISIONS_UNTIL = 41;

const TITLE_PREFIX = {
  en: ['', 'Analysis: ', 'Explainer: ', 'Weekend Read: ', 'Follow-up: '],
  he: ['', 'ניתוח: ', 'הסבר: ', 'קריאה לסוף השבוע: ', 'מעקב: '],
};

/** Small deterministic PRNG (mulberry32) so a seeded run is reproducible. */
export function createRng(seed = 53) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

/** Refuse to wipe a production database unless the operator says `--force`. */
export function assertSeedAllowed({ nodeEnv, argv }) {
  if (nodeEnv === 'production' && !argv.includes('--force')) {
    throw new Error(
      'Refusing to seed: NODE_ENV=production. The seed deletes every user, article, comment, view event and session. Re-run with --force if you really mean it.',
    );
  }
}

function contentFor(category, k, rng) {
  const story = STORIES[category][k % 10];
  const round = Math.floor(k / 10);
  const { lang } = story;
  const fillers = FILLER[lang];
  const first = int(rng, 0, fillers.length - 1);
  const second = (first + 1 + int(rng, 0, fillers.length - 2)) % fillers.length;
  return {
    lang,
    title: `${TITLE_PREFIX[lang][round]}${story.title}`,
    abstract: story.abstract,
    body: [story.lead, fillers[first], fillers[second]].join('\n\n'),
    category,
    image: story.image,
  };
}

/** Update times strictly increasing, all between first publication and shortly before `now`. */
function updateTimes(first, count, now, rng) {
  const span = Math.min(now - HOUR - first, 10 * DAY);
  const step = span / (count + 1);
  const times = [];
  for (let j = 1; j <= count; j++) {
    const jitter = (rng() - 0.5) * 0.2 * step;
    times.push(new Date(Math.round(first + j * step + jitter)));
  }
  return times;
}

function publishedFrom(content, first, updates, editorId, rng) {
  const at = [new Date(first), ...updates];
  let body = content.body;
  updates.forEach((_, j) => {
    body = `${body}\n\n${UPDATES[content.lang][(j + int(rng, 0, 3)) % UPDATES[content.lang].length]}`;
  });
  return {
    published: {
      title: content.title,
      abstract: content.abstract,
      body,
      image: content.image,
      category: content.category,
      publishedAt: at.at(-1),
      version: at.length,
    },
    history: at.map((when, i) => ({ kind: i === 0 ? 'publish' : 'update', at: when, by: editorId })),
  };
}

/**
 * Build the 500 demo articles as plain objects (with pre-assigned `_id`s so view
 * events and comments can reference them). See the layout table above.
 */
export function buildArticles({ authorIds, editorId, now, rng }) {
  const articles = [];
  CATEGORIES.forEach((category, c) => {
    for (let k = 0; k < ARTICLES_PER_CATEGORY; k++) {
      const content = contentFor(category, k, rng);
      const slug = `${category}-${String(k).padStart(2, '0')}`;
      const author = authorIds[(c + k) % authorIds.length];
      const article = {
        _id: new mongoose.Types.ObjectId(),
        title: content.title,
        abstract: content.abstract,
        body: content.body,
        image: content.image,
        category,
        author,
        viewCount: 0,
        history: [],
      };

      const isPublished = k < PUBLISHED_UNTIL;
      const isRevision =
        (k >= PENDING_FROM &&k < PENDING_REVISIONS_UNTIL) || (k >= PREPARATION_UNTIL && k < RETURNED_REVISIONS_UNTIL);

      if (isPublished || isRevision) {
        const first = now - 3 * DAY - int(rng, 0, 11 * 24) * HOUR;
        const updateCount = isRevision ? 1 : k < UPDATED_UNTIL ? (k % 4) + 1 : 0;
        const { published, history } = publishedFrom(
          content,
          first,
          updateTimes(first, updateCount, now, rng),
          editorId,
          rng,
        );
        Object.assign(article, {
          slug,
          published,
          history,
          firstPublishedAt: new Date(first),
          body: published.body,
        });
      }

      if (isPublished) {
        article.state = 'Published';
        if (k < UNSUBMITTED_EDITS_UNTIL) {
          article.body = `${article.body}\n\n${DRAFT_ADDITIONS[content.lang]}`;
        }
      } else if (k < PENDING_UNTIL) {
        article.state = 'Pending Editor Approval';
        article.submittedAt = new Date(now - int(rng, 1, 24) * HOUR);
        if (article.published) article.body = `${article.body}\n\n${DRAFT_ADDITIONS[content.lang]}`;
      } else if (k < PREPARATION_UNTIL) {
        article.state = 'In Preparation';
      } else {
        article.state = 'Returned for Corrections';
        article.editorNote = pick(rng, EDITOR_NOTES[content.lang]);
        if (article.published) article.body = `${article.body}\n\n${DRAFT_ADDITIONS[content.lang]}`;
      }

      articles.push(article);
    }
  });
  return articles;
}

/**
 * Hourly view events from first publication to `now`. Baseline traffic decays
 * with age; every publication marker adds a burst that fades over a few hours,
 * so Impact Analytics shows a clear jump right after each publish/update.
 */
export function buildViewEvents(article, now, rng) {
  const start = article.firstPublishedAt.getTime();
  const popularity = 1 + rng() * 1.5;
  const markers = article.history.map((h) => ({ at: h.at.getTime(), boost: h.kind === 'publish' ? 14 : 9 }));
  const events = [];
  for (let t = start; t < now; t += HOUR) {
    const age = (t - start) / HOUR;
    let rate = (0.4 + 1.6 * Math.exp(-age / 96)) * popularity;
    for (const m of markers) {
      if (t >= m.at) rate += m.boost * popularity * Math.exp(-(t - m.at) / HOUR / 3);
    }
    const count = Math.floor(rate) + (rng() < rate % 1 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const at = t + rng() * HOUR;
      if (at <= now) events.push({ article: article._id, at: new Date(at) });
    }
  }
  return events;
}

/** 0-5 guest comments spread between first publication and `now`. */
export function buildComments(article, now, rng, deviceId = () => `seed-${Math.floor(rng() * 1e9).toString(36)}`) {
  const lang = /[֐-׿]/.test(article.title) ? 'he' : 'en';
  const first = article.firstPublishedAt.getTime();
  const comments = [];
  for (let i = 0, n = int(rng, 0, 5); i < n; i++) {
    comments.push({
      article: article._id,
      authorName: pick(rng, GUEST_NAMES),
      body: pick(rng, GUEST_COMMENTS[lang]),
      deviceId: deviceId(),
      createdAt: new Date(first + 60000 + Math.floor(rng() * (now - first - 60000))),
    });
  }
  return comments;
}
