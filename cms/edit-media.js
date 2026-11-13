import { getField, setField } from './content-store.js';
import { onEditingChange } from './auth.js';
import { pickVideo, pickImage } from './media-picker.js';
import { deleteIfOwned } from './upload.js';
import { showToast } from './toast.js';

// Single media slots: [data-cms-type="video"] (the home hero) stores
// {src, poster}; [data-cms-type="image"] (the About portrait) stores a URL.
// The old file is deleted only after the new one is saved.

const SITE = window.NOSSite || {};

function applyVideo(el, value) {
  if (!value || !value.src) return;
  if (value.poster) {
    el.poster = value.poster;
    const still = el.parentElement.querySelector('.hero-poster');
    if (still) still.src = value.poster;
  }
  if (el.closest('.hero') && SITE.setHeroSource) SITE.setHeroSource(value.src);
  else { el.src = value.src; el.load(); }
}

function applyImage(el, url) {
  if (!url) return;
  let img = el.querySelector('img.cms-slot-img');
  if (!img) {
    el.innerHTML = '';
    img = document.createElement('img');
    img.className = 'cms-slot-img';
    img.alt = el.getAttribute('data-cms-alt') || '';
    el.appendChild(img);
  }
  img.src = url;
}

function hostFor(el) {
  return el.getAttribute('data-cms-type') === 'video' ? (el.closest('section') || el.parentElement) : el;
}

export function initMediaEditing() {
  const slots = Array.prototype.slice.call(document.querySelectorAll('[data-cms-type="video"][data-cms-id], [data-cms-type="image"][data-cms-id]'));

  slots.forEach(function (el) {
    const key = el.getAttribute('data-cms-id');
    const isVideo = el.getAttribute('data-cms-type') === 'video';
    const value = getField(key, null);
    if (isVideo) applyVideo(el, value); else applyImage(el, value);

    const host = hostFor(el);
    host.classList.add('cms-media-host');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cms-btn cms-media-btn';
    btn.textContent = isVideo ? 'Replace video' : 'Replace photo';
    btn.hidden = true;
    host.appendChild(btn);

    btn.addEventListener('click', async function (e) {
      e.preventDefault();
      e.stopPropagation();
      const slot = key.replace(/\./g, '-');
      const old = getField(key, null);
      const next = isVideo ? await pickVideo({ slot: slot, id: 'main' }) : await pickImage({ slot: slot, id: 'main' });
      if (!next) return;
      try {
        await setField(key, next);
      } catch (err) {
        console.warn('[cms] save failed:', err && (err.code || err.message));
        showToast('Not saved — check your connection', 4000);
        if (isVideo) { deleteIfOwned(next.src); deleteIfOwned(next.poster); } else deleteIfOwned(next);
        return;
      }
      if (isVideo) applyVideo(el, next); else applyImage(el, next);
      showToast('Saved');
      if (old) {
        if (isVideo) { deleteIfOwned(old.src); deleteIfOwned(old.poster); } else deleteIfOwned(old);
      }
    });

    onEditingChange(function (on) { btn.hidden = !on; });
  });
}
