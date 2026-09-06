import { User } from '../models/user.model.js';
import { AppError } from '../lib/AppError.js';

/**
 * Attach the current user to the request when a session exists.
 *
 * The session carries a `{ id, role }` snapshot taken at login (D4 + ADR 0001).
 * We load the full document for `req.user`, but overlay the snapshot's role — a
 * role change only takes effect on the user's next login. `active` is the one
 * field checked live: a missing or deactivated user has their session destroyed
 * and is treated as anonymous, so a delete/deactivate logs them out at once.
 *
 * Mount with `asyncHandler` right after the session middleware. With no session
 * this is a no-op and never touches the database.
 */
export async function loadUser(req, res, next) {
  const snapshot = req.session?.user;
  if (!snapshot) return next();

  const user = await User.findById(snapshot.id);
  if (!user || user.active === false) {
    return req.session.destroy(() => next());
  }

  // Overlay the snapshot role for authorization, but keep it out of the dirty
  // set so an unrelated `req.user.save()` downstream can't persist a stale role.
  user.role = snapshot.role;
  user.unmarkModified('role');
  req.user = user;
  return next();
}

/** Require any authenticated user. Reads `req.user` (set by `loadUser`). */
export function requireAuth(req, res, next) {
  if (req.user) return next();
  return next(AppError.unauthorized());
}

/**
 * Require the session's snapshot role to be one of `roles`. Authorizes straight
 * off `req.session.user.role` (the login snapshot, D4 + ADR 0001) rather than
 * `req.user`, so it works without `loadUser` and never does a live DB read.
 * No session → 401; wrong role → 403. Errors go through `next(AppError)` so the
 * terminal handler builds the envelope.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    const snapshot = req.session?.user;
    if (!snapshot) return next(AppError.unauthorized());
    if (!roles.includes(snapshot.role)) return next(AppError.forbidden());
    return next();
  };
}
