import { login, me } from './auth-client.js';

const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');

function areaFor(role) {
  return role === 'editor' ? '/newsroom/review' : '/newsroom';
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

// Belt-and-braces: the page route already redirects a signed-in request
// server-side, but a session established after this page loaded (e.g. the
// back button after a login in another tab) needs the same redirect here.
async function redirectIfAlreadySignedIn() {
  const user = await me();
  if (user) window.location.href = areaFor(user.role);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.hidden = true;

  const username = form.username.value.trim();
  const password = form.password.value;

  try {
    const user = await login(username, password);
    window.location.href = areaFor(user.role);
  } catch (err) {
    showError(err.message || 'invalid credentials');
  }
});

redirectIfAlreadySignedIn();
