import { apiRequest, me, logout } from './auth-client.js';
import { createSaveIndicator } from './save-indicator.js';

// Read-only once submitted; the article is locked until an editor acts on it.
const LOCKED_STATE = 'Pending Editor Approval';
const STATE_ORDER = ['Returned for Corrections', 'In Preparation', 'Pending Editor Approval', 'Published'];
const STATE_LABELS = {
  'In Preparation': 'In preparation',
  'Pending Editor Approval': 'Pending editor approval',
  Published: 'Published',
  'Returned for Corrections': 'Returned for corrections',
};

const els = {
  userName: document.getElementById('user-display-name'),
  logoutButton: document.getElementById('logout-button'),
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

async function loadGroups() {
  const { items } = await apiRequest('/articles/mine');
  const byState = new Map(STATE_ORDER.map((s) => [s, []]));
  for (const item of items) byState.get(item.state)?.push(item);

  els.groups.innerHTML = '';
  for (const state of STATE_ORDER) {
    const articles = byState.get(state);
    if (articles.length === 0) continue;

    const section = document.createElement('section');
    section.className = 'article-group';
    const heading = document.createElement('h2');
    heading.textContent = `${STATE_LABELS[state]} (${articles.length})`;
    section.append(heading);

    const list = document.createElement('ul');
    for (const article of articles) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'article-row';
      button.textContent = article.title || '(untitled)';
      if (state === 'Returned for Corrections') {
        const flag = document.createElement('span');
        flag.className = 'note-flag';
        flag.textContent = ' — editor note waiting';
        button.append(flag);
      }
      button.addEventListener('click', () => openArticle(article.id));
      li.append(button);
      list.append(li);
    }
    section.append(list);
    els.groups.append(section);
  }

  if (items.length === 0) {
    els.groups.innerHTML = '<p>No articles yet — start your first one.</p>';
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
  els.editorPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeEditor() {
  currentArticleId = null;
  indicator = null;
  els.editorPanel.hidden = true;
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
  els.logoutButton.addEventListener('click', async () => {
    await logout();
    window.location.href = '/login';
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
  els.userName.textContent = user.displayName;
  wireStaticControls();
  await loadGroups();
}

bootstrap();
