# Contributing

Working notes for anyone contributing to **The Daily Web**.

## Orient

1. `CONTEXT.md` - domain glossary. Read first.
2. `docs/TEAM-PLAN.md` - how the 5-person team splits the work; locked decisions D1–D10.
3. `docs/roles/P{N}-*.md` - your assignment. You own **one** role. Read only yours.
4. `docs/tickets/P{N}.md` - your tickets in order. `docs/tickets/README.md` - full backlog + dependency graph.
5. `docs/API-CONTRACT.md` - the REST contract. Update it in the same PR that adds an endpoint.

## Conventions

- **ESM.** `"type": "module"`; include the `.js` in import paths.
- **Responses.** Success → `sendData(res, data)` from `lib/respond.js`, body `{ data }`.
  Errors → throw `AppError.badRequest(...)` etc. from `lib/AppError.js`, or `next(err)`.
  Never build the error body by hand. Wrap async route handlers in `asyncHandler` (`lib/asyncHandler.js`).
- **Logging.** `logger.info | warn | error(event, meta)` from `lib/logger.js` for errors and meaningful events.
- **Tests.** `npm test` (`node --test`). `node:test` + `node:assert/strict`; `supertest` for HTTP;
  `mongodb-memory-server` for anything touching Mongo. Write the test first, watch it fail, then implement.
- **Git.** `main` is protected. One branch per ticket: `feat/<ticket-id>-<slug>` (e.g. `feat/p1-01-user-model`).
  PR + one review before merge. Conventional commit subjects (`feat:`, `fix:`, `test:`, `docs:`).
- **Secrets.** Only in `.env` (git-ignored). Never commit a key.

## Layout

See `README.md` → Project structure. Design decisions are recorded in `docs/adr/`.
