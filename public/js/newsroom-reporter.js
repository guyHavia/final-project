import { apiRequest, me } from './auth-client.js';
import { STATE_META, initShell, agoLabel } from './shell.js';
import { createSaveIndicator } from './save-indicator.js';

// Read-only once submitted; the article is locked until an editor acts on it.
const LOCKED_STATE = 'Pending Editor Approval';
const STATE_ORDER = ['Returned for Corrections', 'In Preparation', 'Pending Editor Approval', 'Published'];

const els = {
  scrim: document.getElementById('editor-scrim'),
  groups: document.getElementById('article-groups'),
  newButton: document.getElementById('new-article-button'),
  newForm: document.getElementById('new-article-form'),
  newTitle: document.getElementById('new-article-title'),
  newCategory: document.getElementById('new-article-category'),
  newError: document.getElementById('new-article-error'),
  editorPanel: document.getElementById('article-editor'),
  editorBanner: document.getElementById('editor-banner'),
  editorNote: document.getElementById('editor-note'),
  form: document.getElementById('article-form'),
  title: document.getElementById('field-title'),
  category: document.getElementById('field-category'),
  abstract: document.getElementById('field-abstract'),
  body: document.getElementById('field-body'),
  image: document.getElementById('field-image'),
  saveStatus: document.getElementById('save-status'),
  submitButton: document.getElementById('submit-button'),
  submitError: document.getElementById('submit-error'),
  closeEditorButton: document.getElementById('close-editor-button'),
};

let currentArticleId = null;
let indicator = null;
let myArticles = [];
let myArticlesCursor = null;

function fieldSnapshot() {
  return {
    title: els.title.value,
    category: els.category.value,
    abstract: els.abstract.value,
    body: els.body.value,
    image: els.image.value,
  };
}

function renderSaveStatus({ state, savedAt, errorMessage }) {
  if (state === 'saving') {
    els.saveStatus.textContent = 'Saving…';
  } else if (state === 'saved') {
    const time = savedAt instanceof Date ? savedAt.toLocaleTimeString() : '';
    els.saveStatus.textContent = `Saved${time ? ' at ' + time : ''}`;
  } else if (state === 'error') {
    els.saveStatus.textContent = `Not saved (${errorMessage}) — `;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'link-btn';
    retry.textContent = 'retry';
    retry.addEventListener('click', () => indicator.retry());
    els.saveStatus.append(retry);
  } else if (state === 'dirty') {
    els.saveStatus.textContent = 'Unsaved changes…';
  } else {
    els.saveStatus.textContent = '';
  }
}

function setFormEditable(editable) {
  for (const field of [els.title, els.category, els.abstract, els.body, els.image]) {
    field.disabled = !editable;
  }
}

/**
 * GET /api/articles/mine is one cursor-paginated list across every state (not
 * per-state), ordered by updatedAt desc — so "load more" fetches the next
 * page of that single list and re-buckets everything client-side, rather
 * than paginating each group independently.
 */
async function loadGroups() {
  const { items, nextCursor } = await apiRequest('/articles/mine');
  myArticles = items;
  myArticlesCursor = nextCursor;
  renderGroups();
}

async function loadMoreArticles() {
  const { items, nextCursor } = await apiRequest(`/articles/mine?cursor=${encodeURIComponent(myArticlesCursor)}`);
  myArticles = myArticles.concat(items);
  myArticlesCursor = nextCursor;
  renderGroups();
}

