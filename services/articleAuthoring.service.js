import { Article, CATEGORIES, STATE, CONTENT_LIMITS, CONTENT_FIELDS } from '../models/article.model.js';
import { ROLE } from '../models/user.model.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import { applyTransition, guardTransition, saveTransition, toActor } from './articleState.service.js';
import { presentFullArticle } from './articleQuery.service.js';

/**
 * P2-03 - the reporter's writing flow: create, full edit, autosave, submit.
 * Every permission and validation rule is enforced here, on the server.
 */


/** States a reporter may still edit their own article in. Editors may edit in any state. */
const REPORTER_EDITABLE_STATES = [STATE.IN_PREPARATION, STATE.RETURNED, STATE.PUBLISHED];

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Checks a request body against CONTENT_FIELDS (the only fields a client may
 * write; anything else is a 400) and returns the fields to write. Modes differ only in what may be blank:
 * - `create` - title and category required and non-blank.
 * - `edit`   - at least one field; a title, if sent, must be non-blank.
 * - `autosave` - anything goes blank (a half-written draft), but never invalid.
 * In every mode: unknown fields, non-strings, over-long text, an unknown
 * category and a non-http(s) image are refused. Text is stored as typed.
 */
function readContent(input, mode) {
  if (input === undefined || input === null) input = {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw AppError.badRequest('request body must be a JSON object');
  }

  const fields = {};
  for (const [name, value] of Object.entries(input)) {
    if (!CONTENT_FIELDS.includes(name)) throw AppError.badRequest(`unknown field: ${name}`);
    if (typeof value !== 'string') throw AppError.badRequest(`${name} must be a string`);
    if (value.length > CONTENT_LIMITS[name]) {
      throw AppError.badRequest(`${name} is too long (max ${CONTENT_LIMITS[name]} characters)`);
    }
    fields[name] = value;
  }

  if ('category' in fields && !CATEGORIES.includes(fields.category)) {
    throw AppError.badRequest('unknown category');
  }
  if (fields.image && !isHttpUrl(fields.image)) {
    throw AppError.badRequest('image must be an http(s) URL');
  }

  const titleBlank = !String(fields.title ?? '').trim();
  if (mode === 'create') {
    if (titleBlank) throw AppError.badRequest('title is required');
    if (!('category' in fields)) throw AppError.badRequest('category is required');
  }
  if (mode === 'edit') {
    if (Object.keys(fields).length === 0) throw AppError.badRequest('nothing to update');
    if ('title' in fields && titleBlank) throw AppError.badRequest('title cannot be empty');
  }
  return fields;
}

/**
 * Loads an article and checks `user` may change its working copy:
 * editors always; reporters only their own (403), and not while it is Pending
 * Editor Approval (409). Missing article → 404; malformed id → 400 (CastError).
 */
async function loadEditable(id, user) {
  const article = await Article.findById(id);
  if (!article) throw AppError.notFound('article not found');
  if (user.role === ROLE.EDITOR) return article;

  if (String(article.author) !== String(user._id)) throw AppError.forbidden();
  if (!REPORTER_EDITABLE_STATES.includes(article.state)) {
    throw AppError.conflict('the article is waiting for editor approval and cannot be changed');
  }
  return article;
}

/**
 * Writes `fields` onto the working copy, but only if the article is still in the
 * state we checked - so a submit racing with an autosave can't slip an edit into
 * a Pending article. Never touches `published`, `state` or `author`.
 */
async function writeWorkingCopy(article, fields) {
  const updated = await Article.findOneAndUpdate(
    { _id: article._id, state: article.state },
    { $set: fields },
    { new: true, runValidators: true },
  );
  if (!updated) throw AppError.conflict('the article changed state, reload it and try again');
  return updated;
}

/** POST /api/articles - a new article In Preparation, authored by the session user. */
export async function createArticle(user, input) {
  const fields = readContent(input, 'create');
  const article = await Article.create({ ...fields, author: user._id });
  logger.info('article.created', { articleId: String(article._id), userId: String(user._id) });
  return presentFullArticle(article.toObject());
}

/** PATCH /api/articles/:id - full, validated edit of the working copy. State never changes. */
export async function editArticle(id, user, input) {
  const article = await loadEditable(id, user);
  const fields = readContent(input, 'edit');
  const updated = await writeWorkingCopy(article, fields);
  return presentFullArticle(updated.toObject());
}

/**
 * PATCH /api/articles/:id/autosave - the fast, forgiving save behind "work is
 * never lost". The draft lives on the server, so any device resumes it.
 */
export async function autosaveArticle(id, user, input) {
  const article = await loadEditable(id, user);
  const fields = readContent(input, 'autosave');
  const updated = await writeWorkingCopy(article, fields);
  return { id: String(updated._id), savedAt: updated.updatedAt };
}

/** POST /api/articles/:id/submit - to Pending Editor Approval, via the state machine's guards. */
export async function submitArticle(id, user) {
  const article = await Article.findById(id);
  if (!article) throw AppError.notFound('article not found');

  guardTransition(article);
  applyTransition(article, STATE.PENDING, toActor(user));
  await saveTransition(article);
  logger.info('article.submitted', { articleId: String(article._id), userId: String(user._id) });
  return presentFullArticle(article.toObject());
}
