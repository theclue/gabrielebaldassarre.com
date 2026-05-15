/*!
 * Responsive navigation toggle for gabrielebaldassarre.com
 */
(function () {
  'use strict';

  function init() {
    var toggle = document.querySelector('.nav-toggle');
    var menu = document.getElementById('nav-menu');
    if (!toggle || !menu) return;

    function open() {
      toggle.setAttribute('aria-expanded', 'true');
      menu.classList.add('is-open');
    }

    function close() {
      toggle.setAttribute('aria-expanded', 'false');
      menu.classList.remove('is-open');
    }

    toggle.addEventListener('click', function () {
      if (toggle.getAttribute('aria-expanded') === 'true') close();
      else open();
    });

    document.addEventListener('click', function (e) {
      if (menu.classList.contains('is-open') &&
          !menu.contains(e.target) &&
          e.target !== toggle &&
          !toggle.contains(e.target)) {
        close();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        close();
        toggle.focus();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
