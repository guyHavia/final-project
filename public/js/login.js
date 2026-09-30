import { login, me } from './auth-client.js';

const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');

function areaFor(role) {
  return role === 'editor' ? '/newsroom/review' : '/newsroom';
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
  // Keyboard/screen-reader users land back on the field to retype, with the error linked to it.
  const password = form.password;
  password.setAttribute('aria-invalid', 'true');
  password.setAttribute('aria-describedby', 'login-error');
  password.focus();
  password.select();
}

// The page route already redirects a signed-in request server-side, so a
// normal load never needs a /api/auth/me probe (which would log a 401 in the
// console for every signed-out visitor). Only a page restored from the
// back/forward cache can be stale — e.g. after a login in another tab — so
// probe then.
async function redirectIfAlreadySignedIn() {
  const user = await me();
  if (user) window.location.href = areaFor(user.role);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.hidden = true;
  form.password.removeAttribute('aria-invalid');

  const username = form.username.value.trim();
  const password = form.password.value;

  try {
    const user = await login(username, password);
    window.location.href = areaFor(user.role);
  } catch (err) {
    showError(err.message || 'invalid credentials');
  }
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) redirectIfAlreadySignedIn();
});
