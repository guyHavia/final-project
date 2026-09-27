# The Daily Web

News system — course final project. Node.js + Express, MongoDB + Mongoose, EJS
for server-rendered pages, Vanilla JS + Ajax on the client.

## Quick Start (5 steps)

```bash
# 1. Install Node dependencies
npm install

# 2. Create your local config (only needed once)
cp .env.example .env
#    → open .env and set SESSION_SECRET to any long random string

# 3. Start MongoDB (requires Docker Desktop to be running)
docker compose up -d

# 4. Seed the demo database (500 articles, users, comments, view events)
npm run seed
#    → credentials are printed at the end — save them!

# 5. Start the dev server (auto-restarts on file changes)
npm run dev
#    → open http://localhost:3000
```

> [!NOTE]
> **Don't have Docker?** Alternatives for step 3:
> - Free cloud DB: sign up at [MongoDB Atlas](https://www.mongodb.com/atlas), create a free M0 cluster, paste the connection string into `.env` as `MONGODB_URI=mongodb+srv://...`
> - Local install: install [MongoDB Community Server](https://www.mongodb.com/try/download/community) — no `.env` change needed.

## Prerequisites

- Node.js >= 20
- MongoDB — choose one:
  - **Docker (recommended):** `docker compose up -d` — starts MongoDB on port 27017 automatically
  - **MongoDB Atlas:** free cloud cluster, paste the URI into `.env`
  - **Local install:** MongoDB Community Server running on `127.0.0.1:27017`

## All npm scripts

```
npm run dev      # auto-restart on change (node --watch)
npm start        # plain run
npm test         # node --test (no DB needed)
npm run lint     # eslint .
npm run seed     # load demo data — prints login credentials at the end
```

## Project structure

```
server.js          entry point: connect DB, start listener
app.js             createApp() — Express wiring, no listener/DB (testable)
config/
  env.js           all process config, read once
  db.js            Mongoose connection
  session.js       express-session + connect-mongo            (P1)
lib/
  logger.js        structured JSON logger
  AppError.js      client-safe error with HTTP status + code
  asyncHandler.js  forwards async route errors to Express
  respond.js       sendData(res, data) — the { data } success envelope
middleware/
  error.js         notFound + terminal errorHandler
  auth.js          requireAuth, requireRole                   (P1)
  rateLimit.js     guest comment limit                        (P3)
models/            user | article | comment | viewEvent
controllers/       one per resource
routes/            one per resource, mounted under /api in routes/index.js
views/             EJS templates                              (P3 / P4)
public/            client JS + CSS                            (P3 / P4)
services/          weather, stats                             (P5 / P1)
seed/seed.js       demo dataset                               (P5)
test/              node --test files (*.test.js)
docs/
  TEAM-PLAN.md     work split, per-person steps, locked decisions
  API-CONTRACT.md  living REST contract (add as endpoints land)
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
- `main` is protected — feature branch + PR + one review before merge.
- Never commit secrets. `.env` is git-ignored.

## Team

| Person | Domain |
|--------|--------|
| P1 | Identity & Access (Users, auth, sessions, RBAC) + View-Stats & Impact Analytics |
| P2 | Articles & editorial workflow |
| P3 | Comments + public frontend (feed, article page) |
| P4 | Newsroom frontend (login, reporter area, editor area, analytics UI) |
| P5 | Platform skeleton, weather integration, seed data, user-admin CRUD |

See `docs/TEAM-PLAN.md` for detail.
