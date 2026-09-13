import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';

/**
 * The legal edges of the article lifecycle. Anything not listed here — including
 * every X -> X self-transition — is structurally illegal regardless of actor.
 */
const REACHABLE = {
  'In Preparation': ['Pending Editor Approval'],
  'Returned for Corrections': ['Pending Editor Approval'],
  Published: ['Pending Editor Approval'],
  'Pending Editor Approval': ['Published', 'Returned for Corrections'],
};

/** Simple placeholder slug: lowercase, trim, dash-run non-alphanumerics, strip edge dashes. */
export function slugify(title) {
  return String(title ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Used as the slug base when a title slugifies to '' (e.g. an all-punctuation title). */
const EMPTY_SLUG_FALLBACK = 'article';

/** Mongo/Mongoose duplicate-key error code, raised when a unique index is violated. */
const DUPLICATE_KEY_CODE = 11000;

function isReachable(from, to) {
  return Boolean(REACHABLE[from]?.includes(to));
}

/** Owner-or-editor: required for every transition that submits into Pending Editor Approval. */
function isOwnerOrEditor(article, actor) {
  if (!actor) return false;
  if (actor.role === 'editor') return true;
  return String(article.author) === String(actor.id);
}

/** Mirrors the structural + role/ownership guards only — no content/note check. */
function actorCanAttempt(article, to, actor) {
  const from = article.state;
  if (to === 'Pending Editor Approval') {
    return isOwnerOrEditor(article, actor);
  }
  if (from === 'Pending Editor Approval' && (to === 'Published' || to === 'Returned for Corrections')) {
    return actor?.role === 'editor';
  }
  return false;
}

/** `title`, `body`, `category` all present and non-blank once trimmed. */
function hasRequiredContent(article) {
  return ['title', 'body', 'category'].every((field) => String(article[field] ?? '').trim().length > 0);
}

/** Whether the working copy differs from the currently published snapshot. */
function workingCopyDiffersFromPublished(article) {
  const fields = ['title', 'abstract', 'body', 'image', 'category'];
  return fields.some((field) => article[field] !== article.published?.[field]);
}

/**
 * Pure predicate: can `actor` move `article` to `to`, structurally and by role/
 * ownership? Never throws — payload completeness (content/note) is not checked
 * here, only capability.
 */
export function canTransition(article, to, actor) {
  if (!article || typeof article.state !== 'string') return false;
  if (!isReachable(article.state, to)) return false;
  return actorCanAttempt(article, to, actor);
}

/**
 * Applies one article lifecycle transition in place. Throws `AppError` and
 * never mutates `article` when a transition is illegal, unauthorized, or the
 * payload is incomplete. Check order: (1) structural reachability -> conflict,
 * (2) role/ownership -> forbidden, (3) content/note guard -> badRequest or, for
 * the shadow-submit no-op case, conflict, (4) apply the effect.
 */
export function applyTransition(article, to, actor, { note } = {}) {
  const from = article.state;

  if (!isReachable(from, to)) {
    throw AppError.conflict(`cannot transition from "${from}" to "${to}"`);
  }

  if (!actorCanAttempt(article, to, actor)) {
    throw AppError.forbidden();
  }

  if (to === 'Pending Editor Approval') {
    if (from === 'Published') {
      if (!workingCopyDiffersFromPublished(article)) {
        throw AppError.conflict('no changes to submit');
      }
      article.submittedAt = new Date();
      article.state = to;
      return article;
    }

    if (!hasRequiredContent(article)) {
      throw AppError.badRequest('title, body, and category are required');
    }
    article.submittedAt = new Date();
    article.editorNote = undefined;
    article.state = to;
    return article;
  }

  if (to === 'Published') {
    const now = new Date();
    const wasAlreadyPublishedBefore = Boolean(article.firstPublishedAt);
    const nextVersion = (article.published?.version ?? 0) + 1;

    article.published = {
      title: article.title,
      abstract: article.abstract,
      body: article.body,
      image: article.image,
      category: article.category,
      publishedAt: now,
      version: nextVersion,
    };

    if (!wasAlreadyPublishedBefore) {
      article.firstPublishedAt = now;
      if (!article.slug) {
        article.slug = slugify(article.title) || EMPTY_SLUG_FALLBACK;
      }
    }

    article.history.push({ at: now, kind: wasAlreadyPublishedBefore ? 'update' : 'publish', by: actor.id });
    article.submittedAt = undefined;
    article.state = to;
    return article;
  }

  // to === 'Returned for Corrections'
  if (!String(note ?? '').trim()) {
    throw AppError.badRequest('a note is required');
  }
  article.editorNote = note;
  article.submittedAt = undefined;
  article.state = to;
  return article;
}

/** True for a Mongo/Mongoose duplicate-key error raised specifically by the `slug` unique index. */
function isSlugConflict(err) {
  if (err?.code !== DUPLICATE_KEY_CODE) return false;
  if (err.keyPattern) return Object.prototype.hasOwnProperty.call(err.keyPattern, 'slug');
  if (err.keyValue) return Object.prototype.hasOwnProperty.call(err.keyValue, 'slug');
  return false;
}

/**
 * Saves `article` (any object exposing an async `save()`, e.g. a Mongoose
 * document), resolving a first-publish slug collision instead of letting the
 * `slug` unique-index violation crash the caller: on an `11000` conflict
 * specifically on `slug`, appends/bumps a numeric suffix (`base-2`, `base-3`,
 * …) and retries, up to `maxAttempts`. Any other error — including an `11000`
 * on a different field — is rethrown untouched, and `article.slug` is left as
 * it was when that error was raised.
 */
export async function saveWithSlugRetry(article, { maxAttempts = 50 } = {}) {
  const base = article.slug;
  for (let suffix = 1; suffix <= maxAttempts; suffix += 1) {
    if (suffix > 1) {
      article.slug = `${base}-${suffix}`;
    }
    try {
      return await article.save();
    } catch (err) {
      if (!isSlugConflict(err) || suffix === maxAttempts) throw err;
      logger.warn('article.slug_collision_retry', { attemptedSlug: article.slug, nextSuffix: suffix + 1 });
    }
  }
}
