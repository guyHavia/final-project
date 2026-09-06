# TEAM PLAN — The Daily Web (final project)

Course: Internet Applications Development. Team of 5. Single Git repo, single
Express app, MVC.

Stack is fixed by the brief: **Node.js + Express, MongoDB + Mongoose, EJS for
server-rendered pages, Vanilla JS + Ajax on the client, Chart.js or canvas for
the analytics graph.** No frameworks or libraries that were not taught.

---

## 1. How the work is split

Split **by model ownership**: each backend owner takes a core model end to end —
Mongoose schema, controller, routes, validation, tests, and that model's seed
contribution. Frontend is split by area. One person owns the shared skeleton and
the cross-cutting data work.

Four core models: **Users, Articles, Comments, View-Stats.** Each needs full CRUD
(Create, Read = List/Search, Update, Delete) and search on at least one central
field.

| # | Person | Domain of responsibility | Weight |
|---|--------|--------------------------|--------|
| **P1** | **You — Identity & Access + Analytics** | The User model, authentication, sessions, password security, role-based authorization middleware — "who is this and what may they do". **Plus** the View-Stats model: view-event ingestion + the Impact Analytics aggregation endpoint. | L–XL |
| **P2** | Articles & Editorial Workflow | The Article model and its whole lifecycle: state machine, published-version shadowing, autosave, and every article query (public feed + reporter area + editor area). | XL |
| **P3** | Comments & Public Frontend | The Comment model + guest rate limiting, and the public-facing UI: the news feed page and the article page (EJS server render for SEO, Vanilla JS + Ajax for search/filter/comments/infinite scroll). | L |
| **P4** | Newsroom Frontend & Analytics UI | The authenticated UI: login screen, reporter work area, editor management area, and the Impact Analytics screen (Chart.js graph with publication markers, consuming P1's stats endpoint). | L |
| **P5** | Platform & Data | The shared skeleton (app bootstrap, DB connection, MVC layout, error handler, logging, REST envelope, `.env`), the weather integration, the seed/demo dataset, and the user-admin CRUD handed off by P1. | L |

Load is even. P1's auth core is the critical path and lands first; View-Stats is
P1's second slice once auth is merged.

---

## 2. Ground rules

- **Git**: `main` is protected. Every change on a feature branch with a PR. At
  least one teammate reviews before merge. Branches, commits, merges, and PRs
  must tell a clear story — this is graded.
- **Repo**: one repo, one Express app. Final submission is a Zip of the full
  code plus a link to a private GitHub repo.
- **Never commit secrets.** `.env` is git-ignored. `.env.example` is committed
  with blank values. Weather API key and Mongo URI live only in `.env`.
- **Module system**: ESM (`"type": "module"` in package.json), `.js` in import
  paths — matches the team's existing house style.
- **Tests**: Node's built-in runner (`node --test`, `node:test` +
  `node:assert/strict`). `supertest` for HTTP-level tests,
  `mongodb-memory-server` for a throwaway Mongo in tests.
- **Commits**: conventional prefixes (`feat:`, `fix:`, `test:`, `docs:`),
  imperative mood.
- **The contract between people is**: the Mongoose models + `docs/API-CONTRACT.md`.
  Change either → announce it in the team channel and in the PR.

---

## 3. Repo layout

`[x]` = built in the skeleton PR. Everything else is a stub the owner fills in.

