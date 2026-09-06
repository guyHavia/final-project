# P1 — Identity & Access + Analytics

**You own:** who a request is, what they may do, and — second slice — how article
views are counted and charted.

## Scope

| Kind | Yours |
|------|-------|
| Models | `models/user.model.js`, `models/viewEvent.model.js` |
| Endpoints | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/articles/:id/stats` |
| Middleware | `middleware/auth.js` — `requireAuth`, `requireRole(...roles)` (shared; you author) |
| Config | `config/session.js` |
| Services | `services/stats.service.js` |
| Helper | `createUser({ username, password, role, displayName })` — exported for P5's seed |

**Not yours:** user-admin CRUD (list/create/update/delete users) → P5, from your
contract. The article publish/update history that supplies stats markers → P2
owns the data; you read it.

## Constraints from the brief

- Passwords never stored recoverably → **bcrypt** hash; `passwordHash` field is `select: false`.
- A logged-in user survives a server **Restart** with no re-login → sessions in
  MongoDB via `connect-mongo`, never `MemoryStore`. See `docs/adr/0001-mongo-backed-sessions.md`.
- Every permission check runs on the **server**. Hiding a button client-side does not count.
- Actors: `guest` (unauthenticated, never stored), `reporter`, `editor`.
- Reporter may **not** publish. Editor may do anything to any article.
- Stats: assume thousands of parallel readers; the graph is views over time with
  markers where an editor published or updated the article, readable before/after each marker.

## Decisions that bind you

- **D3** — no public signup; no `register` route. Editors create accounts (P5); the seed makes the first editor.
- **D4** — session holds `{ id, role }`, snapshotted at login. RBAC authorizes on `req.session.user.role` (the login snapshot), never a live DB role — a role change takes effect on the user's next login. A `loadUser` middleware mirrors that snapshot onto `req.user.role` and re-checks `active` **live**, so deactivation/delete logs a user out immediately.
- **D6** — you also own View-Stats + the Impact Analytics endpoint.

Full text: `docs/TEAM-PLAN.md` §6.

## Interfaces

**You consume** (from the skeleton): `sendData`, `AppError`, `asyncHandler`,
`logger`, `connectDb`, and `env` (`config/env.js` → `sessionSecret`, `mongoUri`).

**You produce** — other roles depend on these exact names:

- `requireAuth`, `requireRole(...roles)` — Express middleware. `requireRole` authorizes on
  `req.session.user.role` (the login snapshot, per D4 + ADR-0001), not a live DB read. On failure:
  `next(AppError.unauthorized())` / `next(AppError.forbidden())`.
- After login: `req.session.user = { id, role }`. `loadUser` attaches `req.user` (full doc) when a
  session exists, mirrors the session's snapshot role onto `req.user.role`, and re-checks `active`
  live — a missing or deactivated user is logged out on the next request.
- `GET /api/auth/me` → `{ data: { id, username, role, displayName } }`.
- `createUser(fields)` → saved `User` document; hashes the password itself.
- `recordView(articleId)` → `Promise<void>`; P2/P3 call it from the article-read path.
- `GET /api/articles/:id/stats?from&to&bucket` →
  `{ data: { series: [{ t, count }], markers: [{ t, kind: 'publish' | 'update' }] } }`.

## Tickets

`docs/tickets/P1.md`. Order: **P1-01 → P1-02 → P1-03 → P1-04** (this unblocks P2
and P4 — land it fast) → P1-05 → P1-06 → P1-07. P1-08 is stretch.

## Done when

Auth core + RBAC merged and P2/P4 unblocked · View-Stats model + stats endpoint
merged with tests · `createUser` handed to P5 · your four endpoints in
`docs/API-CONTRACT.md` · both your models have full CRUD + a search field
(`username`; `article`).
