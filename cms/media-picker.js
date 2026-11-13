import { checkVideoFile, messageFor } from './video-check.js';
import { storagePathFor, uploadContentType, isAllowedImageType } from './storage-paths.js';
import { isIOSDevice } from './derive.js';
import { uploadFile, deleteIfOwned } from './upload.js';

// The one way any video or photo gets onto the site. It picks a file, checks
// it (H.264 only, max 2GB, warns over 1GB), grabs a still for the poster,
// uploads both untouched, and returns their URLs. It returns null if anything
// stops it, and in that case nothing on the site has changed: callers save
// only what this returns.

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const POSTER_MAX_EDGE = 2560;   // the still only; the video is never resized
const STOPPED = 'Upload stopped. Nothing on the site changed.';
const IPHONE_TIP = 'Keep this screen open until it finishes.';

function pickFile(accept) {
  return new Promise(function (resolve) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);
    const done = function (file) { input.remove(); resolve(file || null); };
    input.addEventListener('change', function () { done(input.files && input.files[0]); });
    input.addEventListener('cancel', function () { done(null); });
    input.click();
  });
}

// ---------- the full-screen overlay ----------
let overlay;
function ui() {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.className = 'cms-backdrop cms-upload';
  overlay.innerHTML =
    '<div class="cms-modal" role="dialog" aria-live="polite">' +
      '<h2 data-title>Uploading</h2>' +
      '<p data-msg></p>' +
      '<div class="cms-progress" hidden><i></i></div>' +
      '<p class="cms-hint" data-tip></p>' +
      '<div class="cms-row"><button type="button" class="cms-btn cms-btn-ghost" data-cancel>Cancel</button><button type="button" class="cms-btn" data-ok hidden>OK</button></div>' +
    '</div>';
  document.body.appendChild(overlay);
  return overlay;
}
function show(title, msg, opts) {
  const o = ui();
  o.querySelector('[data-title]').textContent = title;
  o.querySelector('[data-msg]').textContent = msg || '';
  o.querySelector('[data-tip]').textContent = (opts && opts.tip) || '';
  o.querySelector('.cms-progress').hidden = !(opts && opts.progress);
  o.querySelector('[data-cancel]').hidden = !(opts && opts.cancel);
  o.querySelector('[data-ok]').hidden = !(opts && opts.ok);
  o.classList.add('open');
  return o;
}
function setProgress(fraction) {
  const pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  ui().querySelector('.cms-progress i').style.width = pct + '%';
  ui().querySelector('[data-msg]').textContent = pct + '%';
}
function hide() { if (overlay) overlay.classList.remove('open'); }
function tell(title, msg) {
  return new Promise(function (resolve) {
    const o = show(title, msg, { ok: true });
    const ok = o.querySelector('[data-ok]');
    ok.onclick = function () { hide(); resolve(); };
    ok.focus();
  });
}
// iOS quietly re-encodes a video picked from the Photo Library before the
// page ever sees it, so the tip has to come BEFORE the picker. The picker is
// opened from this screen's button so iOS still counts it as a tap.
function chooseVideoOnIOS(accept) {
  return new Promise(function (resolve) {
    const o = show('Full quality', 'On the next screen, tap Choose File → Browse and pick the video from Files. Picking it from Photos lets your iPhone shrink it first.', { ok: true, cancel: true });
    const ok = o.querySelector('[data-ok]');
    ok.textContent = 'Choose video';
    ok.onclick = function () { ok.textContent = 'OK'; hide(); resolve(pickFile(accept)); };
    o.querySelector('[data-cancel]').onclick = function () { ok.textContent = 'OK'; hide(); resolve(null); };
  });
}

function ask(title, msg) {
  return new Promise(function (resolve) {
    const o = show(title, msg, { ok: true, cancel: true });
    o.querySelector('[data-ok]').textContent = 'Upload anyway';
    o.querySelector('[data-ok]').onclick = function () { o.querySelector('[data-ok]').textContent = 'OK'; resolve(true); };
    o.querySelector('[data-cancel]').onclick = function () { o.querySelector('[data-ok]').textContent = 'OK'; hide(); resolve(false); };
  });
}

