// Thin fetch wrapper shared by every authenticated (P4) screen, and reused by
// P3's public pages for the "who am I" call. Always sends the session cookie,
// always unwraps the project's { data } / { error } envelope (see
// docs/API-CONTRACT.md), so every screen has one place to trust instead of
// re-parsing JSON and re-handling 401s at each call site.

const API_BASE = '/api';

/** Typed error thrown for any non-2xx response the caller doesn't ask to swallow. */
export class ApiError extends Error {
  constructor(message, { status, code }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * `on401` controls what happens to an unauthenticated (401) response:
 * - 'redirect' (default) - send the browser to /login; resolves to undefined
 *   (the caller never observes this, since navigation is already underway).
 * - 'ignore' - resolve to undefined without redirecting. Used by `me()` so a
 *   page can tell a signed-out Guest apart from a real error, without a bounce.
 * - 'throw' - treat 401 like any other error status. Used by `login()`, where
 *   a bad password must surface a message on the form, not a redirect loop
 *   back to the page the user is already on.
 */
export async function apiRequest(path, { method = 'GET', body, on401 = 'redirect' } = {}) {
  const res = await fetch(API_BASE + path, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // No/invalid JSON body - fall through, treated as an empty envelope below.
  }

  if (res.ok) {
    return payload?.data;
  }

  if (res.status === 401 && on401 !== 'throw') {
    if (on401 === 'redirect') window.location.href = '/login';
    return undefined;
  }

  const { message, code } = payload?.error ?? {};
  throw new ApiError(message ?? 'request failed', { status: res.status, code });
}

/** The current user ({ id, username, role, displayName }), or undefined when signed out. Never redirects. */
export function me() {
  return apiRequest('/auth/me', { on401: 'ignore' });
}

/** Resolves to the user on success; throws ApiError('invalid credentials', ...) on a bad login. */
export function login(username, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { username, password },
    on401: 'throw',
  });
}

/** Destroys the session. The caller is responsible for navigating to /login afterward. */
export function logout() {
  return apiRequest('/auth/logout', { method: 'POST' });
}
