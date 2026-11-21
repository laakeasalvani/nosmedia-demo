import { loadCollection, readCollection, seedCollection, addCollectionItem, deleteCollectionItem, reorderCollection, updateCollectionItem } from './collection-store.js';
import { onEditingChange } from './auth.js';
import { pickVideo } from './media-picker.js';
import { deleteIfOwned } from './upload.js';
import { serviceOptions, embedUrl } from './derive.js';
import { showToast } from './toast.js';
import { getField, setField } from './content-store.js';
import { listView } from './collection-order.js';
import { raceTimeout, once } from './timeout.js';

// The lists Carson can grow, shrink and reorder:
//   services — home + Services (one list, shown on both) and the contact
//              form's "What do you need?" options
//   slides   — the home "Anywhere on Oʻahu" slider
//   films    — the Work page, newest first
//
// Until a list has been saved once, Firestore is empty and the HTML's own
// items stay on screen. The first time Carson turns on editing, those HTML
// items are copied into Firestore (seeded) so each one gets an id to edit by —
// the same pattern as CaptureWithKi's portfolio and filmstrip.

const SITE = window.NOSSite || {};

function el(tag, attrs, text) {
  const node = document.createElement(tag);
  Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
  if (text != null) node.textContent = text;
  return node;
}

function loopVideo(video) {
  return el('video', {
    'data-autoplay': '', muted: '', loop: '', playsinline: '', preload: 'none',
    poster: (video && video.poster) || '', src: (video && video.src) || '', 'aria-hidden': 'true',
  });
}

function field(tag, name, value, attrs) {
  return el(tag, Object.assign({ 'data-cms-field': name }, attrs || {}), value || '');
}

const LISTS = {
  services: {
    noun: 'service',
    scrape: function (item) {
      const v = item.querySelector('video');
      const t = item.querySelector('[data-cms-field="title"]').textContent.trim();
      return {
        title: t,
        description: item.querySelector('[data-cms-field="description"]').textContent.trim(),
        shortLabel: ({ 'Brand films': 'Brand film', 'Events': 'Event', 'Corporate interviews': 'Corporate interview' })[t] || '',
        video: { src: v.getAttribute('src'), poster: v.getAttribute('poster') },
      };
    },
    render: function (item) {
      const a = el('article', { class: 'service' });
      const clip = el('div', { class: 'clip' });
      clip.appendChild(loopVideo(item.video));
      const body = el('div', { class: 'service-body' });
      body.appendChild(field('h3', 'title', item.title));
      body.appendChild(field('p', 'description', item.description));
      a.appendChild(clip); a.appendChild(body);
      return a;
    },
    blank: function (video) { return { title: 'New service', description: 'Say what it is and who it’s for.', shortLabel: '', video: video }; },
    needsVideo: true,
  },
  slides: {
    noun: 'slide',
    scrape: function (item) {
      const v = item.querySelector('video');
      return { caption: item.querySelector('[data-cms-field="caption"]').textContent.trim(), video: { src: v.getAttribute('src'), poster: v.getAttribute('poster') } };
    },
    render: function (item) {
      const d = el('div', { class: 'slide' });
      d.appendChild(loopVideo(item.video));
      d.appendChild(field('span', 'caption', item.caption));
      return d;
    },
    blank: function (video) { return { caption: 'New place', video: video }; },
    needsVideo: true,
  },
  films: {
    noun: 'film',
    newestFirst: true,
    scrape: function (item) {
      const get = function (f) { const n = item.querySelector('[data-cms-field="' + f + '"]'); return n ? n.textContent.trim() : ''; };
      return { title: get('title'), blurb: get('blurb'), client: get('client'), type: get('type'), year: get('year'), video: null, link: '' };
    },
    render: function (item) {
      const a = el('article', { class: 'film' });
      const frame = el('div', { class: 'frame' });
      const player = item.link && embedUrl(item.link);
      if (item.video && item.video.src) {
        const v = el('video', { controls: '', playsinline: '', preload: 'metadata', poster: item.video.poster || '', src: item.video.src, style: 'object-fit:contain;background:#000' });
        frame.appendChild(v);
      } else if (player) {
        frame.appendChild(el('iframe', { src: player, title: item.title || 'Film', allow: 'autoplay; fullscreen; picture-in-picture', allowfullscreen: '', loading: 'lazy' }));
      } else {
        const ph = el('div', { class: 'placeholder' });
        ph.appendChild(el('div', { class: 'play', 'aria-hidden': 'true' }));
        ph.appendChild(el('strong', {}, item.title));
        ph.appendChild(el('span', {}, 'Film coming soon'));
        frame.appendChild(ph);
      }
      const meta = el('div', { class: 'film-meta' });
      meta.appendChild(field('h2', 'title', item.title));
      meta.appendChild(field('p', 'blurb', item.blurb, { class: 'muted' }));
      const dl = el('dl');
      [['Client', 'client'], ['Type', 'type'], ['Year', 'year']].forEach(function (pair) {
        dl.appendChild(el('dt', {}, pair[0]));
        dl.appendChild(field('dd', pair[1], item[pair[1]]));
      });
      meta.appendChild(dl);
      a.appendChild(frame); a.appendChild(meta);
      return a;
    },
    blank: function () { return { title: 'New film', blurb: 'One or two sentences on what the client needed and what the video did for them.', client: 'Client name', type: 'Local business', year: String(new Date().getFullYear()), video: null, link: '' }; },
    needsVideo: false,
  },
};

