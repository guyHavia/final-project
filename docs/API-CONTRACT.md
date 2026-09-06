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

### Articles  — _P2, pending_

### Comments  — _P3, pending_

### Article stats  — _P1, pending_
