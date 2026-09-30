import { apiRequest, me } from './auth-client.js';
import { diffLines } from './line-diff.js';
import { showComments, resetComments } from './newsroom-comments.js';
import { STATE_META, initShell, showToast, initials, avatarColor, timeAgo, agoLabel, hoursSince } from './shell.js';

const STATE_ORDER = ['Pending Editor Approval', 'Returned for Corrections', 'In Preparation', 'Published'];
const STAT_CAPTIONS = {
  'Pending Editor Approval': 'awaiting review',
  'Returned for Corrections': 'with reporters',
  'In Preparation': 'being written',
  Published: 'live on the site',
};
const COMPARE_FIELDS = ['title', 'category', 'abstract', 'image'];

const els = {
  stats: document.getElementById('queue-stats'),
  search: document.getElementById('queue-search'),
  categoryFilter: document.getElementById('queue-category'),
  scrim: document.getElementById('review-scrim'),
  reviewTitle: document.getElementById('review-title'),
  reviewBadges: document.getElementById('review-badges'),
  reviewMeta: document.getElementById('review-meta'),
  returnWrap: document.getElementById('return-note-wrap'),
  groups: document.getElementById('article-groups'),
  panel: document.getElementById('review-panel'),
  panelBody: document.querySelector('#review-panel .drawer-body'),
  compareHeader: document.querySelector('#review-panel .compare-header'),
  closeButton: document.getElementById('close-review-button'),
  compareToggle: document.getElementById('compare-toggle'),
  compareFields: document.getElementById('compare-fields'),
  compareBody: document.getElementById('compare-body'),
  actionBar: document.getElementById('action-bar'),
  approveButton: document.getElementById('approve-button'),
  returnNote: document.getElementById('return-note'),
  returnButton: document.getElementById('return-button'),
  editButton: document.getElementById('edit-button'),
  analyticsLink: document.getElementById('analytics-link'),
  deleteButton: document.getElementById('delete-button'),
  actionError: document.getElementById('action-error'),
  editForm: document.getElementById('edit-form'),
  editTitle: document.getElementById('edit-title'),
  editCategory: document.getElementById('edit-category'),
  editAbstract: document.getElementById('edit-abstract'),
  editImage: document.getElementById('edit-image'),
  editBody: document.getElementById('edit-body'),
  editCancelButton: document.getElementById('edit-cancel-button'),
};

let currentArticle = null;
// Each state is its own cursor-paginated query (GET /api/articles?state=...),
// so "load more" is per group: { items, nextCursor } keyed by state.
let queueByState = new Map();
// The queue shows one state at a time; the stat cards double as the switcher.
let activeState = 'Pending Editor Approval';

async function fetchStatePage(state) {
  return apiRequest(`/articles?state=${encodeURIComponent(state)}`);
}

async function loadGroups() {
  els.actionError.hidden = true;
  const pages = await Promise.all(STATE_ORDER.map(fetchStatePage));
  queueByState = new Map(STATE_ORDER.map((state, i) => [state, pages[i]]));
  renderGroups();
}

async function loadMoreForState(state) {
  const { items, nextCursor } = queueByState.get(state);
  const cursor = nextCursor;
  const next = await apiRequest(`/articles?state=${encodeURIComponent(state)}&cursor=${encodeURIComponent(cursor)}`);
  queueByState.set(state, { items: items.concat(next.items), nextCursor: next.nextCursor });
  renderGroups();
}

function countLabel(state) {
  const { items, nextCursor } = queueByState.get(state);
  return `${items.length}${nextCursor ? '+' : ''}`;
}

function renderStats() {
  els.stats.innerHTML = '';
  for (const state of STATE_ORDER) {
    const { key, label } = STATE_META[state];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `stat stat-${key}`;
    button.setAttribute('aria-pressed', String(state === activeState));
    button.innerHTML = `<span class="n">${countLabel(state)}</span><span class="l">${label}</span><span class="d">${STAT_CAPTIONS[state]}</span>`;
    button.addEventListener('click', () => {
      activeState = state;
      renderGroups();
    });
    els.stats.append(button);
  }
}

