import { apiRequest, me, logout } from './auth-client.js';
import { diffLines } from './line-diff.js';

const STATE_ORDER = ['Pending Editor Approval', 'Returned for Corrections', 'In Preparation', 'Published'];
const STATE_LABELS = {
  'In Preparation': 'In preparation',
  'Pending Editor Approval': 'Pending editor approval',
  Published: 'Published',
  'Returned for Corrections': 'Returned for corrections',
};
const COMPARE_FIELDS = ['title', 'category', 'abstract', 'image'];

const els = {
  userName: document.getElementById('user-display-name'),
  logoutButton: document.getElementById('logout-button'),
  groups: document.getElementById('article-groups'),
  panel: document.getElementById('review-panel'),
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

async function fetchQueue() {
  const pages = await Promise.all(STATE_ORDER.map((state) => apiRequest(`/articles?state=${encodeURIComponent(state)}`)));
  const byState = new Map(STATE_ORDER.map((state, i) => [state, pages[i].items]));
  return byState;
}

async function loadGroups() {
  els.actionError.hidden = true;
  const byState = await fetchQueue();

  els.groups.innerHTML = '';
  for (const state of STATE_ORDER) {
    const articles = byState.get(state);
    const section = document.createElement('section');
    section.className = 'article-group';
    const heading = document.createElement('h2');
    heading.textContent = `${STATE_LABELS[state]} (${articles.length})`;
    section.append(heading);

    if (articles.length > 0) {
      const list = document.createElement('ul');
      for (const article of articles) {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'article-row';
        button.textContent = `${article.title || '(untitled)'} — ${article.author.displayName}`;
        if (article.hasUnsubmittedChanges) {
          const flag = document.createElement('span');
          flag.className = 'note-flag';
          flag.textContent = ' (unsubmitted edits)';
          button.append(flag);
        }
        button.addEventListener('click', () => openReview(article.id));
        li.append(button);
        list.append(li);
      }
      section.append(list);
    }
    els.groups.append(section);
  }
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
  els.returnNote.hidden = !isPending;
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
  els.compareFields.hidden = false;
  els.compareBody.hidden = false;
}

function enterEditMode(article) {
  els.editTitle.value = article.title || '';
  els.editCategory.value = article.category || '';
  els.editAbstract.value = article.abstract || '';
  els.editImage.value = article.image || '';
  els.editBody.value = article.body || '';
  els.editForm.hidden = false;
  els.compareFields.hidden = true;
  els.compareBody.hidden = true;
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
  els.panel.hidden = false;
  els.panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeReview() {
  currentArticle = null;
  els.panel.hidden = true;
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

async function handleApprove() {
  await withActionErrorHandling(async () => {
    await apiRequest(`/articles/${currentArticle.id}/approve`, { method: 'POST' });
    closeReview();
    await loadGroups();
  });
}

async function handleReturn() {
  await withActionErrorHandling(async () => {
    await apiRequest(`/articles/${currentArticle.id}/return`, { method: 'POST', body: { note: els.returnNote.value.trim() } });
    await loadGroups();
    await openReview(currentArticle.id);
  });
}

async function handleDelete() {
  if (!window.confirm(`Delete "${currentArticle.title}"? This cannot be undone.`)) return;
  await withActionErrorHandling(async () => {
    await apiRequest(`/articles/${currentArticle.id}`, { method: 'DELETE' });
    closeReview();
    await loadGroups();
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
  });
}

function wireStaticControls() {
  els.logoutButton.addEventListener('click', async () => {
    await logout();
    window.location.href = '/login';
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
  els.userName.textContent = user.displayName;
  wireStaticControls();
  await loadGroups();
}

bootstrap();