```
/
  server.js                  entry: connect DB, start listener             [x] (P5)
  app.js                     createApp() — Express wiring, no listener/DB  [x] (P5)
  config/
    env.js                   all process config, read once                [x] (P5)
    db.js                    mongoose connection                          [x] (P5)
    session.js               express-session + connect-mongo                  (P1)
  lib/
    logger.js                structured JSON logger                       [x] (P5)
    AppError.js              client-safe error (status + code)            [x] (P5)
    asyncHandler.js          forwards async route errors to Express       [x] (P5)
    respond.js               sendData(res, data) — the { data } envelope  [x] (P5)
  models/
    user.model.js                (P1)
    article.model.js             (P2)
    comment.model.js             (P3)
    viewEvent.model.js           (P1)
  controllers/               one file per resource
  routes/
    index.js                 apiRouter, mounted at /api                   [x] (P5)
    *.routes.js              one per resource
  middleware/
    error.js                 notFound + terminal errorHandler            [x] (P5)
    auth.js                  requireAuth, requireRole                         (P1)
    rateLimit.js             guest comment limit                             (P3)
  services/
    weather.service.js           (P5)
    stats.service.js             (P1)
  views/                     EJS templates                              (P3, P4)
  public/                    client JS, CSS                             (P3, P4)
  seed/
    seed.js                  demo dataset                                    (P5)
  test/                      *.test.js  (node --test)
  test.preload.js            global test setup (NODE_ENV=test)           [x] (P5)
  docs/
    TEAM-PLAN.md                                                         [x]
    API-CONTRACT.md          living REST contract, everyone edits
    adr/0001-mongo-backed-sessions.md                                    [x]
  CONTEXT.md                 domain glossary                             [x]
```

---

## 4. Dependency order

0. **Skeleton — DONE** (this PR): `server.js`, `app.js`, `config/`, `lib/`,
   `middleware/error.js`, `routes/index.js`, test harness, `.env.example`,
   README. `npm test` green (11 tests). Merge to `main` before any endpoint work.
1. In parallel after merge, everyone may write their **model + unit tests**
   against Mongoose directly.
2. **P1 lands auth core + `requireRole`** (target: within the first few days).
   This unblocks P2's workflow endpoints and P4's newsroom UI.
3. **P2 and P3** build their models, controllers, and routes against the
   skeleton + auth.
4. **P3 and P4** build frontend against the API contract — can start against a
   mocked contract before the endpoints exist.
5. **P1** builds the View-Stats model + Impact Analytics endpoint after auth is
   merged. **P5** builds the seed dataset once schemas are stable, and the
   weather service any time.

---

## 5. Detailed steps

### P1 — You: Identity & Access

Scope now: **auth core + RBAC**. Handed off to P5: user-admin CRUD.

Endpoints you own now:

| Method | Path | Who | Purpose |
|--------|------|-----|---------|
| POST | `/api/auth/login` | guest | username + password → session |
| POST | `/api/auth/logout` | authed | destroy session |
| GET  | `/api/auth/me` | authed | current user `{ id, username, role, displayName }` |

Middleware you own: `requireAuth`, `requireRole(...roles)`.

**Phase 0 — align (no code)**
- Get this plan agreed by the team.
- Lock the User schema fields with P2 (see decision D1) and P5 (seed users, D3).
- Wait for P5's skeleton PR to merge before writing endpoint code. You may start
  the model now.

**Phase 1 — User model + password security** — branch `feat/user-model`
1. Write `test/user.model.test.js` first:
   - requires `username`, `passwordHash`, `role`; `username` is unique.
   - `role` enum rejects anything but `reporter` / `editor`.
   - a plain query does not return `passwordHash` (`select: false`).
   - `user.setPassword('secret')` stores a bcrypt hash — not equal to the input,
     starts with `$2`.
   - `user.verifyPassword('secret')` is `true`; `verifyPassword('wrong')` is
     `false`.
2. Implement `models/user.model.js`: `username` (unique index, lowercase, trim),
   `passwordHash` (`select: false`), `role` (enum), `displayName`, `active`
   (default `true`), `timestamps`.
3. Add `bcrypt` (cost 12). Instance methods `setPassword(plain)` and
   `verifyPassword(plain)`. Prefer an explicit method over a pre-save hook —
   easier to test, no surprise re-hashing.
4. Green → refactor → PR.

