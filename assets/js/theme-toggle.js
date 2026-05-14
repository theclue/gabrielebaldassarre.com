/*!
 * Theme toggle for gabrielebaldassarre.com
 * - Persists user choice in localStorage ('theme' = 'light' | 'dark')
 * - When no choice is set, OS prefers-color-scheme is used (CSS-only)
 * - Cycles: auto -> light -> dark -> auto
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'theme';
  var root = document.documentElement;

  function getStored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function setStored(value) {
    try {
      if (value === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, value);
    } catch (e) { /* ignore */ }
  }

  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      root.setAttribute('data-theme', theme);
    } else {
      root.removeAttribute('data-theme');
    }
  }

  function currentEffectiveTheme() {
    var stored = getStored();
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function nextTheme() {
    // toggle: light -> dark -> light (simple two-state)
    return currentEffectiveTheme() === 'dark' ? 'light' : 'dark';
  }

  function init() {
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    if (!buttons.length) return;

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = nextTheme();
        applyTheme(next);
        setStored(next);
        btn.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
      });

      // initial aria-pressed state
      btn.setAttribute('aria-pressed', currentEffectiveTheme() === 'dark' ? 'true' : 'false');
    });

    // React to OS-level changes only when no explicit choice was made
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var listener = function () {
        if (!getStored()) {
          buttons.forEach(function (btn) {
            btn.setAttribute('aria-pressed', mq.matches ? 'true' : 'false');
          });
        }
      };
      if (mq.addEventListener) mq.addEventListener('change', listener);
      else if (mq.addListener) mq.addListener(listener);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
