import { setSetting } from './content-store.js';
import { mergeSettings, instagramHandle, mailtoHref, embedUrl } from './derive.js';
import { pickVideo } from './media-picker.js';
import { deleteIfOwned } from './upload.js';
import { showToast } from './toast.js';
import { raceTimeout } from './timeout.js';

// Carson's settings: the values js/config.js holds as fallbacks. Email and
// Instagram are filled into every place they appear (text AND link) from
// here, so they can never disagree. They are not edited as free text.

const SITE = window.NOSSite || {};
const FIELDS = [
  { key: 'email', label: 'Email', type: 'email', hint: 'Shown in the menu, footer, contact and book-a-call pages.' },
  { key: 'instagram', label: 'Instagram link', type: 'url', hint: 'Your profile link, like https://www.instagram.com/n0smedia/' },
  { key: 'calendarUrl', label: 'Calendar link', type: 'url', hint: 'Google Calendar → Appointment schedule → Share → Website embed. Leave blank for “coming soon”.' },
  { key: 'googleReviewUrl', label: 'Google review link', type: 'url', hint: 'Google Business Profile → Ask for reviews → copy link.' },
];

export function applySettings(overrides) {
  const merged = mergeSettings(window.NOS || {}, overrides || {});
  // Mutate in place: js/site.js holds a reference to this object.
  window.NOS = Object.assign(window.NOS || {}, merged);
  const s = window.NOS;

  document.querySelectorAll('[data-setting="email"]').forEach(function (a) {
    a.textContent = s.email;
    a.setAttribute('href', mailtoHref(s.email));
  });
  document.querySelectorAll('[data-setting="email-link"]').forEach(function (a) {
    a.setAttribute('href', mailtoHref(s.email, a.getAttribute('data-mailto-subject') || ''));
  });
  document.querySelectorAll('[data-setting="instagram"]').forEach(function (a) { a.setAttribute('href', s.instagram); });
  document.querySelectorAll('[data-setting="instagram-handle"]').forEach(function (n) { n.textContent = instagramHandle(s.instagram); });
  if (SITE.applyConfig) SITE.applyConfig();
}

