# Backlog

One ticket = one branch = one PR. This table is the index. Per-owner detail:
`P1.md` next to this file for P1; GitHub issues for the rest -
[#4](https://github.com/guyHavia/final-project/issues/4) (P2),
[#5](https://github.com/guyHavia/final-project/issues/5) (P3),
[#6](https://github.com/guyHavia/final-project/issues/6) (P4),
[#3](https://github.com/guyHavia/final-project/issues/3) (P5).

## Status legend

`todo` · `in-progress` · `review` · `done` · `blocked`

## How to work a ticket

1. Branch `feat/<id>-<slug>` off `main`.
2. Write the failing test first (`npm test`), watch it fail, then implement.
3. Update `docs/API-CONTRACT.md` if the ticket adds or changes an endpoint.
4. PR → one teammate reviews → merge. Keep `main` green.

## Dependency order (critical path in **bold**)

```
S-01 skeleton ✅
      │
      ├─ P1-01 user model ─ P1-02 sessions ─ **P1-03 auth endpoints** ─ **P1-04 RBAC**
      │                                                                    │
      │                                             ┌──────────────────────┘
      │                                             ▼
      ├─ P2-01 article model ─ P2-02 state machine ─ P2-03 authoring     P4-01 login (needs P1-03)
      │        │                       │             P2-04 editor flow ─ P2-05 shadowing
      │        │                       ▼                    │
      │        ├─ P2-06 public queries ─ P2-07 SSR hook     ▼
      │        │                            │            P4-03 reporter area
      │        ▼                            ▼            P4-04 editor area
      ├─ P3-01 comment model            P3-04 feed page
      │  P3-02 rate limit ─ P3-03 comment endpoints ─ P3-05 article page ─ P3-06 responsive
      │
      ├─ P1-06 view-stats model ─ P1-07 stats endpoint ─ P4-05 analytics screen
      │
      └─ P5-03 weather · P5-04 user-admin CRUD (needs P1-04, P1-05, P2-01) · P5-05 seed (needs all models)
         P5-06 deployment (last)
```

## Tickets

| ID | Title | Owner | Size | Depends on | Status |
|----|-------|-------|------|------------|--------|
| S-01 | Shared Express skeleton | P5 | M | - | **done** (`d22944f`) |
| S-02 | ESLint + prettier + `lint` script | P5 | S | S-01 | todo (ESLint config and `lint` script exist but nothing enforces them; no CI) |
| S-03 | CI: `npm test` + `lint` on PR | P5 | S | S-02 | todo (stretch) |
| P1-01 | User model + bcrypt hashing | P1 | M | S-01 | done |
| P1-02 | Session store (connect-mongo) + Restart test | P1 | M | P1-01 | done |
| P1-03 | Auth endpoints: login / logout / me | P1 | M | P1-01, P1-02 | done |
| P1-04 | RBAC middleware: requireAuth / requireRole | P1 | S | P1-03 | done |
| P1-05 | `createUser()` helper + user-admin CRUD contract | P1 | S | P1-01 | done |
| P1-06 | View-Stats model + `recordView()` | P1 | M | S-01 | done |
| P1-07 | Impact Analytics endpoint + `stats.service.js` | P1 | L | P1-06, P2-02 | done |
| P1-08 | Login lockout + destroy-user-sessions | P1 | S | P1-03 | done |
| P2-01 | Article model (states, shadow fields, author ref, slug) | P2 | M | S-01 | done |
| P2-02 | State-machine service (transitions + guards) | P2 | L | P2-01 | done |
| P2-03 | Reporter authoring endpoints (create/edit/autosave/submit) | P2 | L | P2-02, P1-04 | done |
| P2-04 | Editor workflow endpoints (approve/return/edit/delete) | P2 | L | P2-02, P1-04 | done |
| P2-05 | Published-version shadowing | P2 | M | P2-04 | done |
| P2-06 | Public query endpoints (feed/search/filter/sort, keyset) | P2 | L | P2-01 | done |
| P2-07 | `getArticleForRender(slug)` SSR hook | P2 | S | P2-01 | done |
| P2-08 | Wire `recordView()` into article read | P2 | S | P2-06, P1-06 | in-progress (`recordArticleView` service exists; nothing calls it until the public article page, P3-05, exists) |
| P3-01 | Comment model | P3 | S | S-01 | done |
| P3-02 | Rate-limit middleware (in-memory, deviceId cookie) | P3 | M | S-01 | done |
| P3-03 | Comment endpoints (list / create / editor delete) | P3 | M | P3-01, P3-02 | done |
| P3-04 | Feed page (EJS SSR + Ajax feed) | P3 | L | P2-06, P2-07 | todo |
| P3-05 | Article page (EJS SSR + Ajax comments) | P3 | L | P2-07, P3-03 | todo |
| P3-06 | Responsive CSS + semantic HTML5 pass (public) | P3 | M | P3-04, P3-05 | todo |
| P4-01 | Login screen → route by role | P4 | M | P1-03 | done |
| P4-02 | Client auth helper (fetch wrapper, /me, role-gated UI) | P4 | S | P1-03 | done |
| P4-03 | Reporter work area (autosave editor, submit, notes) | P4 | L | P2-03 | done |
| P4-04 | Editor management area (queue, diff, approve/return/delete) | P4 | L | P2-04, P2-05 | done |
| P4-05 | Impact Analytics screen (Chart.js + markers) | P4 | M | P1-07 | done |
| P4-06 | Responsive newsroom CSS pass | P4 | M | P4-03, P4-04 | done |
| P5-02 | Wire session.js + rateLimit.js seams in app.js | P5 | S | P1-02, P3-02 | done |
| P5-03 | Weather service (15-min server cache, /api/weather) | P5 | M | S-01 | done |
| P5-04 | User-admin CRUD (`/api/users*`) | P5 | M | P1-04, P1-05, P2-01 | done |
| P5-05 | Seed script (500 articles + users + comments + stats) | P5 | L | P1-01, P2-01, P3-01, P1-06 | done |
| P5-06 | Deployment: private repo, Zip, README finalize | P5 | S | most | todo |

## Review-fix issues (#44-#62)

Fixes from the code review. Status is per branch; none is merged to `main` yet.

| Issue | Branch | Status |
|-------|--------|--------|
| #44 | `fix/44-rate-limit-bypass` | fixed on branch (unmerged) |
| #45 | `fix/45-compose-mongo-exposure` | fixed on branch (unmerged) |
| #46 | `fix/46-atomic-transitions` | fixed on branch (unmerged) |
| #47 | `fix/47-lockout-hardening` | fixed on branch (unmerged) |
| #48 | `fix/48-users-api` | fixed on branch (unmerged) |
| #49 | `fix/49-body-parse-errors` | fixed on branch (unmerged) |
| #50 | `fix/50-stats-range-cap` | fixed on branch (unmerged) |
| #51 | `fix/51-weather-service` | fixed on branch (unmerged) |
| #52 | `fix/52-security-headers` | fixed on branch (unmerged) |
| #53 | `fix/53-seed-showcase` | fixed on branch (unmerged) |
| #54 | `fix/54-analytics-screen` | fixed on branch (unmerged) |
| #55 | `fix/55-newsroom-ux` | fixed on branch (unmerged) |
| #56 | `fix/56-comment-moderation-ui` | fixed on branch (unmerged) |
| #57 | none yet | pending |
| #58 | `fix/58-backend-gaps` | fixed on branch (unmerged) |
| #59 | `fix/59-docs-hygiene` | this branch (integrates #45, #51, #58) |
| #61 | `fix/61-shared-helpers` | fixed on branch (unmerged) |
| #62 | none yet | pending |

Sizes: S ≈ half a day · M ≈ 1–2 days · L ≈ 3–4 days.
