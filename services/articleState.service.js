import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import { STATE, CONTENT_FIELDS } from '../models/article.model.js';
import { ROLE } from '../models/user.model.js';

/**
 * The legal edges of the article lifecycle. Anything not listed here - including
 * every X -> X self-transition - is structurally illegal regardless of actor.
 */
const REACHABLE = {
  [STATE.IN_PREPARATION]: [STATE.PENDING],
  [STATE.RETURNED]: [STATE.PENDING],
  [STATE.PUBLISHED]: [STATE.PENDING],
  [STATE.PENDING]: [STATE.PUBLISHED, STATE.RETURNED],
};

/**
 * Readable unicode slug: NFC-normalised and lowercased, keeps letters, combining
 * marks and digits of any script (so a Hebrew title stays Hebrew), turns every
 * other run into one dash, strips edge dashes. URL-safe: only letters, digits and
 * `-` remain; browsers percent-encode non-ASCII in the path and Express decodes it.
 * Returns '' when nothing is left (all punctuation) - the caller falls back.
 */
export function slugify(title) {
  return String(title ?? '')
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Used as the slug base when a title slugifies to '' (an all-punctuation or
 * symbol-only title). Suffixed with the article id when there is one, so these
 * articles never collide with each other and never exhaust the retry budget.
 */
const EMPTY_SLUG_FALLBACK = 'article';

function fallbackSlug(article) {
  return article._id ? `${EMPTY_SLUG_FALLBACK}-${article._id}` : EMPTY_SLUG_FALLBACK;
}

/** Mongo/Mongoose duplicate-key error code, raised when a unique index is violated. */
const DUPLICATE_KEY_CODE = 11000;

function isReachable(from, to) {
  return Boolean(REACHABLE[from]?.includes(to));
}

/** Owner-or-editor: required for every transition that submits into Pending Editor Approval. */
function isOwnerOrEditor(article, actor) {
  if (!actor) return false;
  if (actor.role === ROLE.EDITOR) return true;
  // `author` is a bare id, or a User document when the caller used `.populate('author')`.
  const authorId = article.author?._id ?? article.author;
  return String(authorId) === String(actor.id);
}

/** Mirrors the structural + role/ownership guards only - no content/note check. */
function actorCanAttempt(article, to, actor) {
  const from = article.state;
  if (to === STATE.PENDING) {
    return isOwnerOrEditor(article, actor);
  }
  if (from === STATE.PENDING && (to === STATE.PUBLISHED || to === STATE.RETURNED)) {
    return actor?.role === ROLE.EDITOR;
  }
  return false;
}

/** `title`, `body`, `category` all present and non-blank once trimmed. */
function hasRequiredContent(article) {
  return ['title', 'body', 'category'].every((field) => String(article[field] ?? '').trim().length > 0);
}

/** Whether the working copy differs from the currently published snapshot. */
export function workingCopyDiffersFromPublished(article) {
  return CONTENT_FIELDS.some((field) => article[field] !== article.published?.[field]);
}

/** A session user as the state machine expects an actor. */
export function toActor(user) {
  return { id: String(user._id), role: user.role };
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

  // Every submit and every approve needs complete content - including a revision
  // of a Published article, and an approve after an editor edited during review -
  // so an empty article can never reach the public.
  if ((to === STATE.PENDING || to === STATE.PUBLISHED) && !hasRequiredContent(article)) {
    throw AppError.badRequest('title, body, and category are required');
  }

  if (to === STATE.PENDING) {
    if (from === STATE.PUBLISHED) {
      if (!workingCopyDiffersFromPublished(article)) {
        throw AppError.conflict('no changes to submit');
      }
      article.submittedAt = new Date();
      article.state = to;
      return article;
    }

    article.submittedAt = new Date();
    article.editorNote = undefined;
    article.state = to;
    return article;
  }

  if (to === STATE.PUBLISHED) {
    const now = new Date();
    const wasAlreadyPublishedBefore = Boolean(article.firstPublishedAt);
    const nextVersion = (article.published?.version ?? 0) + 1;

    article.published = {
      ...Object.fromEntries(CONTENT_FIELDS.map((field) => [field, article[field]])),
      publishedAt: now,
      version: nextVersion,
    };

    if (!wasAlreadyPublishedBefore) {
      article.firstPublishedAt = now;
      if (!article.slug) {
        article.slug = slugify(article.title) || fallbackSlug(article);
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

/**
 * Makes the next `save()` of a loaded `article` conditional on it still being in
 * the state and at the revision (`updatedAt`, bumped by every content write) it
 * was read at. When another request got there first the save matches nothing
 * and throws `DocumentNotFoundError`, which `saveTransition` reports as a 409.
 * Call before `applyTransition`, while the document is still as loaded.
 */
export function guardTransition(article) {
  article.$where = { state: article.state, updatedAt: article.updatedAt };
}

/** Like `saveWithSlugRetry`, but a lost race (see `guardTransition`) is a 409 conflict. */
export async function saveTransition(article) {
  try {
    return await saveWithSlugRetry(article);
  } catch (err) {
    // VersionError: history is a versioned array, so a racing push is rejected that way.
    if (err?.name === 'DocumentNotFoundError' || err?.name === 'VersionError') {
      throw AppError.conflict('the article changed, reload it and try again');
    }
    throw err;
  }
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
 * …) and retries, up to `maxAttempts`. Any other error - including an `11000`
 * on a different field - is rethrown untouched, and `article.slug` is left as
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
