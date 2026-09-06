# P5 — Platform & Data

**You own:** the ground everyone builds on, the outside world (weather), the demo
dataset, and the admin corner of the User model.

## Scope

| Kind | Yours |
|------|-------|
| Skeleton | `server.js`, `app.js`, `config/`, `lib/`, `middleware/error.js`, `routes/index.js` — **built (S-01)**; you maintain it |
| Tooling | ESLint + prettier config, `lint` script, (stretch) CI |
| Services | `services/weather.service.js` |
| Endpoints | `GET /api/weather`; user-admin CRUD `GET/POST/PATCH/DELETE /api/users`, `PATCH /api/users/me` |
| Seed | `seed/seed.js` |
| Release | private GitHub repo, Zip packaging, final README |

**Not yours:** the four core models' schemas (P1/P2/P3 own those). You *use* the
`User` model and P1's `createUser` helper; you don't design them.

## Constraints from the brief

- MVC: clear Model / View / Controller separation; the skeleton already sets the shape.
- Keep logs of errors and meaningful events — the `logger` exists; make sure controllers use it.
- Weather: Tel Aviv, from a real web service (e.g. OpenWeatherMap), **never hardcoded**.
  Every visitor sees data **no more than 15 minutes old**, and the site assumes thousands of parallel users → fetch once, cache server-side, serve the cache.
- Errors and invalid input handled on **both** client and server; nothing leaves the DB in a corrupt state.
- Demo data must exercise **every** requirement: 500 articles across all states
  and categories; several reporters + one editor; comments; articles mid-workflow;
  articles pending approval; published articles; several published articles updated
  **after** first publish; a dense view-event series so Impact Analytics has a real
  graph with visible publish/update markers.
- Final submission: a Zip of the full code + a link to a private, secured GitHub repo. No keys or tokens in the repo, ever.

## Decisions that bind you

- **D3** — user creation is editor-only; the seed creates the first editor.
- **D6** — you do **not** own a core model. View-Stats went to P1.
- **D7** — you maintain the skeleton; wire P1's `session.js` and P3's `rateLimit.js` at the seams in `app.js`.
- **D8** — rate-limit storage is in-memory (P3 owns it); nothing for you to persist.

## Interfaces

**You consume:** P1 `createUser(fields)`, the `User` model, `requireRole('editor')`;
all four models for the seed; `env` for `WEATHER_API_KEY`.

**You produce:**

- A stable skeleton API (already published: `sendData`, `AppError`, `asyncHandler`,
  `logger`, `createApp`, `connectDb`). Announce any change.
- `GET /api/weather` → `{ data: { tempC, description, icon, observedAt } }`, served from cache.
- `npm run seed` — idempotent (safe to re-run), prints a summary and the demo login credentials.
- User-admin CRUD per P1's contract in `docs/API-CONTRACT.md`.

## Tickets

`docs/tickets/P5.md`. Order: S-02 → P5-03 (independent, do any time) → P5-02 (as
P1-02 / P3-02 land) → P5-04 (needs P1-04, P1-05) → P5-05 (needs all four models) →
P5-06 last.

## Done when

`npm run lint` clean and wired into review · weather widget shows live data
refreshed ≤15 min, one upstream call regardless of traffic · `npm run seed`
produces a DB that demonstrates every brief requirement · user-admin CRUD passes
its tests and rejects non-editors · repo is private, Zip builds, README lets a
stranger run the project.