function renderGroups() {
  const byState = new Map(STATE_ORDER.map((s) => [s, []]));
  for (const item of myArticles) byState.get(item.state)?.push(item);

  els.groups.innerHTML = '';
  if (myArticles.length === 0) {
    els.groups.className = '';
    els.groups.innerHTML = '<div class="empty"><b>No articles yet</b>Start your first one with “New article”.</div>';
    return;
  }
  els.groups.className = 'board';

  for (const state of STATE_ORDER) {
    const articles = byState.get(state);
    const { key, label } = STATE_META[state];

    const section = document.createElement('section');
    section.className = 'article-group col';
    const heading = document.createElement('h2');
    heading.innerHTML = `<span class="badge b-${key}"></span><span class="count"></span>`;
    heading.querySelector('.badge').textContent = label;
    heading.querySelector('.count').textContent = String(articles.length);
    section.append(heading);

    if (articles.length === 0) {
      const none = document.createElement('p');
      none.className = 'muted';
      none.textContent = 'Nothing here.';
      section.append(none);
    }

    for (const article of articles) {
      const card = document.createElement('div');
      card.className = `mini cat-${article.category}`;

      const cat = document.createElement('span');
      cat.className = `cat cat-${article.category}`;
      cat.textContent = article.category;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'article-row';
      button.textContent = article.title || '(untitled)';
      button.addEventListener('click', () => openArticle(article.id));

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `Edited ${agoLabel(article.updatedAt)}`;

      card.append(cat, button, meta);
      if (state === 'Returned for Corrections') {
        const flag = document.createElement('div');
        flag.className = 'note-flag';
        flag.textContent = article.editorNote ? `Editor note: ${article.editorNote}` : 'Editor note waiting';
        card.append(flag);
      }
      section.append(card);
    }
    els.groups.append(section);
  }

  if (myArticlesCursor) {
    const loadMore = document.createElement('button');
    loadMore.type = 'button';
    loadMore.className = 'btn btn-ghost load-more-button';
    loadMore.textContent = 'Load more';
    loadMore.addEventListener('click', loadMoreArticles);
    els.groups.append(loadMore);
  }
}

async function openArticle(id) {
  const article = await apiRequest(`/articles/${id}`);
  currentArticleId = article.id;

  els.title.value = article.title || '';
  els.category.value = article.category || '';
  els.abstract.value = article.abstract || '';
  els.body.value = article.body || '';
  els.image.value = article.image || '';

  els.editorBanner.hidden = true;
  els.editorNote.hidden = true;
  els.submitError.hidden = true;

  if (article.state === 'Returned for Corrections' && article.editorNote) {
    els.editorNote.textContent = `Editor's note: ${article.editorNote}`;
    els.editorNote.hidden = false;
  }
  if (article.state === 'Published') {
    els.editorBanner.textContent = 'Editing a published article: your changes go live only after an editor approves them.';
    els.editorBanner.hidden = false;
  }

  const editable = article.state !== LOCKED_STATE;
  setFormEditable(editable);
  els.submitButton.hidden = !editable;
  els.submitButton.textContent = article.state === 'Returned for Corrections' ? 'Resubmit' : 'Submit for approval';

  indicator = createSaveIndicator({
    save: (snapshot) => apiRequest(`/articles/${currentArticleId}/autosave`, { method: 'PATCH', body: snapshot }),
    onStateChange: renderSaveStatus,
  });
  renderSaveStatus({ state: 'idle' });

  els.editorPanel.hidden = false;
  els.scrim.hidden = false;
  els.closeEditorButton.focus();
}

function closeEditor() {
  currentArticleId = null;
  indicator = null;
  els.editorPanel.hidden = true;
  els.scrim.hidden = true;
}

async function handleSubmitForApproval() {
  els.submitError.hidden = true;
  await indicator?.flush();
  try {
    await apiRequest(`/articles/${currentArticleId}/submit`, { method: 'POST' });
    closeEditor();
    await loadGroups();
  } catch (err) {
    els.submitError.textContent = err.message || 'could not submit';
    els.submitError.hidden = false;
  }
}

async function handleCreateArticle(event) {
  event.preventDefault();
  els.newError.hidden = true;
  try {
    const article = await apiRequest('/articles', {
      method: 'POST',
      body: { title: els.newTitle.value.trim(), category: els.newCategory.value },
    });
    els.newForm.hidden = true;
    els.newTitle.value = '';
    await loadGroups();
    await openArticle(article.id);
  } catch (err) {
    els.newError.textContent = err.message || 'could not create the article';
    els.newError.hidden = false;
  }
}

function wireStaticControls() {
  els.scrim.addEventListener('click', closeEditor);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.editorPanel.hidden) closeEditor();
  });

  els.newButton.addEventListener('click', () => {
    els.newForm.hidden = !els.newForm.hidden;
  });
  els.newForm.addEventListener('submit', handleCreateArticle);

  els.closeEditorButton.addEventListener('click', closeEditor);
  els.submitButton.addEventListener('click', handleSubmitForApproval);

  for (const field of [els.title, els.category, els.abstract, els.body, els.image]) {
    field.addEventListener('input', () => indicator?.notify(fieldSnapshot));
    field.addEventListener('change', () => indicator?.notify(fieldSnapshot));
  }

  // "Flush now" triggers per the save-indicator contract: tab hidden, page unloading.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') indicator?.flush();
  });
  window.addEventListener('pagehide', () => indicator?.flush());
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
