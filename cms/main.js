import { initAuth, login, logout, isAdmin, onAdminChange, isEditing, setEditing, onEditingChange } from './auth.js';
import { loadSiteContent, loadSettings } from './content-store.js';
import { initTextEditing } from './edit-text.js';
import { initMediaEditing } from './edit-media.js';
import { initLists } from './lists.js';
import { applySettings, initSettingsUi } from './settings-ui.js';

// CMS entry point, loaded on every page after js/site.js.
// Order matters: content first (so the page shows Carson's words), then the
// editors, then sign-in, then the page is un-hidden.

const GEAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';

function buildChrome() {
  const gear = document.createElement('button');
  gear.type = 'button';
  gear.id = 'cmsGear';
  gear.className = 'cms-gear';
  gear.setAttribute('aria-label', 'Edit this site');
  gear.innerHTML = GEAR_SVG;
  const footerBase = document.querySelector('.footer-base');
  if (footerBase) footerBase.appendChild(gear); else { gear.classList.add('cms-gear-fixed'); document.body.appendChild(gear); }

  const modal = document.createElement('div');
  modal.className = 'cms-backdrop';
  modal.id = 'cmsLogin';
  modal.innerHTML =
    '<form class="cms-modal" novalidate>' +
      '<h2>Log in to edit</h2>' +
      '<label>Email<input name="email" type="email" autocomplete="username" required></label>' +
      '<label>Password<input name="password" type="password" autocomplete="current-password" required></label>' +
      '<p class="cms-error" role="alert"></p>' +
      '<div class="cms-row"><button type="button" class="cms-btn cms-btn-ghost" data-close>Cancel</button><button type="submit" class="cms-btn">Log in</button></div>' +
    '</form>';
  document.body.appendChild(modal);

  const badge = document.createElement('div');
  badge.className = 'cms-badge';
  badge.id = 'cmsBadge';
  badge.innerHTML =
    '<span class="cms-badge-label">Editing</span>' +
    '<span id="cmsBadgeExtra"></span>' +
    '<button type="button" class="cms-btn" data-done>Done</button>' +
    '<button type="button" class="cms-btn cms-btn-ghost" data-logout>Log out</button>';
  document.body.appendChild(badge);
  return { gear, modal, badge };
}

function wire(ui) {
  const form = ui.modal.querySelector('form');
  const errorEl = ui.modal.querySelector('.cms-error');
  const close = function () { ui.modal.classList.remove('open'); errorEl.textContent = ''; };

  ui.gear.addEventListener('click', function () {
    if (isAdmin()) { setEditing(!isEditing()); return; }
    ui.modal.classList.add('open');
    form.email.focus();
  });
  ui.modal.querySelector('[data-close]').addEventListener('click', close);
  ui.modal.addEventListener('click', function (e) { if (e.target === ui.modal) close(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorEl.textContent = '';
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    login(form.email.value.trim(), form.password.value)
      .then(function () {
        form.password.value = '';
        // Admin status arrives a moment later (onAdminChange below).
      })
      .catch(function () {
        errorEl.textContent = 'That email and password didn’t match. Try again.';
      })
      .finally(function () { btn.disabled = false; });
  });

  onAdminChange(function (admin) {
    if (admin && ui.modal.classList.contains('open')) { close(); setEditing(true); }
    ui.gear.classList.toggle('is-admin', admin);
  });
  onEditingChange(function (on) {
    document.documentElement.classList.toggle('cms-editing-on', on);
    ui.badge.classList.toggle('open', on);
  });
  ui.badge.querySelector('[data-done]').addEventListener('click', function () { setEditing(false); });
  ui.badge.querySelector('[data-logout]').addEventListener('click', function () { setEditing(false); logout(); });
}

(async function () {
  try {
    const results = await Promise.all([loadSiteContent(), loadSettings()]);
    applySettings(results[1]);
    initTextEditing();
    initMediaEditing();
    await initLists();
    const ui = buildChrome();
    wire(ui);
    initSettingsUi();
    initAuth();
  } finally {
    document.documentElement.classList.remove('cms-pending');
  }
})();
