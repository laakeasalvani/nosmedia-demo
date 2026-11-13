import { getField, setField } from './content-store.js';
import { onEditingChange } from './auth.js';
import { sanitizeHtml, toPlainText, initPasteGuard } from './sanitize.js';
import { showToast } from './toast.js';

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
//   - Many editable labels ARE links (menu, buttons). While editing, a tap on
//     one edits it instead of navigating; tap Done to browse normally.

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
  return document.querySelectorAll('[data-cms-type="text"][data-cms-id], [data-cms-field]');
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
        el.classList.remove('cms-editing');
      }
    });
  });

  // Lists re-render their items; new fields join editing straight away.
  document.addEventListener('cms:rendered', function () {
    editableTargets().forEach(function (el) { el.classList.toggle('cms-editable', editing); });
  });

  document.addEventListener('click', function (e) {
    if (!editing || !e.target.closest) return;
    const el = e.target.closest('.cms-editable');
    if (!el) return;
    // Never follow a link or submit a form while editing its words.
    e.preventDefault();
    if (el.contentEditable === 'true') return;
    el.contentEditable = 'true';
    el.classList.add('cms-editing');
    el.focus();
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

    setField(id, value)
      .then(function () { showToast('Saved'); })
      .catch(function (err) {
        console.warn('[cms] save failed:', err && (err.code || err.message));
        showToast('Not saved — check your connection');
      });
  }, true);
}