function makeBadge(state) {
  const { key, label } = STATE_META[state];
  const badge = document.createElement('span');
  badge.className = `badge b-${key}`;
  badge.textContent = label;
  return badge;
}

function makeCategory(category) {
  const cat = document.createElement('span');
  cat.className = `cat cat-${category}`;
  cat.textContent = category;
  return cat;
}

function makeAvatar(name) {
  const avatar = document.createElement('span');
  avatar.className = 'avatar avatar-sm';
  avatar.style.background = avatarColor(name);
  avatar.textContent = initials(name);
  avatar.setAttribute('aria-hidden', 'true');
  return avatar;
}

function makeCard(article) {
  const isPending = article.state === 'Pending Editor Approval';
  const card = document.createElement('article');
  card.className = 'card';

  const thumb = document.createElement('div');
  thumb.className = `thumb cat-${article.category}`;
  thumb.setAttribute('aria-hidden', 'true');
  thumb.textContent = (article.category || '?')[0].toUpperCase();

  const main = document.createElement('div');
  const tags = document.createElement('div');
  tags.className = 'meta';
  tags.append(makeCategory(article.category), makeBadge(article.state));
  if (isPending && article.hasPublishedVersion) {
    const update = document.createElement('span');
    update.className = 'badge b-prep';
    update.textContent = 'Update to live story';
    tags.append(update);
  }
  if (article.hasUnsubmittedChanges) {
    const flag = document.createElement('span');
    flag.className = 'note-flag';
    flag.textContent = 'unsubmitted edits';
    tags.append(flag);
  }

  const heading = document.createElement('h3');
  const titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.className = 'article-row';
  titleButton.textContent = article.title || '(untitled)';
  titleButton.addEventListener('click', () => openReview(article.id));
  heading.append(titleButton);

  const meta = document.createElement('div');
  meta.className = 'meta';
  const byline = document.createElement('span');
  byline.textContent = article.author.displayName;
  meta.append(makeAvatar(article.author.displayName), byline);
  if (isPending) {
    const waited = hoursSince(article.submittedAt);
    const wait = document.createElement('span');
    wait.className = `wait${waited > 48 ? ' hot' : waited > 24 ? ' warm' : ''}`;
    wait.textContent = timeAgo(article.submittedAt);
    const waiting = document.createElement('span');
    waiting.append('waiting ', wait);
    meta.append(waiting);
  } else {
    const when = document.createElement('span');
    when.textContent = agoLabel(article.updatedAt);
    meta.append(when);
  }
  main.append(tags, heading, meta);

  const actions = document.createElement('div');
  actions.className = 'actions';
  if (isPending) {
    const approve = document.createElement('button');
    approve.type = 'button';
    approve.className = 'btn btn-success btn-sm';
    approve.textContent = '✓ Approve';
    approve.addEventListener('click', () => quickApprove(article.id));
    actions.append(approve);
  }
  const review = document.createElement('button');
  review.type = 'button';
  review.className = 'btn btn-ghost btn-sm';
  review.textContent = isPending ? 'Review' : 'View';
  review.addEventListener('click', () => openReview(article.id));
  actions.append(review);

  card.append(thumb, main, actions);
  return card;
}

function matchesFilters(article) {
  const query = els.search.value.trim().toLowerCase();
  if (query && !(article.title || '').toLowerCase().includes(query)) return false;
  return !els.categoryFilter.value || article.category === els.categoryFilter.value;
}

function sortedByWaiting(articles) {
  const at = (a) => new Date(a.submittedAt ?? a.updatedAt).getTime();
  return [...articles].sort((a, b) => at(a) - at(b));
}

