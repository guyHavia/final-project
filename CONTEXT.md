# CONTEXT — The Daily Web

Glossary for the final project. Definitions only, no implementation detail.
Keep this file a glossary and nothing else.

## Actors

- **Guest** — an unauthenticated visitor. Never stored in the database. May read
  published articles and post comments within the comment rate limit.
- **Reporter** — an authenticated staff user who writes articles. May create and
  edit only their own articles. May not publish.
- **Editor** — an authenticated staff user who reviews articles. May edit any
  article, publish it, return it for corrections, or delete it.
- **Role** — `reporter` or `editor`. Determines what an actor may do. Decided by
  the server from stored user data; never derived from anything the client sends.
- **Deactivated user** — a staff user who has been "deleted". They can no longer
  sign in, but their byline and their articles remain in place. Deletion is
  deactivation; records are not removed.

## Articles

- **Article state** — exactly one of: *In Preparation*, *Pending Editor Approval*,
  *Published*, *Returned for Corrections*. A *Published* article whose author submits
  edits re-enters *Pending Editor Approval*; its published version keeps serving the
  public until an editor re-approves.
- **Published version** — the approved article content currently shown to the
  public.
- **Working copy** — a reporter's in-progress edits to an article. For an
  already-published article the working copy is invisible to the public until an
  editor approves it; the published version keeps showing in the meantime.
- **Editor note** — text an editor attaches when returning an article for
  corrections.
- **Autosave / work persistence** — the guarantee that a reporter's working copy
  survives a tab close, a page refresh, or moving to another computer.

## Engagement

- **Comment** — a guest's text response attached to an article.
- **Comment rate limit** — a guest may post at most 3 comments per minute per
  device.

## Analytics

- **View event** — one recorded read of a published article, timestamped.
- **Publication marker** — a point in time when an editor published or updated an
  article.
- **Impact Analytics** — the editor's per-article graph of view events over time
  with publication markers drawn on it.

## Integration

- **Weather widget** — Tel Aviv weather in the site footer, sourced live from an
  external web service, no older than 15 minutes for any visitor.
