# 1. Session state stored in MongoDB via connect-mongo

Date: 2026-09-06
Status: Accepted

## Context

The requirements say a logged-in reporter or editor must keep working after a
server **Restart** with no re-login. Authentication is username + password;
passwords must be stored so that a text leak does not reveal the original.

`express-session` with its default `MemoryStore` loses every session when the
process restarts, which fails the requirement directly.

Options considered:

1. **`express-session` + `connect-mongo`** - session id in an httpOnly cookie,
   session data in a MongoDB collection.
2. **JWT in an httpOnly cookie** - stateless, survives restart for free.
3. `express-session` + `MemoryStore` - rejected, fails the Restart requirement.

## Decision

Use **`express-session` + `connect-mongo`**, reusing the app's Mongoose
connection. Hash passwords with **bcrypt** (cost 12).

Session payload holds only `{ id, role }`. A middleware loads the full user per
request when needed.

## Consequences

- Sessions live in a `sessions` collection and survive a Restart.
- Logout is a single session-document delete; an editor deleting a user can drop
  that user's session documents to force logout.
- A TTL index on the session collection expires stale sessions.
- One extra dependency (`connect-mongo`) and one indexed Mongo read per
  authenticated request - acceptable.
- Role is snapshotted into the session at login. ~~A role change takes effect on
  the next login.~~ **Superseded (issue #62):** a role change, password change
  (own or editor reset) or deactivation now destroys the user's sessions, so a
  demoted editor loses access on their next request. Changing your own password
  keeps the current session. The snapshot stays, but is never stale for long.
  Login also regenerates the session id.

## Alternatives

JWT was rejected: logout and revocation need a denylist collection anyway, and
token expiry/refresh is hand-rolled work for no benefit at this scale.