function renderGroups() {
  renderStats();
  els.groups.innerHTML = '';
  const { items, nextCursor } = queueByState.get(activeState);
  const visible = sortedByWaiting(items.filter(matchesFilters));

  if (visible.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = '<b>Nothing here</b>No articles match this state and filter.';
    els.groups.append(empty);
  }
  for (const article of visible) els.groups.append(makeCard(article));

  if (nextCursor) {
    const loadMore = document.createElement('button');
    loadMore.type = 'button';
    loadMore.className = 'btn btn-ghost load-more-button';
    loadMore.textContent = 'Load more';
    loadMore.addEventListener('click', () => loadMoreForState(activeState));
    els.groups.append(loadMore);
  }
}

async function quickApprove(id) {
  await withQueueErrorHandling(async () => {
    await apiRequest(`/articles/${id}/approve`, { method: 'POST' });
    await loadGroups();
    showToast('Article approved and published');
  });
}

function fieldLabel(field) {
  return field.charAt(0).toUpperCase() + field.slice(1);
}

function renderCompareFields(article) {
  els.compareFields.innerHTML = '';
  const hasPublished = Boolean(article.published);

  for (const field of COMPARE_FIELDS) {
    const pendingValue = article[field] ?? '';
    const publishedValue = hasPublished ? (article.published[field] ?? '') : null;
    const changed = hasPublished && pendingValue !== publishedValue;

    const row = document.createElement('div');
    row.className = 'compare-row' + (changed ? ' changed' : '');
    row.innerHTML = `
      <span class="compare-label">${fieldLabel(field)}</span>
      <span class="compare-published">${hasPublished ? escapeHtml(publishedValue) : '<em>not yet published</em>'}</span>
      <span class="compare-pending">${escapeHtml(pendingValue)}</span>
    `;
    els.compareFields.append(row);
  }
}