// ---------- poster still ----------
// Loads the file in a hidden <video>, which also proves this browser can
// actually decode it. Resolves null when it can't.
export function grabPosterFrame(file) {
  return new Promise(function (resolve) {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    let settled = false;
    const finish = function (blob) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      v.removeAttribute('src'); v.load();
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    const timer = setTimeout(function () { finish(null); }, 20000);
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.addEventListener('error', function () { finish(null); });
    // loadedmetadata, not loadeddata: iOS often won't load frames for a
    // video that hasn't been played, but it will seek.
    v.addEventListener('loadedmetadata', function () {
      v.currentTime = Math.min(1, (v.duration || 10) * 0.1);
    });
    v.addEventListener('seeked', function () {
      const w = v.videoWidth, h = v.videoHeight;
      if (!w || !h) { finish(null); return; }
      const scale = Math.min(1, POSTER_MAX_EDGE / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      c.toBlob(function (blob) { finish(blob); }, 'image/jpeg', 0.9);
    });
    v.src = url;
  });
}

function withCancel(run) {
  const controller = new AbortController();
  ui().querySelector('[data-cancel]').onclick = function () { controller.abort(); };
  return run(controller.signal).catch(function (err) {
    const cancelled = controller.signal.aborted || (err && err.code === 'storage/canceled');
    if (!cancelled) console.warn('[cms] upload failed:', err && (err.code || err.message));
    return tell(cancelled ? 'Cancelled' : 'Upload failed', STOPPED).then(function () { return null; });
  });
}

export async function pickVideo(where) {
  const accept = 'video/mp4,video/quicktime';
  const file = isIOSDevice(navigator) ? await chooseVideoOnIOS(accept) : await pickFile(accept);
  if (!file) return null;

  show('Checking video', 'One moment…');
  const check = await checkVideoFile(file);
  if (!check.ok) { await tell('Can’t use this video', messageFor(check.reason)); return null; }
  if (check.warnLarge && !(await ask('Big file', 'This file is over 1GB. Big films cost money each time someone watches them. A YouTube or Vimeo link is free. Upload anyway?'))) return null;

  show('Checking video', 'One moment…');
  // The codec check already passed; a missing still just means the video
  // shows its own first frame while it loads.
  const poster = await grabPosterFrame(file);

  const now = Date.now();
  return withCancel(async function (signal) {
    show('Uploading video', '0%', { progress: true, cancel: true, tip: IPHONE_TIP });
    const src = await uploadFile(file, storagePathFor(where.slot, where.id, file.name, now), {
      signal: signal, contentType: uploadContentType('video', file),
      onProgress: function (f) { setProgress(poster ? f * 0.97 : f); },
    });
    if (!poster) { hide(); return { src: src, poster: '' }; }
    try {
      const posterUrl = await uploadFile(poster, storagePathFor(where.slot, where.id, 'poster.jpg', now), {
        signal: signal, contentType: 'image/jpeg', onProgress: function (f) { setProgress(0.97 + f * 0.03); },
      });
      hide();
      return { src: src, poster: posterUrl };
    } catch (err) {
      await deleteIfOwned(src);   // don't leave an orphaned video behind
      throw err;
    }
  });
}

export async function pickImage(where) {
  const file = await pickFile('image/jpeg,image/png,image/webp');
  if (!file) return null;
  if (!isAllowedImageType(file.type)) { await tell('Can’t use this photo', 'Use a JPEG, PNG or WebP. iPhone and Mac photos are often HEIC, which most browsers can’t show; export or share it as a JPEG first.'); return null; }
  if (file.size > MAX_IMAGE_BYTES) { await tell('Can’t use this photo', 'That photo is over 50MB. Export a smaller JPEG and try again.'); return null; }
  return withCancel(async function (signal) {
    show('Uploading photo', '0%', { progress: true, cancel: true });
    const url = await uploadFile(file, storagePathFor(where.slot, where.id, file.name, Date.now()), { signal: signal, contentType: uploadContentType('image', file), onProgress: setProgress });
    hide();
    return url;
  });
}
