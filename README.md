# The Daily Web 🚀

News system - course final project. Node.js + Express, MongoDB + Mongoose, EJS
for server-rendered pages, Vanilla JS + Ajax on the client.

## Quick Start

The easiest way to run the project is using Docker Desktop. You don't need Node.js or MongoDB installed on your computer.

```bash
# 1. Copy the config file
cp .env.example .env
#    → Open .env and set SESSION_SECRET to any random string

# 2. Build and start the app + database in the background
docker compose up -d --build

# 3. Seed the database with demo data (run this once)
docker compose exec app node seed/seed.js
#    → Login credentials will be printed at the end - save them!

# 4. Open the app in your browser
#    → http://localhost:3000
```

> **MongoDB access:** the compose file publishes MongoDB on `127.0.0.1:27017` only (loopback), so other machines cannot reach it. It has no authentication, so never change the binding to `0.0.0.0`. From the host use `mongosh mongodb://127.0.0.1:27017/the-daily-web` or `npm run dev`; the app container reaches it over the compose network.

### Managing the App

```bash
# Stop the app and database
docker compose down

# Restart the app (then re-seed if needed)
docker compose restart

# View live server logs
docker compose logs -f app
```

## Features

- **Public site** (`/`, `/article/:slug`): server-rendered feed with infinite
  scroll, search, category filter and sort by date or popularity; full article
  page with SEO-friendly server-rendered content; guest comments with no account
  (device-cookie rate limit, 3/min); a weather widget cached server-side for
  15 minutes.
- **Newsroom** (`/login`, `/newsroom`, `/newsroom/review`, `/newsroom/analytics`):
  reporters write with autosave and submit for review; editors approve, return
  with a note, edit or delete, moderate comments, manage users, and see Impact
  Analytics (views over time with publish/update markers).
- **Workflow**: In Preparation, Pending Editor Approval, Returned for
  Corrections, Published; a published article keeps its approved version public
  while a revision is reviewed.
- **Security**: MongoDB-backed session cookies, bcrypt passwords, role-based
  access, login lockout, no public signup.

## All npm scripts

```
npm run dev      # dev server with auto-restart (no Docker needed if Mongo is up)
npm start        # plain server start
npm test         # node --test; test config in test.preload.js; DB tests use mongodb-memory-server
                 # (in-memory, no local Mongo needed; first run downloads a mongod binary)
npm run lint     # eslint .
npm run seed     # populate demo data and print login credentials (refuses NODE_ENV=production unless --force)
```

## Project structure

```
server.js          entry point: connect DB, start listener
app.js             createApp() - Express wiring, no listener/DB (testable)
config/
  env.js           all process config, read once
  db.js            Mongoose connection
  session.js       express-session + connect-mongo            (P1)
lib/
  logger.js        structured JSON logger
  AppError.js      client-safe error with HTTP status + code
  asyncHandler.js  forwards async route errors to Express
  respond.js       sendData(res, data) - the { data } success envelope
  cursor.js        opaque keyset-pagination cursor (encode / decode)  (P2)
middleware/
  error.js         notFound + terminal errorHandler
  auth.js          requireAuth, requireRole, loadUser         (P1)
  loginLockout.js  failed-login lockout                       (P1)
  rateLimit.js     guest comment limit                        (P3)
models/            user | article | comment | viewEvent
controllers/       one per resource
  article.controller.js   thin handlers for every /api/articles endpoint  (P2)
routes/            one per resource, mounted under /api in routes/index.js;
                   public.routes.js serves the public pages (/, /article/:slug)  (P3)
                   newsroom.routes.js serves the newsroom pages (/login, /newsroom*)  (P4)
  article.routes.js       /api/articles: feed, mine, read, write, review  (P2)
views/             EJS: index, article, 404 (P3); login, newsroom* (P4); partials
public/            client JS + CSS                            (P3 / P4)
services/          business logic, called by the controllers
  articleState.service.js      article lifecycle: legal transitions + guards  (P2)
  articleQuery.service.js      feed, newsroom, my articles, one article,
                               getArticleForRender (article page, SEO)        (P2)
  articleAuthoring.service.js  create, edit, autosave, submit                  (P2)
  articleReview.service.js     approve, return with a note, delete             (P2)
  articleViews.service.js      recordArticleView: counts an article page view  (P2)
  stats.service.js             recordView + Impact Analytics series            (P1)
  weather.service.js           weather, cached server-side                     (P5)
seed/seed.js       demo dataset                               (P5)
test/              node --test files (*.test.js), support/mongo.js
test.preload.js    sets the test environment before the suite
docs/
  TEAM-PLAN.md     work split, per-person steps, locked decisions
  API-CONTRACT.md  living REST contract (add as endpoints land)
  roles/           per-person scope (P1..P5)
  tickets/         backlog and status
  adr/             architecture decision records
CONTEXT.md         domain glossary
```

## Conventions

- ESM (`"type": "module"`), `.js` in import paths.
- Success responses: `{ data: <payload> }`. Errors: `{ error: { message, code } }`.
- Throw `AppError.badRequest(...)` etc. for expected failures; anything else
  becomes a 500 with its message hidden.
- Wrap async route handlers in `asyncHandler`.
- JSON API under `/api/...`; server-rendered pages at plain paths.
- `main` is protected - feature branch + PR + one review before merge.
- Never commit secrets. `.env` is git-ignored.

## Team

| Person | Domain |
|--------|--------|
| P1 | Identity & Access (Users, auth, sessions, RBAC) + View-Stats & Impact Analytics |
| P2 | Articles & editorial workflow |
| P3 | Comments + public frontend (feed, article page) |
| P4 | Newsroom frontend (login, reporter area, editor area, analytics UI) |
| P5 | Platform skeleton, weather integration, seed data, user-admin CRUD |

See `docs/TEAM-PLAN.md` and `docs/roles/` for detail.

### Contributions

Commits per person, from `git shortlog -sne` with duplicate identities merged
by `.mailmap` (counts as of this branch; rerun the command to refresh).

| Person | Git identity | Role | Commits |
|--------|--------------|------|---------|
| Guy HaVia | Guy HaVia (also Guy Havia) | P1 | 34 |
| Lital-Yos | Lital-Yos | P2 | 19 |
| Anat | Anat (also Anat-Bar) | P3 | 9 |
| tshnitz | tshnitz | P4 | 13 |
| OriP | OriP | P5 | 19 |

Commit counts measure activity, not effort. The code-review fix branches
(`docs/tickets/README.md`) were committed under P1's identity.