function renderCompareBody(article) {
  const hasPublished = Boolean(article.published);
  els.compareBody.innerHTML = '';

  if (!hasPublished) {
    const pre = document.createElement('pre');
    pre.className = 'body-pending-only';
    pre.textContent = article.body ?? '';
    els.compareBody.append(pre);
    return;
  }

  const lines = diffLines(article.published.body ?? '', article.body ?? '');
  const pre = document.createElement('pre');
  pre.className = 'body-diff';
  for (const line of lines) {
    const span = document.createElement('div');
    span.className = `diff-line diff-${line.type}`;
    span.textContent = (line.type === 'removed' ? '- ' : line.type === 'added' ? '+ ' : '  ') + line.text;
    pre.append(span);
  }
  els.compareBody.append(pre);
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function renderActionBar(article) {
  const isPending = article.state === 'Pending Editor Approval';
  els.approveButton.hidden = !isPending;
  els.returnWrap.hidden = !isPending;
  els.returnButton.hidden = !isPending;
  els.returnNote.value = '';
  els.returnButton.disabled = true;

  els.analyticsLink.hidden = !article.published;
  if (article.published) {
    els.analyticsLink.href = `/newsroom/analytics?articleId=${article.id}`;
  }
}

function exitEditMode() {
  els.editForm.hidden = true;
  els.compareHeader.hidden = false;
  els.compareFields.hidden = false;
  els.compareBody.hidden = false;
  els.actionBar.hidden = false;
}

function enterEditMode(article) {
  els.editTitle.value = article.title || '';
  els.editCategory.value = article.category || '';
  els.editAbstract.value = article.abstract || '';
  els.editImage.value = article.image || '';
  els.editBody.value = article.body || '';
  els.editForm.hidden = false;
  els.compareHeader.hidden = true;
  els.compareFields.hidden = true;
  els.compareBody.hidden = true;
  // The form has its own Save/Cancel; the review actions would act on the old text.
  els.actionBar.hidden = true;
  els.editTitle.focus();
}

async function openReview(id) {
  const article = await apiRequest(`/articles/${id}`);
  currentArticle = article;
  exitEditMode();
  els.actionError.hidden = true;
  els.panel.classList.remove('hide-published');
  els.compareToggle.textContent = 'Show pending only';
  renderCompareFields(article);
  renderCompareBody(article);
  renderActionBar(article);
  renderReviewHeader(article);
  els.panel.hidden = false;
  els.scrim.hidden = false;
  els.panel.scrollTop = 0;
  els.panelBody.scrollTop = 0;
  els.closeButton.focus();
  showComments(article.id);
}

function renderReviewHeader(article) {
  els.reviewTitle.textContent = article.title || '(untitled)';
  els.reviewBadges.replaceChildren(makeCategory(article.category), makeBadge(article.state));
  const name = article.author?.displayName ?? '';
  els.reviewMeta.replaceChildren(makeAvatar(name), document.createTextNode(name));
}

function closeReview() {
  currentArticle = null;
  resetComments();
  els.panel.hidden = true;
  els.scrim.hidden = true;
}

async function withActionErrorHandling(action) {
  els.actionError.hidden = true;
  try {
    await action();
  } catch (err) {
    els.actionError.textContent = err.message || 'action failed';
    els.actionError.hidden = false;
  }
}

// Card-level actions happen with no panel open, so failures surface as a toast.
async function withQueueErrorHandling(action) {
  try {
    await action();
  } catch (err) {
    showToast(err.message || 'action failed', 'error');
  }
}

async function handleApprove() {
  await withActionErrorHandling(async () => {
    await apiRequest(`/articles/${currentArticle.id}/approve`, { method: 'POST' });
    closeReview();
    await loadGroups();
    showToast('Article approved and published');
  });
}

async function handleReturn() {
  await withActionErrorHandling(async () => {
    await apiRequest(`/articles/${currentArticle.id}/return`, { method: 'POST', body: { note: els.returnNote.value.trim() } });
    // A returned article is with its reporter now: nothing left to act on here.
    closeReview();
    await loadGroups();
    showToast('Returned to the reporter for corrections');
  });
}

async function handleDelete() {
  if (!window.confirm(`Delete "${currentArticle.title}"? This cannot be undone.`)) return;
  await withActionErrorHandling(async () => {
    await apiRequest(`/articles/${currentArticle.id}`, { method: 'DELETE' });
    closeReview();
    await loadGroups();
    showToast('Article deleted');
  });
}

async function handleEditSave(event) {
  event.preventDefault();
  await withActionErrorHandling(async () => {
    await apiRequest(`/articles/${currentArticle.id}`, {
      method: 'PATCH',
      body: {
        title: els.editTitle.value,
        category: els.editCategory.value,
        abstract: els.editAbstract.value,
        image: els.editImage.value,
        body: els.editBody.value,
      },
    });
    await loadGroups();
    await openReview(currentArticle.id);
    showToast('Changes saved');
  });
}

function wireStaticControls() {
  els.search.addEventListener('input', renderGroups);
  els.categoryFilter.addEventListener('change', renderGroups);
  els.scrim.addEventListener('click', closeReview);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.panel.hidden) closeReview();
  });

  els.closeButton.addEventListener('click', closeReview);
  els.compareToggle.addEventListener('click', () => {
    els.panel.classList.toggle('hide-published');
    els.compareToggle.textContent = els.panel.classList.contains('hide-published') ? 'Show both' : 'Show pending only';
  });
  els.approveButton.addEventListener('click', handleApprove);
  els.returnButton.addEventListener('click', handleReturn);
  els.returnNote.addEventListener('input', () => {
    els.returnButton.disabled = !els.returnNote.value.trim();
  });
  els.deleteButton.addEventListener('click', handleDelete);
  els.editButton.addEventListener('click', () => enterEditMode(currentArticle));
  els.editCancelButton.addEventListener('click', exitEditMode);
  els.editForm.addEventListener('submit', handleEditSave);
}

async function bootstrap() {
  const user = await me();
  if (!user) {
    window.location.href = '/login';
    return;
  }
  initShell(user);
  wireStaticControls();
  await loadGroups();
}

bootstrap();