**Phase 2 — session store** — branch `feat/session-store`
1. Add `express-session`, `connect-mongo`.
2. `config/session.js`: cookie `httpOnly`, `sameSite: 'lax'`, `secure` in prod,
   `maxAge` 7 days; store = `MongoStore` reusing the Mongoose connection;
   collection `sessions`; TTL index.
3. Hand P5 the one `app.use(session(...))` line and where it goes (after body
   parser, before routes).
4. Test the Restart guarantee: spin up **two** `supertest` app instances sharing
   one Mongo. Log in on instance A, call `/api/auth/me` on instance B with the
   same cookie → still authenticated. This proves the store, not process memory.
5. PR.

**Phase 3 — auth endpoints** — branch `feat/auth-endpoints`
1. Write `test/auth.routes.test.js` first (`supertest`):
   - login with unknown username → 401, generic `"invalid credentials"` (no user
     enumeration).
   - login with wrong password → 401, same message.
   - login with correct credentials → 200, `Set-Cookie`, body has
     `{ id, username, role, displayName }` and **no** `passwordHash`.
   - `GET /api/auth/me` without cookie → 401; with cookie → 200, same shape.
   - `POST /api/auth/logout` → 200, cookie cleared, next `/me` → 401.
   - missing `username` or `password` → 400.
2. Implement controller + `routes/auth.routes.js`. On login set
   `req.session.user = { id, role }` only. A `loadUser` step (in `auth.js`)
   attaches the full document when a handler needs it. Role is snapshotted at
   login — document this (see ADR 0001).
3. Emit log events through P5's logger: `auth.login.success { userId }`,
   `auth.login.fail { username }`, `auth.logout { userId }`.
4. Green → PR.

**Phase 4 — RBAC middleware** — branch `feat/rbac-middleware` — *unblocks P2 & P4*
1. Write `test/middleware.auth.test.js` first:
   - `requireAuth`: no session → 401; session → `next()`.
   - `requireRole('editor')`: reporter session → 403; editor → `next()`.
   - `requireRole('reporter','editor')`: either role → `next()`; no session → 401.
2. Implement `middleware/auth.js`. Read role from `req.session.user.role`. On
   failure `next(AppError.unauthorized())` / `next(AppError.forbidden())` — let
   the skeleton's `errorHandler` produce the envelope. Do not hand-roll the JSON.
3. Add a "How to protect a route" section to `docs/API-CONTRACT.md` with the
   exact import line. Tell P2 and P4 it is ready.
4. PR.

**Phase 5 — handoff + support**
- Write the user-admin CRUD contract into `docs/API-CONTRACT.md` and hand to P5:
  create user (editor-only, sets a temp password), list + search by username
  (paginated), get one, patch (role / displayName / active / reset password),
  delete (orphan policy = decision D2), `PATCH /api/users/me` (self: change
  password with current-password check, change displayName).
- Give P5 a `createUser({ username, password, role, displayName })` helper so the
  seed reuses your hashing rather than inventing its own.
- Pair with P2 and P4 when they wire `requireRole` into their routes.

**Phase 6 — View-Stats model + Impact Analytics** — branch `feat/view-stats`
1. `models/viewEvent.model.js`: one doc per read — `{ article: ref, at: Date }`.
   Index `{ article: 1, at: 1 }`. No per-request write amplification beyond the
   insert; consider a capped-batch or `insertMany` buffer if load testing bites.
2. Record hook: P3's `GET /article/:slug` page controller calls the
   `recordView(articleId)` you expose, once per full page render (D10) — keep the
   coupling to one function.
3. `services/stats.service.js` + `GET /api/articles/:id/stats?from=&to=&bucket=hour`
   — Mongo aggregation bucketing `at` into intervals, returning
   `{ series: [{ t, count }], markers: [{ t, kind: 'publish' | 'update' }] }`.
   Markers come from the article's publish/update history (agree the shape with P2).
4. Tests first: bucketing math, empty ranges, marker placement. Use
   `mongodb-memory-server`.
