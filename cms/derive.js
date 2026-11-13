// Values worked out from Carson's settings, so the same fact is never typed
// twice. Email and Instagram show up as text AND as links in five places; if
// they were edited as free text, the words and the link could disagree.
//
// Pure module: no Firebase, no DOM (tests/derive.test.js).

export function instagramHandle(url) {
  if (!url) return '';
  const m = String(url).match(/instagram\.com\/([^/?#]+)/i);
  return m ? '@' + m[1] : '';
}

export function mailtoHref(email, subject) {
  return 'mailto:' + email + (subject ? '?subject=' + encodeURIComponent(subject) : '');
}

// config.js is the fallback; a saved setting wins only when it says something.
export function mergeSettings(config, overrides) {
  const out = Object.assign({}, config);
  Object.keys(overrides || {}).forEach(function (key) {
    const v = overrides[key];
    if (typeof v === 'string' ? v.trim() !== '' : v != null) out[key] = v;
  });
  return out;
}

// The contact form's "What do you need?" list follows the service cards, so a
// renamed or new service can't leave the form offering something stale.
export function serviceOptions(services) {
  const LAST = 'Not sure yet';
  const seen = new Set();
  const out = [];
  (services || []).forEach(function (s) {
    const label = String(s.shortLabel || s.title || '').trim();
    if (!label || label === LAST || seen.has(label)) return;
    seen.add(label);
    out.push(label);
  });
  out.push(LAST);
  return out;
}

// A pasted YouTube or Vimeo link → the URL its player embeds from. Anything
// else returns '' so a typo or a stray script URL never becomes an iframe.
export function embedUrl(link) {
  const s = String(link || '').trim();
  let m = s.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (m) return 'https://www.youtube-nocookie.com/embed/' + m[1];
  m = s.match(/^https?:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return 'https://player.vimeo.com/video/' + m[1];
  return '';
}
