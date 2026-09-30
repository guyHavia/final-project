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
- Body-parser faults are mapped too: malformed JSON → 400 `bad_request`, body over
  the 256 KB JSON limit → 413 `payload_too_large`.
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
  - `429 { error: { message: "too many failed login attempts, try again later", code: "rate_limited" } }`
    after 5 failed attempts for that username within 15 minutes; the lockout
    lasts 15 minutes from the 5th failure. Checked before the credentials are
    looked up, so a locked-out username gets 429 even with the correct
    password. A successful login clears that username's failure count.
    In-memory `Map`, same style as the comment rate limiter (D8) — a restart
    resets it, which is harmless.
- `POST /api/auth/logout` — `200 → { data: { ok: true } }`. Destroys the session
  and clears the cookie. Safe to call without a session.
- `GET /api/auth/me`
  - `200 → { data: { id, username, role, displayName } }` when authenticated —
    a subset of the `userView` shape defined under "Users (admin)".
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
  and must also call `destroySessionsForUser(id)` (`config/session.js`, P1-08)
  so the user is logged out everywhere immediately.
  - `200 → { data: userView }`; `400` on an unknown field or bad `role`; `404` if not found.
- **`DELETE /api/users/:id`** — editor-only. **Soft-delete** (D2): sets
  `active: false`; the byline and `author` refs stay valid. A hard delete is
  allowed **only** when the user has zero articles (coordinate with P2's
  article count). Either path must also call `destroySessionsForUser(id)`
  (`config/session.js`, P1-08).
  - `200 → { data: { ok: true, deleted: "soft" | "hard" } }`; `404` if not found.
- **`PATCH /api/users/me`** — any authenticated user, own account only. Body is
  `{ displayName }` and/or `{ password, currentPassword }`; changing the
  password requires a correct `currentPassword`.
  - `200 → { data: userView }`; `400` if `currentPassword` is missing when
    `password` is given; `401` if `currentPassword` is wrong.

### Articles  — _P2_

**Public** means *has a published version* (`firstPublishedAt` is set), not
`state === 'Published'`. A Published article whose revision is Pending or
Returned stays public and keeps showing its last approved version. Public reads
only ever return the `published` snapshot, never the working copy.

All lists use keyset pagination: pass the previous page's `nextCursor` as
`cursor`. `nextCursor` is an opaque string, `null` exactly on the last page.
`limit` defaults to 20 and is clamped to `1..50` (non-numeric → 20). A malformed
cursor, or a cursor from a different sort, → `400 bad_request`.

Bylines are `author: { id, displayName }`. A deactivated author keeps their
name (D2); an author whose document is gone shows `"Unknown author"`.

- **`GET /api/articles?q=&category=&sort=&cursor=&limit=`** — public feed, no auth.
  - `q` — case-insensitive "contains" on the published title (regex characters are literal).
  - `category` — one of the `CATEGORIES` list, matched on the published category. Unknown → `400`.
  - `sort` — `date` (default, first publication, newest first) or `popularity`
    (`viewCount`, highest first). Ties break on `id`. Unknown → `400`.
  - `200 → { data: { items: [Card], nextCursor } }`.
  - `Card` = `{ id, slug, title, abstract, image, category, author, publishedAt, updatedAt, viewCount }`.
    `publishedAt` is the first publication date; `updatedAt` is when the current
    published version was approved. No `body` — open the article for that.
  - `state` is ignored for guests and reporters.

- **`GET /api/articles?state=…&q=&category=&cursor=&limit=`** — editor newsroom view.
  Only when the caller is an **editor** and `state` is sent; without `state` an
  editor gets the public feed, so the home page never shows drafts.
  - `state` — one of the four states, or `all`. Unknown → `400`.
  - `q` / `category` match the **working copy**. Always ordered by `updatedAt` desc; `sort` is ignored.
  - `200 → { data: { items: [WorkItem], nextCursor } }`.
  - `WorkItem` = `{ id, slug, state, title, abstract, image, category, author,
    editorNote, hasPublishedVersion, hasUnsubmittedChanges, publishedAt, submittedAt,
    updatedAt, viewCount }`
    — working-copy fields. `editorNote` is set only when `state` is
    `Returned for Corrections`, otherwise `null`. `hasPublishedVersion` marks a
    revision of an already-public article. `hasUnsubmittedChanges` is `true` only
    for a `Published` article whose working copy differs from its approved
    version — edits not yet sent for review (use it to prompt "Submit changes").

- **`GET /api/articles/mine?state=&cursor=&limit=`** — `requireAuth`; the caller's own articles.
  - Every state, or one `state` (unknown → `400`). Ordered by `updatedAt` desc.
  - `200 → { data: { items: [WorkItem], nextCursor } }`; `401` without a session.