5. CRUD + search to satisfy the four-model rule (search = by `article`).
6. Pair with P4 on the Chart.js screen.

**Phase 7 — hardening (if capacity)**
- Reclaim user-admin CRUD from P5.
- Login lockout after N failures.
- "Destroy all sessions for user X" for the editor delete/deactivate flow.

### P2 — Articles & Editorial Workflow

- **Model**: `article.model.js` — title, slug, category, abstract, body, image,
  `author` (User ref), `state`, `publishedContent` (the frozen public version),
  `workingContent` (autosave target), `editorNote`, timestamps, `publishedAt`.
- **State machine**: `In Preparation → Pending Editor Approval → Published`;
  `Pending → Returned for Corrections` (with note) `→ Pending`;
  `Published → Pending Editor Approval` (reachable only via submit; the published
  snapshot keeps serving the public until re-approval). 5 legal transitions total —
  reject every other transition at the model/service layer, not just the controller.
- **Published-version shadowing**: editing a published article writes to
  `workingContent`; the public keeps seeing `publishedContent` until an editor
  approves; approval copies working → published.
- **Autosave**: `PATCH /api/articles/:id/autosave` (debounced from the client),
  writes `workingContent`, no state change, returns fast.
- **Queries** (all must stay correct with thousands of articles, use indexes):
  - public feed: `GET /api/articles?state=published&cursor=&limit=20` (keyset
    pagination for infinite scroll), plus `q` search on title, `category`
    filter, `sort=date|popularity`.
  - reporter area: `GET /api/articles/mine` (own articles + state).
  - editor area: `GET /api/articles?state=...` across all articles.
- **SSR hook**: give P3 a function that returns one article fully populated for
  server-side render (SEO requirement — full text in the first HTML response).
- **CRUD + search**: create, read/list/search, update, delete. Search field =
  title.
- Tests first for every transition and every guard.

### P3 — Comments & Public Frontend

- **Model**: `comment.model.js` — `article` ref, `authorName`, `body`,
  `createdAt`, `deviceId` (for rate limiting). Search field = `body`.
- **Rate limit**: `middleware/rateLimit.js` — a guest device may post ≤ 3
  comments per minute; the **server** rejects the 4th with a clear message.
  Store recent comment timestamps per `deviceId` (a small TTL collection or an
  in-memory LRU is fine — decide with P5).
- **Endpoints**: `GET /api/articles/:id/comments` (paginated),
  `POST /api/articles/:id/comments`, plus delete for the editor. New comment
  returns the created comment so the client appends it without a full reload.
- **Public frontend**:
  - Feed page — EJS server render of the first 20 articles, then Vanilla JS +
    Ajax for infinite scroll, search, category filter, sort — no full reload.
  - Article page — EJS server render of the **full** article (SEO), then Ajax
    for the comments list and the add-comment form.
  - Responsive: computer / tablet / mobile. HTML5 semantic tags.
- **CRUD + search** on comments.

### P4 — Newsroom Frontend & Analytics UI

- **Login screen** → calls `POST /api/auth/login`, then routes reporter to the
  work area and editor to the management area based on `GET /api/auth/me`.
- **Reporter work area**: my-articles list by state; an editor form with visible
  autosave ("saved" indicator, no Save button); submit-for-approval action; view
  the editor note on a returned article; resubmit.
- **Editor management area**: queue grouped by state; review screen showing
  `publishedContent` vs `workingContent` side by side; approve / return
  (with note) / edit / delete.
- **Impact Analytics screen**: pick an article → Chart.js line of view events
  over time with vertical publication markers; readable before/after each marker.
  Consumes P5's stats endpoint.
- All areas assume the server already enforces permissions — the UI only hides
  what the user cannot do.

### P5 — Platform & Data

