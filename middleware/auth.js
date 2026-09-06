import { User } from '../models/user.model.js';

/**
 * Attach the current user to the request when a session exists.
 *
 * The session carries a `{ id, role }` snapshot taken at login (D4 + ADR 0001).
 * We load the full document for `req.user`, but keep the snapshot's role — a
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

  user.role = snapshot.role;
  req.user = user;
  return next();
}