function fillServiceOptions(items) {
  const opts = serviceOptions(items);
  document.querySelectorAll('select[data-cms-options="services"]').forEach(function (select) {
    const current = select.value;
    select.innerHTML = '';
    opts.forEach(function (o) { select.appendChild(el('option', {}, o)); });
    if (opts.indexOf(current) >= 0) select.value = current;
  });
}

function deleteVideoFiles(video) {
  if (!video) return;
  deleteIfOwned(video.src);
  deleteIfOwned(video.poster);
}

// ---------- one list on one page ----------
function makeList(name, containers) {
  const cfg = LISTS[name];
  const state = { items: [], seeded: false, editing: false };
  let addBtns = [];

  function render() {
    containers.forEach(function (box) {
      box.innerHTML = '';
      state.items.forEach(function (item, i) {
        const node = cfg.render(item);
        node.setAttribute('data-cms-item-id', item.id);
        node.appendChild(tools(item, i));
        box.appendChild(node);
      });
      if (SITE.wireVideos) SITE.wireVideos(box);
    });
    if (name === 'slides' && SITE.refreshSlider) SITE.refreshSlider();
    if (name === 'services') fillServiceOptions(state.items);
    document.dispatchEvent(new CustomEvent('cms:rendered'));
  }

  function tools(item, index) {
    const bar = el('div', { class: 'cms-item-tools' });
    const btn = function (label, aria, onClick) {
      const b = el('button', { type: 'button', class: 'cms-tool', 'aria-label': aria }, label);
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); onClick(); });
      bar.appendChild(b);
      return b;
    };
    // Arrows rather than drag-and-drop: iPhone Safari doesn't drag reliably.
    btn('←', 'Move earlier', function () { move(index, -1); }).disabled = index === 0;
    btn('→', 'Move later', function () { move(index, 1); }).disabled = index === state.items.length - 1;
    btn(cfg.needsVideo ? 'Replace video' : 'Upload film', 'Replace video', function () { replaceVideo(item); });
    if (name === 'films') btn('Paste link', 'Use a YouTube or Vimeo link', function () { pasteLink(item); });
    if (name === 'services') btn('Form label', 'Name shown in the contact form', function () { editShortLabel(item); });
    btn('×', 'Delete this ' + cfg.noun, function () { remove(item); });
    return bar;
  }

  async function reload() {
    state.items = await readCollection(name);
    render();
  }

  // Firestore waits rather than failing while offline, so a save can hang.
  // After 15s Carson is told it's still going; a refusal reloads the list.
  async function guard(what, run) {
    const r = await raceTimeout(run(), 15000);
    if (r.status === 'error') {
      console.warn('[cms] ' + what + ' failed:', r.error && (r.error.code || r.error.message));
      showToast('Not saved — check your connection', 4000);
      try { await reload(); } catch (e) { /* still offline; leave the page as it is */ }
    } else if (r.status === 'timeout') {
      showToast('Still saving… keep this tab open', 0);
    }
    return r.status;
  }

  const FLAG = 'lists.' + name + '.seeded';

  // Shared in-flight run (once): turning editing off and on again while the
  // first seed is still going must not copy the HTML items in twice.
  const seed = once(async function () {
    // The page-load read may have timed out; ask again properly before
    // deciding the list is empty.
    const existing = await readCollection(name);
    if (existing.length || getField(FLAG, false)) {
      state.items = existing;
      if (!getField(FLAG, false)) await setField(FLAG, true);
      state.seeded = true;
      render();
      return;
    }
    const fallback = Array.prototype.map.call(containers[0].querySelectorAll(':scope > *'), cfg.scrape);
    await seedCollection(name, fallback);
    await setField(FLAG, true);
    state.seeded = true;
    await reload();
  });

  function ensureSeeded() {
    return state.seeded ? Promise.resolve() : seed();
  }

  function move(index, delta) {
    const ids = state.items.map(function (i) { return i.id; });
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    const t = ids[index]; ids[index] = ids[j]; ids[j] = t;
    guard('reorder', async function () { await reorderCollection(name, ids); await reload(); showToast('Saved'); });
  }

  async function replaceVideo(item) {
    const next = await pickVideo({ slot: name, id: item.id });
    if (!next) return;
    const status = await guard('replace video', async function () {
      await updateCollectionItem(name, item.id, { video: next, link: '' });
      deleteVideoFiles(item.video);
      await reload();
      showToast('Saved');
    });
    if (status === 'error') deleteVideoFiles(next);
  }

  function pasteLink(item) {
    const link = prompt('Paste a YouTube or Vimeo link for this film:', item.link || '');
    if (link === null) return;
    if (link.trim() && !embedUrl(link)) { alert('That doesn’t look like a YouTube or Vimeo link. Copy the link from the video’s Share button and try again.'); return; }
    guard('save link', async function () {
      await updateCollectionItem(name, item.id, { link: link.trim(), video: null });
      deleteVideoFiles(item.video);
      await reload();
      showToast('Saved');
    });
  }

  function editShortLabel(item) {
    const label = prompt('What should the contact form call this service? (Leave blank to use the title.)', item.shortLabel || '');
    if (label === null) return;
    guard('save label', async function () {
      await updateCollectionItem(name, item.id, { shortLabel: label.trim() });
      await reload();
      showToast('Saved');
    });
  }

  function remove(item) {
    if (!confirm('Delete this ' + cfg.noun + '? This can’t be undone.')) return;
    guard('delete', async function () {
      await deleteCollectionItem(name, item.id);
      deleteVideoFiles(item.video);
      await reload();
      showToast('Deleted');
    });
  }

  async function add() {
    let video = null;
    if (cfg.needsVideo) {
      video = await pickVideo({ slot: name, id: 'new-' + Date.now() });
      if (!video) return;
    }
    const status = await guard('add', async function () {
      await ensureSeeded();
      const id = await addCollectionItem(name, cfg.blank(video));
      if (cfg.newestFirst) {
        const ids = state.items.map(function (i) { return i.id; });
        await reorderCollection(name, [id].concat(ids));
      }
      await reload();
      showToast('Added. Tap its words to edit them.');
    });
    if (status === 'error') deleteVideoFiles(video);
  }

  function placeAddButtons() {
    addBtns.forEach(function (b) { b.remove(); });
    addBtns = containers.map(function (box) {
      const b = el('button', { type: 'button', class: 'cms-btn cms-add' }, '+ Add ' + cfg.noun);
      b.addEventListener('click', function (e) { e.preventDefault(); add(); });
      // The slider scrolls sideways; its button goes below the controls.
      const anchor = name === 'slides' ? (document.querySelector('.slider-controls') || box) : box;
      anchor.insertAdjacentElement('afterend', b);
      return b;
    });
  }

  document.addEventListener('cms:field-edited', function (e) {
    const node = e.detail.el;
    const itemEl = node.closest('[data-cms-item-id]');
    if (!itemEl || containers.indexOf(itemEl.parentElement) < 0) return;
    const id = itemEl.getAttribute('data-cms-item-id');
    const key = node.getAttribute('data-cms-field');
    guard('save text', async function () {
      await updateCollectionItem(name, id, { [key]: e.detail.value });
      const item = state.items.find(function (i) { return i.id === id; });
      if (item) item[key] = e.detail.value;
      if (name === 'services') fillServiceOptions(state.items);
      showToast('Saved');
    });
  });

  return {
    init: async function () {
      const loaded = await loadCollection(name);
      // Empty AND never saved: keep the HTML's own items. Empty after Carson
      // deleted everything: show an empty list, not the old placeholders.
      if (listView(loaded, getField(FLAG, false)) === 'items') {
        state.items = loaded;
        state.seeded = true;
        render();
      }
      onEditingChange(async function (on) {
        state.editing = on;
        if (on) {
          try { await ensureSeeded(); }
          catch (err) { console.warn('[cms] seed ' + name + ' failed:', err && (err.code || err.message)); showToast('Couldn’t get the ' + cfg.noun + ' list ready to edit', 4000); }
          placeAddButtons();
        } else {
          addBtns.forEach(function (b) { b.remove(); });
          addBtns = [];
        }
      });
    },
  };
}

export async function initLists() {
  const jobs = Object.keys(LISTS).map(function (name) {
    const containers = Array.prototype.slice.call(document.querySelectorAll('[data-cms-list="' + name + '"]'));
    if (containers.length) return makeList(name, containers).init();
    // The contact page has no service cards, only the dropdown that follows them.
    if (name === 'services' && document.querySelector('select[data-cms-options="services"]')) {
      return loadCollection('services').then(function (items) { if (items.length) fillServiceOptions(items); });
    }
    return null;
  });
  await Promise.all(jobs);
}
