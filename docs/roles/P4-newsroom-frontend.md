# P4 — Newsroom Frontend & Analytics UI

**You own:** every authenticated screen — login, the reporter's desk, the
editor's desk, and the Impact Analytics graph.

## Scope

| Kind | Yours |
|------|-------|
| Pages (EJS) | `GET /login`, `GET /newsroom` (reporter), `GET /newsroom/review` (editor), `GET /newsroom/analytics` (editor) |
| Client | `public/js/login.js`, `public/js/newsroom-reporter.js`, `public/js/newsroom-editor.js`, `public/js/analytics.js`, `public/js/auth-client.js`, `public/css/newsroom.css` |
| Library | Chart.js (via `<script>` tag or `public/vendor/`), for P4-05 only |

**Not yours:** any model, any `/api` endpoint, any permission logic. The server
enforces permissions; your UI only hides what the user cannot do.

## Constraints from the brief

- After login, a **reporter** lands in their work area, an **editor** in the management area. Role comes from `GET /api/auth/me`, not from anything editable in the browser.
- Reporter work area: list of the reporter's own articles by state; an editor with
  **visible autosave** (a "saved" indicator, no Save button); submit-for-approval;
  read the editor's note on a returned article; resubmit after fixing.
- Editor management area: articles grouped by state; a review screen that shows the
  **currently published content next to the pending new content**; approve /
  return (with a note) / edit / delete.
- Impact Analytics: pick an article → a graph of views over time with clear
  vertical markers at each publish/update, so you can read the effect before and after each one. Chart.js or canvas.
- Responsive for computer, tablet, mobile.

## Decisions that bind you

- **D4** — role is snapshotted at login; if the UI ever shows a stale role, a re-login fixes it. Don't build client-side role-refresh.
- **D5** — pages at plain paths; data from `/api/...`.

## Interfaces

**You consume** (all read-only for you):

- P1: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- P2: `GET /api/articles/mine`, `GET /api/articles?state=...`, `GET /api/articles/:id`,
  and the authoring / editor endpoints (`.../autosave`, `.../submit`, `.../approve`, `.../return`, `DELETE`).
- P1: `GET /api/articles/:id/stats?from&to&bucket` → `{ series, markers }` for the graph.

**You produce:**

- `public/js/auth-client.js` — a `fetch` wrapper that carries the session cookie,
  exposes `me()`, and redirects to `/login` on a 401. P3 may reuse it.
- A "saved / saving / error" autosave indicator pattern the reporter editor uses.

## Tickets

`docs/tickets/P4.md`. Order: P4-02 → P4-01 (needs P1-03) → P4-03 (needs P2-03) →
P4-04 (needs P2-04, P2-05) → P4-05 (needs P1-07) → P4-06 last. Start against a
mocked API contract before the endpoints exist.

## Done when

Login routes each role to the right area · autosave indicator reflects real
`PATCH .../autosave` results · review screen shows published vs pending side by
side · every editor action calls the right endpoint and refreshes the queue ·
analytics graph draws markers from the `markers` array and is readable before /
after each · screens responsive at phone / tablet / desktop widths.
