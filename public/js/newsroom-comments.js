import { apiRequest } from './auth-client.js';

// Comment moderation for the editor review panel (issue #56).
// Lists an article's comments (newest first, cursor "load more") and lets the
// editor delete one after a confirmation, without reloading the page.
// Comment text is user-supplied, so it is only ever written via textContent.

const PAGE_SIZE = 20;

const els = {
  section: document.getElementById('comments-section'),
  heading: document.getElementById('comments-heading'),
  list: document.getElementById('comments-list'),
  status: document.getElementById('comments-status'),
  more: document.getElementById('comments-more'),
};

let articleId = null;
let nextCursor = null;
let shown = 0;
// Bumped whenever the panel switches article/closes, so a slow response for a
// previous article can never render into the current one.
let generation = 0;

function setStatus(text) {
  els.status.textContent = text;
}

function countText(hasMore) {
  if (shown === 0) return 'No comments on this article.';
  return `${shown}${hasMore ? '+' : ''} comment${shown === 1 && !hasMore ? '' : 's'}`;
}

function refreshStatus(prefix = '') {
  setStatus(prefix + countText(Boolean(nextCursor)));
  els.more.hidden = !nextCursor;
}

function makeComment(comment) {
  const item = document.createElement('li');
  item.className = 'comment-item';
  item.dataset.commentId = comment.id;

  const head = document.createElement('div');
  head.className = 'comment-head';
  const author = document.createElement('strong');
  author.className = 'comment-author';
  author.textContent = comment.authorName;
  const when = document.createElement('time');
  when.className = 'muted';
  when.dateTime = comment.createdAt;
  when.textContent = new Date(comment.createdAt).toLocaleString();
  head.append(author, when);

  const body = document.createElement('p');
  body.className = 'comment-body';
  body.textContent = comment.body;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn btn-ghost btn-sm danger comment-delete';
  remove.textContent = 'Delete';
  remove.setAttribute('aria-label', `Delete comment by ${comment.authorName}`);
  remove.addEventListener('click', () => deleteComment(comment, item, remove));

  item.append(head, body, remove);
  return item;
}

async function deleteComment(comment, item, button) {
  if (!window.confirm(`Delete this comment by ${comment.authorName}? This cannot be undone.`)) return;
  const mine = generation;
  button.disabled = true;
  try {
    await apiRequest(`/comments/${comment.id}`, { method: 'DELETE' });
  } catch (err) {
    if (mine !== generation) return;
    // 404 means it is already gone (deleted elsewhere): drop it from the list too.
    if (err.status !== 404) {
      button.disabled = false;
      setStatus(`Could not delete comment: ${err.message || 'request failed'}`);
      return;
    }
  }
  if (mine !== generation) return;
  const next = item.nextElementSibling?.querySelector('.comment-delete') ?? item.previousElementSibling?.querySelector('.comment-delete');
  item.remove();
  shown -= 1;
  refreshStatus('Comment deleted. ');
  (next ?? els.heading).focus();
}

async function fetchPage(cursor) {
  const mine = generation;
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) params.set('cursor', cursor);
  let page;
  try {
    page = await apiRequest(`/articles/${articleId}/comments?${params}`);
  } catch (err) {
    if (mine !== generation) return;
    // Never-published articles have no public comment thread (404).
    setStatus(err.status === 404 ? 'Comments appear once the article has been published.' : `Could not load comments: ${err.message || 'request failed'}`);
    els.more.hidden = cursor == null ? true : false;
    els.more.disabled = false;
    return;
  }
  if (mine !== generation || !page) return;
  els.list.append(...page.items.map(makeComment));
  shown += page.items.length;
  nextCursor = page.nextCursor;
  els.more.disabled = false;
  refreshStatus();
}

/** Reset and load the first page of comments for the article now open in the panel. */
export async function showComments(id) {
  resetComments();
  articleId = id;
  setStatus('Loading comments…');
  await fetchPage(null);
}

/** Clear the list (panel closed or switching article). */
export function resetComments() {
  generation += 1;
  articleId = null;
  nextCursor = null;
  shown = 0;
  els.list.replaceChildren();
  els.more.hidden = true;
  els.more.disabled = false;
  setStatus('');
}

els.more.addEventListener('click', () => {
  if (!nextCursor) return;
  els.more.disabled = true;
  fetchPage(nextCursor);
});
