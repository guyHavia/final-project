# API Contract

Living document. Every endpoint owner adds their section here in the same PR that
adds the route. Frontend (P3, P4) codes against this.

## Conventions

- Base path for JSON: `/api`. Server-rendered pages live at plain paths.
- **Success**: `res` body is `{ "data": <payload> }`, HTTP 2xx. Use
  `sendData(res, payload[, status])` from `lib/respond.js`.
- **Error**: body is `{ "error": { "message": <string>, "code": <string> } }`.
  Throw `AppError.badRequest(msg)` / `.unauthorized()` / `.forbidden()` /
  `.notFound()` / `.conflict()` / `.tooManyRequests()` from `lib/AppError.js`, or
  `next(err)` — the terminal `errorHandler` formats it. Never build the error
  body by hand.
- Mongoose errors are mapped by `errorHandler`: `ValidationError` → 400
  `validation`, `CastError` → 400 `invalid_id`, duplicate key → 409 `duplicate`.
- Async route handlers are wrapped in `asyncHandler(...)`.

## How to protect a route

_Owner: P1 — merged._

`app.js` mounts `loadUser` after the session middleware, so `req.user` (full
document) and `req.session.user` (`{ id, role }` snapshot) are set on every
request that carries a valid session.

```js
import { requireAuth, requireRole } from '../middleware/auth.js';

// any logged-in user
router.get('/mine', requireAuth, asyncHandler(listMine));

// editors only — authorizes on the login-snapshot role, not a live DB read
router.post('/', requireRole('editor'), asyncHandler(create));

// either role
router.patch('/:id/autosave', requireRole('reporter', 'editor'), asyncHandler(autosave));
```

`requireAuth` → 401 `{ error: { code: "unauthorized" } }` when unauthenticated.
`requireRole(...)` → 401 when there is no session, 403
`{ error: { code: "forbidden" } }` when the role is not allowed. Both fail via
`next(AppError...)`; never build the error body in a route.

## Endpoints

### GET /api/health  — _skeleton_

`200 → { "data": { "status": "ok" } }`. No auth. Liveness check.

### Auth  — _P1_

Session is a signed `connect.sid` cookie (httpOnly, `sameSite=lax`, 7-day TTL),
backed by the `sessions` collection so a login survives a server restart. The
session stores only `{ id, role }`, snapshotted at login (D4 + ADR 0001).

- `POST /api/auth/login` — body `{ username, password }`.
  - `200 → { data: { id, username, role, displayName } }` and a `Set-Cookie`.
  - `400` if `username` or `password` is missing.
  - `401 { error: { message: "invalid credentials", code: "unauthorized" } }`
    for an unknown username, a wrong password, **or** a deactivated account —
    one message, no user enumeration.
- `POST /api/auth/logout` — `200 → { data: { ok: true } }`. Destroys the session
  and clears the cookie. Safe to call without a session.
- `GET /api/auth/me`
  - `200 → { data: { id, username, role, displayName } }` when authenticated.
  - `401` otherwise. A user deactivated or deleted mid-session is treated as
    anonymous on their next request (the session is destroyed).

### Users (admin)  — _contract by P1 (P1-05); implementation by P5 (P5-04)_

There is **no public signup** (D3) — editors create every account here. Every
`/api/users*` route below is **editor-only** (`requireRole('editor')`),
including `GET /api/users/:id`. The single exception is `PATCH /api/users/me`,
which is self-service for any authenticated user.

`userView` (the safe shape, never includes `passwordHash`):
`{ id, username, role, displayName, active, createdAt, updatedAt }`.

P5 reuses `createUser({ username, password, role, displayName })` from
`models/user.model.js` for hashing — do not call bcrypt directly.

- **`POST /api/users`** — editor-only. Body `{ username, password, role, displayName }`.
  - `201 → { data: userView }`.
  - `400` on a missing field or `role` outside `reporter|editor`.
  - `409 { error: { code: "duplicate" } }` if `username` is taken (case-insensitive).
- **`GET /api/users?q=&cursor=&limit=`** — editor-only. `q` is a case-insensitive
  substring match on `username`; `limit` defaults to 20 (cap 100); `cursor` is
  the last `id` from the previous page (keyset).
  - `200 → { data: { users: [userView], nextCursor: <id|null> } }`.
- **`GET /api/users/:id`** — editor-only.
  - `200 → { data: userView }`; `404` if not found.
- **`PATCH /api/users/:id`** — editor-only. Any subset of
  `{ role, displayName, active, password }`. `password` is re-hashed via the
  model's `setPassword`. Setting `active: false` is the soft-delete path (D2)
  and should also revoke that user's sessions (see P1-08 `destroySessionsForUser`).
  - `200 → { data: userView }`; `400` on an unknown field or bad `role`; `404` if not found.
- **`DELETE /api/users/:id`** — editor-only. **Soft-delete** (D2): sets
  `active: false`; the byline and `author` refs stay valid. A hard delete is
  allowed **only** when the user has zero articles (coordinate with P2's
  article count).
  - `200 → { data: { ok: true, deleted: "soft" | "hard" } }`; `404` if not found.
- **`PATCH /api/users/me`** — any authenticated user, own account only. Body is
  `{ displayName }` and/or `{ password, currentPassword }`; changing the
  password requires a correct `currentPassword`.
  - `200 → { data: userView }`; `400` if `currentPassword` is missing when
    `password` is given; `401` if `currentPassword` is wrong.

### Articles  — _P2, pending_

### Comments  — _P3, pending_

### Article stats  — _P1, pending_
