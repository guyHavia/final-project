# P2 — Articles & Editorial Workflow

**You own:** the Article aggregate and its whole life — draft to published, the
edit-after-publish shadow, autosave, and every article query in the system.

## Scope

| Kind | Yours |
|------|-------|
| Model | `models/article.model.js` |
| Services | `services/articleState.service.js` (transitions + guards) |
| Endpoints | authoring: `POST /api/articles`, `PATCH /api/articles/:id`, `PATCH /api/articles/:id/autosave`, `POST /api/articles/:id/submit`; editor: `POST /api/articles/:id/approve`, `POST /api/articles/:id/return`, `DELETE /api/articles/:id`; public: `GET /api/articles`, `GET /api/articles/mine`, `GET /api/articles/:id` |
| SSR hook | `getArticleForRender(slug)` — full populated article for P3's server render |

**Not yours:** comments (P3), the analytics graph (P1 reads your publish history),
the newsroom UI (P4 consumes your endpoints).

## Constraints from the brief

- Article states: **In Preparation**, **Pending Editor Approval**, **Published**, **Returned for Corrections**.
- Legal transitions only (5 total) — reject everything else at the service layer, not just the controller:
  - new → In Preparation
  - reporter, own article: In Preparation → Pending
  - editor: Pending → Published, or Pending → Returned (with a note)
  - reporter: Returned → Pending
  - reporter, own **published** article: Published → Pending (reachable only via submit; the published
    snapshot keeps serving the public until an editor re-approves)
- Editing a **published** article: the change goes through approval again while
  the public keeps seeing the last approved version. Only after approval does new content go live.
- Autosave: a reporter's work survives tab close / refresh / another machine, with
  no Save button. On return they get their last working copy.
- Reporter edits only their **own** articles and cannot publish. Editor edits any article.
- Feed / search / sort must stay correct with **thousands** of articles → indexes, keyset pagination.
- The article page's full text is in the **first HTML response** (SEO) → `getArticleForRender` returns everything the template needs, no client round-trip for body text.

## Decisions that bind you

- **D1** — `article.author` is a `User` ObjectId ref; render with `.populate('author', 'displayName')`.
- **D2** — a deleted user is soft-deleted (`active: false`); their `author` ref stays valid. Don't assume `author` is always an active user.
- **D5** — public article URL is `/article/:slug`; JSON API under `/api`.
- **D9** — the feed's "viewed / not-viewed" filter is client-local (`localStorage`). `GET /api/articles` takes **no** `seen`/viewed param and no model gains a `seen` field.
- **D10** — `recordView` is called from P3's `GET /article/:slug` page controller, once per full render. Your `GET /api/articles/:id` JSON endpoint must **not** call it. P2-08 is therefore "coordinate the `recordView` call site with P3", not "wire it into the JSON read".

## Interfaces

**You consume:** `requireAuth`, `requireRole` (P1); `req.session.user` / `req.user`
(P1); skeleton helpers; `recordView(articleId)` (P1).

**You produce:**

- `Article` model + a stable field list (share it the day P2-01 merges — P1, P3, P4, P5 all read it).
- `articleState` service: `canTransition(article, to, actor)` → boolean; `applyTransition(article, to, actor, { note })` → updated article or throws `AppError`.
- Publish/update history on the article (e.g. `history: [{ at, kind: 'publish' | 'update', by }]`) — P1's stats markers read this. Agree the exact shape with P1 before P1-07.
- `getArticleForRender(slug)` → `{ ...article, author: { displayName }, ... }` or `null`.
- `GET /api/articles` query params: `state`, `q` (title), `category`, `sort=date|popularity`, `cursor`, `limit`.

## Tickets

Full spec: [GitHub issue #4](https://github.com/guyHavia/final-project/issues/4)
(backlog index in `docs/tickets/README.md`). Order: **P2-01 → P2-02** (both unblock
most of your work and P4) → P2-06, P2-07 (unblock P3) → P2-03, P2-04 → P2-05 → P2-08.

## Done when

Every legal transition and every rejection has a test · published-shadow verified
end to end (edit live article → public unchanged → approve → public updates) ·
feed correct and paged with a seeded 500-article DB · `getArticleForRender`
consumed by P3 · full CRUD + `title` search · endpoints in `docs/API-CONTRACT.md`.
