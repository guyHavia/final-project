# The Daily Web

News system — course final project. Node.js + Express, MongoDB + Mongoose, EJS
for server-rendered pages, Vanilla JS + Ajax on the client.

## Quick Start

### Option A — Full Docker (recommended, no Node install needed)

```bash
# 1. Copy config and fill in SESSION_SECRET (any long random string)
cp .env.example .env

# 2. Build and start both containers (MongoDB + app) in the background
docker compose up -d --build

# 3. Seed the database (run once inside the app container)
docker compose exec app node seed/seed.js
#    → login credentials are printed at the end — save them!

# 4. Open the app
#    → http://localhost:3000
```

### Option B — Local Node + Docker MongoDB

```bash
# 1. Install Node dependencies
npm install

# 2. Copy config and fill in SESSION_SECRET
cp .env.example .env

# 3. Start only the MongoDB container
docker compose up -d mongo

# 4. Seed the database
npm run seed    # → credentials printed at the end

# 5. Start the dev server (auto-restarts on file changes)
npm run dev     # → http://localhost:3000
```

> [!NOTE]
> **No Docker at all?** Set `MONGODB_URI` in `.env` to a free [MongoDB Atlas](https://www.mongodb.com/atlas) connection string and skip steps 1/3.

## Prerequisites

- **Option A:** Docker Desktop only
- **Option B:** Node.js >= 20 + Docker Desktop (or a remote MongoDB)

## All npm scripts

```
npm run dev      # dev server with auto-restart (no Docker needed if Mongo is up)
npm start        # plain server start
npm test         # node --test — no DB required
npm run lint     # eslint .
npm run seed     # populate demo data and print login credentials
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
