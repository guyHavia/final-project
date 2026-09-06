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
- Async route handlers are wrapped in `asyncHandler(...)`.

## How to protect a route

_Owner: P1. Fill in when `middleware/auth.js` lands._

```
// import { requireAuth, requireRole } from '../middleware/auth.js';
// router.post('/', requireRole('editor'), asyncHandler(create));
```

## Endpoints

### GET /api/health  — _skeleton_

`200 → { "data": { "status": "ok" } }`. No auth. Liveness check.

### Auth  — _P1, pending_

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET  /api/auth/me`

### Users (admin)  — _P5, pending_

Every `/api/users*` admin route is **editor-only** (`requireRole('editor')`) —
including `GET /api/users/:id`. Only `PATCH /api/users/me` is self-service (any
authenticated user). Full request/response shapes: `docs/tickets/P1.md` P1-05.

- `POST /api/users` — editor-only
- `GET /api/users?q=&cursor=&limit=` — editor-only (search by `username`)
- `GET /api/users/:id` — editor-only
- `PATCH /api/users/:id` — editor-only (`role` / `displayName` / `active` / `password`)
- `DELETE /api/users/:id` — editor-only (soft-delete per D2)
- `PATCH /api/users/me` — self (own `displayName`, or `password` with `currentPassword`)

### Articles  — _P2, pending_

### Comments  — _P3, pending_

### Article stats  — _P1, pending_
