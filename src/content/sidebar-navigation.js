/* AyinYar 0.18.1 — accessible, independent sidebar navigation.
 * Only affects navigation presentation; feature pages and actions remain unchanged.
 */
(function (root) {
  'use strict';
  let initialized = false;
  const allGroups = () => Array.from(document.querySelectorAll('.nav-group'));
  const allPages = () => Array.from(document.querySelectorAll('.nav-btn[data-page]'));

  function setExpanded(group, expanded) {
    const toggle = group?.querySelector('.nav-group-toggle');
    const panel = toggle && document.getElementById(toggle.getAttribute('aria-controls'));
    if (!toggle || !panel) return;
    // The hidden attribute ensures collapsed links are not keyboard-focusable.
    panel.hidden = !expanded;
    toggle.setAttribute('aria-expanded', String(expanded));
    group.classList.toggle('open', expanded);
  }

  function openOne(group) {
    for (const current of allGroups()) setExpanded(current, current === group);
  }

  function activate(pageId) {
    const link = allPages().find(button => button.dataset.page === pageId);
    if (!link) return false;
    for (const button of allPages()) {
      const selected = button === link;
      button.classList.toggle('active', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    const parentGroup = link.closest('.nav-group');
    for (const group of allGroups()) group.classList.toggle('has-current', group === parentGroup);
    // Do not unexpectedly close a group when visiting the dashboard, university or about.
    if (parentGroup) {
      openOne(parentGroup);
      try { link.scrollIntoView({block:'nearest', inline:'nearest'}); } catch (_) {}
    }
    return true;
  }

  function init() {
    if (initialized) return;
    initialized = true;
    for (const group of allGroups()) {
      const toggle = group.querySelector('.nav-group-toggle');
      if (!toggle) continue;
      toggle.addEventListener('click', () => {
        const wasExpanded = toggle.getAttribute('aria-expanded') === 'true';
        // Accordion: at most one category expanded, but all may be collapsed.
        if (wasExpanded) setExpanded(group, false);
        else openOne(group);
      });
    }
    const initiallyActive = allPages().find(button => button.classList.contains('active'));
    if (initiallyActive) activate(initiallyActive.dataset.page);
  }

  root.AyinSidebar = Object.freeze({init, activate});
})(window);
