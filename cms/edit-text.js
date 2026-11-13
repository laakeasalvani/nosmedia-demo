import { getField, setField } from './content-store.js';
import { onEditingChange } from './auth.js';
import { sanitizeHtml, toPlainText, initPasteGuard } from './sanitize.js';
import { saveWithFeedback } from './save.js';

// In-place text editing, adapted from CaptureWithKi's edit-text.js.
//
// Two kinds of editable text:
//   [data-cms-type="text"][data-cms-id]  — saved here, to content/site.
//   [data-cms-field] inside a list item  — the list module owns saving; this
//      file only makes it editable and fires `cms:field-edited` on blur.
//
// Differences from CaptureWithKi:
//   - Reveal lines (.reveal-text) are split into one <span> per word by
//     site.js for the scroll fade. They are un-split while Carson edits and
//     saved as plain words, so the wrappers never reach Firestore.
//   - Many editable labels ARE links to other pages (menu, footer, buttons).
//     While editing they still navigate, so Carson can move page to page;
//     a pencil button beside each one edits its wording instead.

const SITE = window.NOSSite || {};
let editing = false;

function isReveal(el) { return el.classList.contains('reveal-text'); }

function apply(el) {
  const id = el.getAttribute('data-cms-id');
  const value = getField(id, null);
  if (value == null) return;
  if (isReveal(el)) {
    el.textContent = toPlainText(value);
    if (SITE.splitReveal) SITE.splitReveal(el);
  } else {
    el.innerHTML = sanitizeHtml(value);
  }
}

function editableTargets() {
  // List fields join only once their item has an id (after seeding);
  // before that an edit would have nowhere to save.
  return document.querySelectorAll('[data-cms-type="text"][data-cms-id], [data-cms-item-id] [data-cms-field]');
}

// The link this text navigates with, if it goes to another page.
// mailto:, tel: and #anchors aren't page changes, so those stay tap-to-edit.
function pageLink(el) {
  const a = el.closest('a[href]');
  if (!a) return null;
  const href = a.getAttribute('href');
  return /^(mailto:|tel:|#|javascript:)/i.test(href) ? null : a;
}

const PENCIL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';

function startEditing(el) {
  if (el.contentEditable === 'true') return;
  el.contentEditable = 'true';
  el.classList.add('cms-editing');
  el.focus();
}

// One pencil per page link, placed just after the link (never inside it,
// or tapping the pencil would also follow the link).
function syncPencils(active) {
  document.querySelectorAll('.cms-pencil').forEach(function (p) { p.remove(); });
  if (!active) return;
  editableTargets().forEach(function (el) {
    const a = pageLink(el);
    if (!a) return;
    el.classList.add('cms-linked');
    const pencil = document.createElement('button');
    pencil.type = 'button';
    pencil.className = 'cms-pencil';
    pencil.setAttribute('aria-label', 'Edit the words "' + el.textContent.trim() + '"');
    pencil.innerHTML = PENCIL_SVG;
    pencil.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      startEditing(el);
    });
    a.after(pencil);
  });
}

export function initTextEditing() {
  initPasteGuard();
  document.querySelectorAll('[data-cms-type="text"][data-cms-id]').forEach(apply);

  onEditingChange(function (active) {
    editing = active;
    editableTargets().forEach(function (el) {
      el.classList.toggle('cms-editable', active);
      if (isReveal(el)) {
        if (active && SITE.unsplitReveal) SITE.unsplitReveal(el);
        if (!active && SITE.splitReveal) SITE.splitReveal(el);
      }
      if (!active) {
        el.contentEditable = 'false';
        el.classList.remove('cms-editing', 'cms-linked');
      }
    });
    syncPencils(active);
  });

  // Lists re-render their items; new fields join editing straight away.
  document.addEventListener('cms:rendered', function () {
    editableTargets().forEach(function (el) { el.classList.toggle('cms-editable', editing); });
    syncPencils(editing);
  });

  document.addEventListener('click', function (e) {
    if (!editing || !e.target.closest) return;
    const el = e.target.closest('.cms-editable');
    if (!el) return;
    // A page link navigates as normal; its pencil edits the words.
    // Once its words are open for typing, taps inside stay in the text.
    if (el.contentEditable !== 'true' && pageLink(el)) return;
    // Never follow a link or submit a form while editing its words.
    e.preventDefault();
    startEditing(el);
  }, true);

  // Enter finishes a field rather than adding a line break inside a heading.
  document.addEventListener('keydown', function (e) {
    const el = e.target.closest && e.target.closest('.cms-editing');
    if (el && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
  });

  document.addEventListener('focusout', function (e) {
    const el = e.target.closest && e.target.closest('.cms-editing');
    if (!el) return;
    el.contentEditable = 'false';
    el.classList.remove('cms-editing');

    if (el.hasAttribute('data-cms-field')) {
      const value = toPlainText(el.innerHTML);
      el.textContent = value;
      document.dispatchEvent(new CustomEvent('cms:field-edited', { detail: { el: el, value: value } }));
      return;
    }

    const id = el.getAttribute('data-cms-id');
    // Reveal lines and anything inside a link or button are words only.
    const plain = isReveal(el) || !!el.closest('a, button, label');
    const value = plain ? toPlainText(el.innerHTML) : sanitizeHtml(el.innerHTML);
    if (plain) el.textContent = value; else if (value !== el.innerHTML) el.innerHTML = value;

    // shared.* keys appear several times on one page (header, menu, footer):
    // update every copy so nothing shows the old wording until a reload.
    document.querySelectorAll('[data-cms-id="' + id + '"][data-cms-type="text"]').forEach(function (twin) {
      if (twin === el) return;
      if (isReveal(twin)) { twin.textContent = toPlainText(value); } else { twin.innerHTML = value; }
    });

    saveWithFeedback(setField(id, value));
  }, true);
}
