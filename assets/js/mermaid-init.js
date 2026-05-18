/*!
 * Mermaid diagram init for gabrielebaldassarre.com
 * - Converts ```mermaid fenced blocks to mermaid elements
 * - Renders with theme based on current color scheme
 * - Re-renders on theme toggle (light <-> dark)
 */
(function () {
  'use strict';

  if (typeof mermaid === 'undefined') return;

  var mq = window.matchMedia('(prefers-color-scheme: dark)');

  function effectiveTheme() {
    var dt = document.documentElement.getAttribute('data-theme');
    if (dt === 'dark') return 'dark';
    if (dt === 'light') return 'default';
    return mq.matches ? 'dark' : 'default';
  }

  function convertBlocks() {
    // Handle both kramdown+Rouge (.language-mermaid code) and plain kramdown (code.language-mermaid)
    document.querySelectorAll('.language-mermaid code, code.language-mermaid').forEach(function (el) {
      var container = el.closest('.language-mermaid') || el.parentElement;
      if (!container || container.dataset.mermaidConverted) return;
      container.dataset.mermaidConverted = '1';

      var pre = document.createElement('pre');
      pre.className = 'mermaid';
      pre.textContent = el.textContent.trim();
      container.replaceWith(pre);
    });
  }

  function render() {
    convertBlocks();

    var blocks = document.querySelectorAll('pre.mermaid');
    if (!blocks.length) return;

    // Save original code for re-renders
    blocks.forEach(function (el) {
      if (!el.getAttribute('data-mermaid-code')) {
        el.setAttribute('data-mermaid-code', el.textContent);
      }
    });

    mermaid.initialize({
      startOnLoad: false,
      theme: effectiveTheme(),
      securityLevel: 'loose'
    });

    mermaid.run({ querySelector: '.mermaid' });
  }

  function rerender() {
    document.querySelectorAll('pre.mermaid[data-mermaid-code]').forEach(function (el) {
      el.innerHTML = el.getAttribute('data-mermaid-code') || '';
      el.removeAttribute('data-processed');
    });
    render();
  }

  render();

  // OS theme change (only when no explicit user choice)
  mq.addEventListener('change', function () {
    if (!document.documentElement.getAttribute('data-theme')) {
      rerender();
    }
  });

  // User theme toggle via data-theme attribute
  (new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].attributeName === 'data-theme') {
        rerender();
        break;
      }
    }
  })).observe(document.documentElement, { attributes: true });
})();
