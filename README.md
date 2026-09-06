# The Daily Web

News system — course final project. Node.js + Express, MongoDB + Mongoose, EJS
for server-rendered pages, Vanilla JS + Ajax on the client.

## Prerequisites

- Node.js >= 20 (developed on 25)
- MongoDB — a local `mongod`, or a free MongoDB Atlas cluster

## Setup

```
npm install
cp .env.example .env      # then fill in MONGODB_URI, SESSION_SECRET, WEATHER_API_KEY
```

## Run

```
npm run dev      # auto-restart on change (node --watch)
npm start        # plain run
npm test         # node --test
npm run seed     # load demo data (500 articles, users, comments, view stats)
```

`npm run dev` / `npm start` need a reachable MongoDB. `npm test` does not — the
skeleton tests exercise the Express app without a DB connection.

## Project structure

```
server.js          entry point: connect DB, start listener
app.js             createApp() — Express wiring, no listener/DB (testable)
config/
  env.js           all process config, read once
  db.js            Mongoose connection
  session.js       express-session + connect-mongo            (P1, not yet added)
lib/
  logger.js        structured JSON logger
  AppError.js      client-safe error with HTTP status + code
  asyncHandler.js  forwards async route errors to Express
  respond.js       sendData(res, data) — the { data } success envelope
middleware/
  error.js         notFound + terminal errorHandler
  auth.js          requireAuth, requireRole                   (P1, not yet added)
  rateLimit.js     guest comment limit                        (P3, not yet added)
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
