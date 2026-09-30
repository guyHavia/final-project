import { logout } from './auth-client.js';

// Shared by every newsroom screen: header chrome behaviour plus the small
// formatting helpers the list/card renderers reuse.

/** Article state -> label + CSS modifier used by .badge / .stat. */
export const STATE_META = {
  'In Preparation': { label: 'In preparation', key: 'prep' },
  'Pending Editor Approval': { label: 'Pending approval', key: 'pend' },
  Published: { label: 'Published', key: 'pub' },
  'Returned for Corrections': { label: 'Returned', key: 'ret' },
};

const AVATAR_COLORS = ['#7a3fd1', '#0b7a8a', '#d1367a', '#c25b0e', '#1c7c4d', '#3b6fd4'];

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

export function avatarColor(name = '') {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** "just now", "5h", "2d 3h" — compact age of an ISO timestamp. */
export function timeAgo(iso) {
  if (!iso) return '';
  const hours = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3600e3));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** "just now" or "5h ago" — for sentences like "Edited … ". */
export function agoLabel(iso) {
  const age = timeAgo(iso);
  return age === 'just now' ? age : `${age} ago`;
}

export function hoursSince(iso) {
  return iso ? (Date.now() - new Date(iso).getTime()) / 3600e3 : 0;
}

/**
 * Transient confirmation ("Article approved") in a polite live region, so the
 * result of an action is visible and announced even after its panel closes.
 * `kind` is 'success' (default) or 'error'.
 */
export function showToast(message, kind = 'success') {
  let region = document.getElementById('toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${kind}`;
  toast.textContent = message;
  region.append(toast);
  setTimeout(() => toast.remove(), 4000);
}

/** Fills the account menu, wires burger/side menu/account menu and logout. */
export function initShell(user) {
  const $ = (id) => document.getElementById(id);
  const roleLabel = user.role === 'editor' ? 'Editor' : 'Reporter';

  $('user-display-name').textContent = user.displayName;
  $('menu-user-name').textContent = user.displayName;
  $('user-role-label').textContent = roleLabel;
  $('menu-user-role').textContent = roleLabel;
  const avatar = $('nav-avatar');
  avatar.textContent = initials(user.displayName);
  avatar.style.background = avatarColor(user.displayName);

  const side = $('sidenav');
  const sideScrim = $('nav-scrim');
  const burger = $('burger');
  const setSide = (open) => {
    side.hidden = !open;
    sideScrim.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    if (open) $('side-close').focus();
    else if (document.activeElement && side.contains(document.activeElement)) burger.focus();
  };
  burger.addEventListener('click', () => setSide(true));
  $('side-close').addEventListener('click', () => setSide(false));
  sideScrim.addEventListener('click', () => setSide(false));

  const userButton = $('user-menu-button');
  const userMenu = $('user-menu');
  const setUserMenu = (open) => {
    userMenu.hidden = !open;
    userButton.setAttribute('aria-expanded', String(open));
  };
  userButton.addEventListener('click', (e) => {
    e.stopPropagation();
    setUserMenu(userMenu.hidden);
  });
  document.addEventListener('click', (e) => {
    if (!userMenu.contains(e.target)) setUserMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    setSide(false);
    setUserMenu(false);
  });

  $('logout-button').addEventListener('click', async () => {
    await logout();
    window.location.href = '/login';
  });
}