function validate(key, value) {
  if (!value) return key === 'email' || key === 'instagram' ? 'This one can’t be blank.' : '';
  if (key === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' : 'That doesn’t look like an email address.';
  if (!/^https:\/\//.test(value)) return 'Links start with https://';
  if (key === 'instagram' && !instagramHandle(value)) return 'Use your Instagram profile link.';
  return '';
}

// A pasted YouTube/Vimeo link becomes its player URL; an uploaded video is
// already a direct file URL. Anything else is refused.
function normalizeVsl(value) {
  if (!value) return { value: '' };
  if (/^https:\/\/firebasestorage\.googleapis\.com\//.test(value)) return { value: value };
  const player = embedUrl(value);
  return player ? { value: player } : { error: 'Paste a YouTube or Vimeo link, or tap Upload video.' };
}

function buildModal() {
  const wrap = document.createElement('div');
  wrap.className = 'cms-backdrop';
  const form = document.createElement('form');
  form.className = 'cms-modal';
  form.noValidate = true;
  form.innerHTML = '<h2>Settings</h2>';
  FIELDS.forEach(function (f) {
    const label = document.createElement('label');
    label.textContent = f.label;
    const input = document.createElement('input');
    input.name = f.key; input.type = f.type; input.autocomplete = 'off';
    label.appendChild(input);
    form.appendChild(label);
    const hint = document.createElement('p');
    hint.className = 'cms-hint'; hint.textContent = f.hint;
    form.appendChild(hint);
  });
  form.insertAdjacentHTML('beforeend',
    '<label>Book-a-call video<input name="vslUrl" type="url" autocomplete="off" placeholder="YouTube or Vimeo link"></label>' +
    '<p class="cms-hint">Paste a link, or upload the video file.</p>' +
    '<div class="cms-row" style="justify-content:flex-start"><button type="button" class="cms-btn cms-btn-ghost" data-upload>Upload video</button><button type="button" class="cms-btn cms-btn-ghost" data-clear-vsl>Remove video</button></div>' +
    '<p class="cms-error" role="alert"></p>' +
    '<div class="cms-row"><button type="button" class="cms-btn cms-btn-ghost" data-close>Cancel</button><button type="submit" class="cms-btn">Save</button></div>');
  wrap.appendChild(form);
  document.body.appendChild(wrap);
  return { wrap: wrap, form: form };
}

export function initSettingsUi() {
  const slot = document.getElementById('cmsBadgeExtra');
  if (!slot) return;
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'cms-btn cms-btn-ghost';
  open.textContent = 'Settings';
  slot.appendChild(open);

  const m = buildModal();
  const form = m.form;
  const errorEl = form.querySelector('.cms-error');
  const close = function () { m.wrap.classList.remove('open'); errorEl.textContent = ''; };

  open.addEventListener('click', function () {
    FIELDS.concat([{ key: 'vslUrl' }]).forEach(function (f) { form[f.key].value = (window.NOS && window.NOS[f.key]) || ''; });
    m.wrap.classList.add('open');
  });
  form.querySelector('[data-close]').addEventListener('click', close);
  form.querySelector('[data-clear-vsl]').addEventListener('click', function () { form.vslUrl.value = ''; });
  form.querySelector('[data-upload]').addEventListener('click', async function () {
    m.wrap.classList.remove('open');   // the upload overlay takes over the screen
    const next = await pickVideo({ slot: 'vsl', id: 'main' });
    m.wrap.classList.add('open');
    if (next) form.vslUrl.value = next.src;
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorEl.textContent = '';
    const changes = {};
    for (const f of FIELDS) {
      const value = form[f.key].value.trim();
      const problem = validate(f.key, value);
      if (problem) { errorEl.textContent = f.label + ': ' + problem; form[f.key].focus(); return; }
      if (value !== ((window.NOS && window.NOS[f.key]) || '')) changes[f.key] = value;
    }
    const vsl = normalizeVsl(form.vslUrl.value.trim());
    if (vsl.error) { errorEl.textContent = vsl.error; form.vslUrl.focus(); return; }
    const oldVsl = (window.NOS && window.NOS.vslUrl) || '';
    if (vsl.value !== oldVsl) changes.vslUrl = vsl.value;

    const keys = Object.keys(changes);
    if (!keys.length) { close(); return; }
    const save = form.querySelector('[type="submit"]');
    save.disabled = true;
    const write = Promise.all(keys.map(function (k) { return setSetting(k, changes[k]); }));
    const r = await raceTimeout(write, 15000);
    save.disabled = false;
    if (r.status === 'error') {
      console.warn('[cms] settings save failed:', r.error && (r.error.code || r.error.message));
      errorEl.textContent = 'Not saved — check your connection and try again.';
      return;
    }
    if (r.status === 'timeout') {
      errorEl.textContent = 'Still saving… your connection is slow. Keep this tab open, or try again.';
      write.then(function () { showToast('Settings saved'); }, function () { showToast('Settings not saved — try again', 4000); });
      return;
    }
    // A cleared optional value has to override config.js too, so apply the
    // raw changes on top rather than through mergeSettings' "non-empty wins".
    Object.assign(window.NOS, changes);
    applySettings({});
    if ('vslUrl' in changes && oldVsl) {
      deleteIfOwned(oldVsl);
      if (!changes.vslUrl) restoreVslPlaceholder();
    }
    close();
    showToast('Saved');
  });
}

// site.js only ever swaps the placeholder OUT; put it back when the video is removed.
function restoreVslPlaceholder() {
  const box = document.querySelector('[data-embed="vsl"]');
  if (box) box.innerHTML = '<div class="placeholder"><div class="play" aria-hidden="true"></div><strong>Video coming soon</strong><span>How working with nosMedia works</span></div>';
}
