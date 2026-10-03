/*
 * Dark/light theme for the public site. Loaded as a plain (non-module) script
 * in <head>, so the theme is set on <html data-theme> before the page paints
 * and never flashes the wrong colors.
 *
 * - Default: follow the computer's setting (prefers-color-scheme).
 * - Clicking #theme-toggle switches and remembers the choice in localStorage.
 */
(function () {
  const KEY = 'theme';
  const root = document.documentElement;
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function saved() {
    try {
      const value = localStorage.getItem(KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch {
      return null; // storage blocked (private mode): fall back to the system setting
    }
  }

  function apply(theme) {
    root.dataset.theme = theme;
  }

  apply(saved() || (darkQuery.matches ? 'dark' : 'light'));

  // Follow the system setting live, until the reader picks a theme themselves.
  darkQuery.addEventListener('change', (event) => {
    if (!saved()) apply(event.matches ? 'dark' : 'light');
  });

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme-toggle');
    if (!button) return;

    const sync = () => {
      const dark = root.dataset.theme === 'dark';
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      button.title = dark ? 'Light mode' : 'Dark mode';
    };

    sync();
    button.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(next);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // storage blocked: the choice lasts for this page only
      }
      sync();
    });
  });
})();