- **`GET /api/articles/:id`** — one article.
  - **Its author, or any editor** → the full document:
    `{ id, slug, state, title, abstract, body, image, category, author, editorNote,
    submittedAt, published, hasUnsubmittedChanges, firstPublishedAt,
    history: [{ at, kind, by }], viewCount, createdAt, updatedAt }`. Top-level content fields are the working
    copy; `published` is the approved snapshot (or `null`) — enough for a diff.
  - **Anyone else** → the published version only: `Card` plus `body`. `404` if
    the article was never published (a draft's existence is not revealed).
  - `400 invalid_id` for a malformed id; `404` for an unknown one.
  - Does **not** count a view (D10). The article page render does.

#### Writing articles (P2-03) — all `requireAuth` (reporter or editor)

Request bodies may contain **only** `title`, `abstract`, `body`, `image`,
`category` — all strings. Anything else (`author`, `state`, `published`, …) →
`400 bad_request`; the author is always the session user. Text is stored as
typed (plain text — P3 renders it escaped). Limits: title 200, abstract 500,
body 50,000, image 2,000 characters. `category` must be in `CATEGORIES`.
`image` must be empty or an `http(s)://` URL.

Who may change an article's working copy: **editors** always; **reporters**
only their own (`403` otherwise) and not while it is `Pending Editor Approval`
(`409 conflict`). Editing a Published article changes only the working copy —
`published` and the public view stay as approved until an editor approves.

- **`POST /api/articles`** — body needs a non-blank `title` and a `category`.
  - `201 → { data: <full article> }` (same shape as `GET /api/articles/:id` for
    its author), `state: "In Preparation"`, `slug: null`, `published: null`.
- **`PATCH /api/articles/:id`** — full edit: at least one field; `title`, if
  sent, must be non-blank. State never changes.
  - `200 → { data: <full article> }`.
- **`PATCH /api/articles/:id/autosave`** — the debounced save behind
  "work is never lost". Any subset of the fields, **blank values allowed**
  (a half-written draft), but never invalid ones (unknown field, bad category,
  unsafe image, over-long text → `400`). State never changes.
  - `200 → { data: { id, savedAt } }` — `savedAt` is the stored `updatedAt`.
  - The draft is on the server: reopening the article from any device
    (`GET /api/articles/:id`) returns it.
- **`POST /api/articles/:id/submit`** — → `Pending Editor Approval` (owner or
  editor), via the state machine. Clears `editorNote`, sets `submittedAt`.
  - `200 → { data: <full article> }`.
  - `400` if `title`, `body` or `category` is blank; `403` for another
    reporter's article; `409` if the state can't be submitted (already
    Pending) or a Published article has no changes.

All four: `401` without a session; `400 invalid_id` for a malformed id; `404`
for an unknown one.

#### Editor decisions (P2-04) — all `requireRole('editor')`

`401` without a session, `403` for a reporter (even on their own article),
`400 invalid_id` for a malformed id, `404` for an unknown one. Which state
changes are legal is decided by the state machine; an illegal one is `409`.

- **`POST /api/articles/:id/approve`** — `Pending Editor Approval` → `Published`.
  Copies the working copy into `published`, bumps `published.version`, sets
  `slug` and `firstPublishedAt` on the first approval only (a taken slug gets
  `-2`, `-3`, …), clears `submittedAt`, and appends a `history` marker —
  `publish` the first time, `update` after — for Impact Analytics.
  - `200 → { data: <full article> }`. The public view switches to the new version at once.
- **`POST /api/articles/:id/return`** — body `{ note }` only.
  `Pending Editor Approval` → `Returned for Corrections`. `note` is required,
  trimmed, non-blank, at most 1,000 characters (else `400`). It is shown to the
  reporter as `editorNote` until they resubmit. A returned revision of a
  Published article keeps its approved version public.
  - `200 → { data: <full article> }`.
- **`DELETE /api/articles/:id`** — deletes the article, then its comments and
  view records (`ViewEvent`s). Any state.
  - `200 → { data: { ok: true } }`; `404` if already deleted.

#### Server-render hook (not an HTTP endpoint) — `getArticleForRender(slugOrId)`

For P3's `GET /article/:slug` EJS page. Import from `services/articleQuery.service.js`.

```js
import { getArticleForRender } from '../services/articleQuery.service.js';
import { recordArticleView } from '../services/articleViews.service.js';

const article = await getArticleForRender(req.params.slug);
if (!article) return res.status(404).render('404');
await recordArticleView(article.id, { viewer: req.user }); // P2-08: count the read
res.render('article', { article }); // article.body is the full text → SEO
```

- Returns `Card` plus `body` (the same fields as a public `GET /api/articles/:id`):
  `{ id, slug, title, abstract, body, image, category, author: { id, displayName },
  publishedAt, updatedAt, viewCount }`. Dates are `Date` objects (not ISO strings).
- Looks up by slug, case-insensitively; if no slug matches and the value is a
  24-character id, looks up by id (D5). When found by id, `article.slug` is the
  canonical URL to redirect to.
- Only the published version, never the working copy. `null` for an unknown,
  malformed, or never-published article. Never throws for bad input.
- Does **not** count a view: the page controller calls `recordArticleView` (below).

#### Counting a view (not an HTTP endpoint) — `recordArticleView(articleId, { viewer })`

P2-08. Call it **once per render of the article page**, and nowhere else (D10):
not from the JSON API, not from the Ajax comment load.

- Records one `ViewEvent` (P1's `recordView` — the Impact Analytics series) and
  adds 1 to the article's `viewCount` (the `sort=popularity` key). The increment
  is atomic and does **not** change `updatedAt`.
- Pass `viewer: req.user`. A logged-in reporter or editor is **not** counted, so
  the numbers reflect readers. Every reader entry counts, refreshes included.
- Only public articles (with a published version) are counted.
- Never throws — a failure is logged and the page still renders. Resolves to
  `true` when the view was counted, `false` otherwise.

### Comments — _P3_

- `GET /api/articles/:articleId/comments?cursor&limit&q` — list one article's comments, newest first. Not rate-limited.
  - `cursor` — opaque string, optional (the previous page's `nextCursor`). Malformed → `400 bad_request`.
  - `limit` — `1` to `100`, default `20`.
  - `q` — case-insensitive substring match on `body`, optional. Matched literally: regex characters such as `(` or `.*` are plain text.
  - `200 → { data: { items: [Comment], nextCursor: "<opaque or null>" } }`.
    - `items` — comments ordered newest first (ties broken by id, so paging never skips or repeats).
    - `nextCursor` — opaque string when more remain, `null` on the last page.
  - `400 { error: { code: "invalid_id" } }` if `:articleId` is not a well-formed 
    ObjectId (mapped automatically by `errorHandler`'s `CastError` case).
  - `404` if `:articleId` is well-formed but no such article exists or it has never been published.
    An article with a pending or returned revision still has a published version, so it stays open.

- `POST /api/articles/:articleId/comments` — create one comment. Guarded by `rateLimit`.
  - Request body: `{ "authorName": "...", "body": "..." }`.
  - `201 → { data: { id, article, authorName, body, createdAt } }`. Note: `deviceId` is never serialized.
  - `400 { error: { code: "validation" } }` on a missing/blank field or over max length 
    (mapped automatically by `errorHandler`'s `ValidationError` case).
  - `400 { error: { code: "invalid_id" } }` if `:articleId` is not a well-formed ObjectId.
  - `404` if `:articleId` is well-formed but no such article exists or it has never been published.
  - `429 { error: { message: "you are posting too fast, wait a moment", code: "rate_limited" } }` 
    if 4th comment from this `deviceId` within 60s; no document is created.
    `deviceId` is an httpOnly cookie issued on the first request; `app.js` parses
    the `Cookie` header into `req.cookies` with `cookie-parser`.

- `DELETE /api/comments/:id` — editor-only (`requireRole('editor')`).
  - `200 → { data: { ok: true } }`.
  - `401` with no session; `403` for a `reporter`.
  - `400 { error: { code: "invalid_id" } }` if `:id` is not a well-formed 
    ObjectId (mapped automatically by `errorHandler`'s `CastError` case).
  - `404` if `:id` is well-formed but no such comment exists or is already deleted.

### Article stats  — _P1_

- `GET /api/articles/:id/stats?from&to&bucket` — editor-only (`requireRole('editor')`).
  - `bucket` — `'hour' | 'day'`, default `'hour'`. Any other non-empty value →
    `400 { error: { message: "invalid bucket", code: "bad_request" } }`.
  - `from` / `to` — ISO 8601 date strings, optional. `to` defaults to now;
    `from` defaults to 24h before the effective `to`. Given but unparsable
    (`new Date(x)` is `Invalid Date`) → `400 { error: { message: "invalid from/to", code: "bad_request" } }`.
  - `200 → { data: { series: [{ t, count }], markers: [{ t, kind }] } }`.
    - `series` — one point per `bucket`-sized boundary spanning
      `[from, to]` inclusive, ascending, no gaps; a bucket with zero
      `ViewEvent`s still appears with `count: 0`. Bucketing uses Mongo's
      `$dateTrunc` on `ViewEvent.at`; empty buckets are filled in code
      after the aggregation.
    - `markers` — every entry in the article's `history` (not filtered by
      `from`/`to`), mapped to `{ t: entry.at.toISOString(), kind: entry.kind }`
      and sorted ascending by `at`.
  - `401` with no session; `403` for a `reporter`.
  - `400 { error: { code: "invalid_id" } }` if `:id` is not a well-formed
    ObjectId (mapped automatically by `errorHandler`'s `CastError` case).
  - `404` if `:id` is well-formed but no such article exists.