- **Skeleton — DONE** (this PR): `server.js`, `app.js` (`createApp()` factory),
  `config/env.js` + `config/db.js`, `lib/` (`logger`, `AppError`, `asyncHandler`,
  `respond`), `middleware/error.js` (`notFound` + `errorHandler`),
  `routes/index.js` (`/api/health`), `test.preload.js`, `.env.example`, README,
  `npm` scripts. `npm test` green. **Your remaining job here:** wire in P1's
  `session.js` and P3's `rateLimit.js` at the seams in `app.js` as they land;
  add an `eslint` config + `lint` script; add file logging if the defense wants a
  log artifact.
- **Weather** `services/weather.service.js`: fetch Tel Aviv weather from
  OpenWeatherMap (or equivalent), cache server-side, refresh at most every 15
  minutes, serve the cached value to every visitor. `GET /api/weather`. Never
  hardcode weather data. Key in `.env`.
- **Seed** `seed/seed.js`: 500 articles across all states and categories;
  several reporters + one editor (via P1's `createUser` helper); comments;
  articles mid-workflow; articles pending approval; published articles; several
  published articles updated after first publish; view-event time series dense
  enough to draw Impact Analytics with visible publication markers.
- **User-admin CRUD** handed off from P1 (contract in `API-CONTRACT.md`).
- **Deployment**: private GitHub repo, Zip packaging, README (install steps,
  project structure, key files, how to run, how to seed).

---

## 6. Locked decisions

All settled 2026-09-06. Change one → announce it and update this section.

- **D1 — Article author identity → ref + populate.** `article.author` is a User
  `ObjectId` ref; render with `.populate('author', 'displayName')`. Denormalise a
  cached name onto the article only if feed profiling later proves populate is
  the bottleneck.
- **D2 — Deleting a user who has articles → soft-delete.** "Delete user" sets
  `active: false`. The user can no longer log in; their byline and articles stay
  intact; the `author` ref stays valid. A true hard-delete is allowed only when
  the user has zero articles.
- **D3 — Account creation → editor-only, no public signup.** There is no
  `register` route. Editors create all accounts via user-admin CRUD. The seed
  script creates the first editor.
- **D4 — Role freshness → snapshot at login.** Session holds `{ id, role }`; a
  role change takes effect on the user's next login. The per-request middleware
  re-checks `active` live, so deactivation/delete logs a user out immediately.
  See ADR 0001.
- **D5 — URLs → `/api` split, articles by slug.** JSON API under `/api/...`;
  server-rendered EJS pages at plain paths (`/`, `/article/:slug`, `/newsroom`,
  `/login`). Article public URL uses `slug`, with `id` as a fallback.
- **D6 — P1's second model → View-Stats.** P1 owns Users **and** View-Stats +
  the Impact Analytics endpoint. User-admin CRUD goes to P5. P5 no longer owns a
  core model.
- **D7 — Skeleton → built now, owned by P5.** Merged as the first PR (see
  section 4 step 0). P5 maintains it; P1 adds `session.js` at the seam.
- **D8 — Comment rate-limit storage → in-memory Map.** Keyed by a random
  `deviceId` cookie set on first visit (not IP). A restart resetting the counter
  is harmless. Move to a TTL Mongo collection only if the app ever runs more than
  one instance.
- **D9 — "Viewed / not-viewed" feed filter → client-local only.** The feed's
  viewed/not-viewed toggle is stored per-device in `localStorage`. No server
  `seen` query param, no `seen`/`viewed` field on any model, no schema change.
  Guests are never persisted (CONTEXT.md), so the server cannot know what a device
  has seen. P3 implements the filter in the browser; P2's feed endpoint is
  untouched. Applies to `docs/roles/P2` + `docs/roles/P3`.
- **D10 — `recordView` fires once per full article-page render.** P3's
  `GET /article/:slug` page controller calls `recordView(articleId)` exactly once,
  server-side, when it renders the full article page. It is **not** called on Ajax
  comment loads and **not** from the JSON API (`GET /api/articles/:id`). One view
  = one human page view; no write amplification. Applies to `docs/roles/P2`
  (P2-08) + `docs/roles/P3`.
