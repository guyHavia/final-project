# P3 — Comments & Public Frontend

**You own:** what a Guest sees and does — the news feed page, the article page,
and the comment system behind them.

## Scope

| Kind | Yours |
|------|-------|
| Model | `models/comment.model.js` |
| Middleware | `middleware/rateLimit.js` — guest comment limit |
| Endpoints | `GET /api/articles/:id/comments`, `POST /api/articles/:id/comments`, `DELETE /api/comments/:id` (editor) |
| Pages (EJS) | `GET /` (feed), `GET /article/:slug` |
| Client | `public/js/feed.js`, `public/js/article.js`, `public/css/public.css` |

**Not yours:** the article model and its queries (P2 — you call them), the
newsroom UI (P4), auth (P1).

## Constraints from the brief

- A guest may post **at most 3 comments per minute per device**. The **server**
  rejects the 4th with a clear message shown to the user.
- A new comment appears in the list **immediately**, with no full re-render of the whole list and no page reload.
- Feed page: first ~20 articles rendered **server-side**; then infinite scroll
  loads 20 more as the user nears the bottom; search, category filter, and sort
  (date / popularity) all happen **without a full reload**.
- Article page: the **full article text is in the first HTML response** (SEO).
  Comments load and submit via Ajax.
- Semantic HTML5. Responsive for computer, tablet, and mobile.
- Feed/search/sort correct with thousands of articles (P2's endpoints handle the query; you drive them correctly).

## Decisions that bind you

- **D8** — rate limiting is an **in-memory `Map`**, keyed by a random `deviceId`
  cookie you set on first visit (never IP). A server restart resetting the counter is acceptable.
- **D5** — article URL is `/article/:slug`.
- **D9** — the feed's "viewed / not-viewed" filter is **client-local only**:
  store seen article ids in `localStorage` on the device and filter in the
  browser. No server `seen` param, no round-trip, no schema change (guests are
  never stored).
- **D10** — your `GET /article/:slug` page controller calls `recordView(articleId)`
  exactly once, server-side, per full page render. Do **not** call it on the Ajax
  comments load or from any JSON endpoint.

## Interfaces

**You consume:**

- P2: `getArticleForRender(slug)` for the article page; `GET /api/articles?...` for the feed and its search/filter/sort/pagination.
- Skeleton: `sendData`, `AppError`, `asyncHandler`, `logger`.

**You produce:**

- `Comment` model — `{ article: ref, authorName, body, deviceId, createdAt }`. Search field: `body`.
- `rateLimit` middleware — on the 4th request in 60s: `next(AppError.tooManyRequests('you are posting too fast, wait a moment'))`.
- `POST /api/articles/:id/comments` → `{ data: <the created comment> }` so the client appends one node.
- The EJS layout / partials other pages may reuse (footer holds P5's weather widget — leave a slot).

## Tickets

Full spec: [GitHub issue #5](https://github.com/guyHavia/final-project/issues/5)
(backlog index in `docs/tickets/README.md`). Order: P3-01, P3-02 → P3-03 → then
P3-04 / P3-05 once P2-06 and P2-07 exist (build against a mocked contract
meanwhile) → P3-06 last.

## Done when

Rate limit proven by test (3 pass, 4th blocked, resets after 60s) · new comment
appears without list re-render · article page HTML contains the full body before
any JS runs · feed search/filter/sort/infinite-scroll work with no reload on a
seeded DB · layouts responsive at phone / tablet / desktop widths · full CRUD +
search on comments.
