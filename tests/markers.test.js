// Guards the markers the CMS depends on. If a page edit drops or duplicates
// one, Carson silently loses the ability to edit that spot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PAGES = ['index', 'work', 'services', 'about', 'book-a-call', 'contact', 'review'];
const html = Object.fromEntries(PAGES.map((p) => [p, readFileSync(new URL(`../${p}.html`, import.meta.url), 'utf8')]));
const ids = (s) => [...s.matchAll(/data-cms-id="([^"]+)"/g)].map((m) => m[1]);
const withFooter = PAGES.filter((p) => html[p].includes('class="site-footer"'));

test('no page-specific data-cms-id repeats within a page', () => {
  for (const p of PAGES) {
    const seen = new Set();
    const dupes = ids(html[p]).filter((id) => !id.startsWith('shared.') && (seen.has(id) || !seen.add(id)));
    assert.deepEqual(dupes, [], p);
  }
});

test('every page with a footer carries all shared footer, nav and header keys', () => {
  const required = ['shared.menu.location', 'shared.header.book', 'shared.footer.tagline', 'shared.footer.pagesTitle',
    'shared.footer.reachTitle', 'shared.footer.place', 'shared.footer.credit',
    ...['home', 'work', 'services', 'about', 'book', 'contact'].map((n) => 'shared.nav.' + n)];
  assert.equal(withFooter.length, 6);
  for (const p of withFooter) {
    const have = new Set(ids(html[p]));
    assert.deepEqual(required.filter((k) => !have.has(k)), [], p);
  }
});

test('pages with the closing CTA use the shared CTA keys', () => {
  for (const p of PAGES.filter((q) => html[q].includes('section cta'))) {
    const have = new Set(ids(html[p]));
    assert.deepEqual(['shared.cta.title', 'shared.cta.lead', 'shared.cta.primary', 'shared.cta.secondary'].filter((k) => !have.has(k)), [], p);
  }
});

test('no hard-coded email or Instagram link without data-setting', () => {
  for (const p of PAGES) {
    const tags = [...html[p].matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
    const bad = tags.filter((t) => /href="mailto:|instagram\.com/.test(t) && !/data-setting="/.test(t));
    assert.deepEqual(bad, [], p);
  }
});

test('every page loads no-indexeddb.js before any other script', () => {
  for (const p of PAGES) {
    const first = html[p].match(/<script\b[^>]*>/)[0];
    assert.equal(first, '<script src="cms/no-indexeddb.js">', p);
  }
});

test('every page loads the CMS stylesheet and module after site.js', () => {
  for (const p of PAGES) {
    assert.ok(html[p].includes('<link rel="stylesheet" href="cms/cms.css">'), p);
    const site = html[p].indexOf('src="js/site.js"');
    const main = html[p].indexOf('<script type="module" src="cms/main.js"></script>');
    assert.ok(site > 0 && main > site, p);
    assert.ok(html[p].includes("classList.add('cms-pending')"), p);
  }
});

test('contact select#f-type is driven by the services list', () => {
  assert.match(html.contact, /<select id="f-type"[^>]*data-cms-options="services"/);
});

test('the media slots and lists are marked', () => {
  assert.match(html.index, /<video[^>]*data-cms-id="home\.hero\.video"[^>]*data-cms-type="video"/);
  assert.match(html.about, /data-cms-id="about\.portrait" data-cms-type="image"/);
  assert.match(html.index, /data-cms-list="services"/);
  assert.match(html.services, /data-cms-list="services"/);
  assert.doesNotMatch(html.index, /data-cms-list="slides"/);
  assert.doesNotMatch(html['book-a-call'], /data-embed="vsl"/);
  assert.match(html.work, /data-cms-list="films"/);
});

test('keys follow the naming rule', () => {
  for (const p of PAGES) {
    const bad = ids(html[p]).filter((id) => !/^(shared|home|work|services|about|book|contact|review)\.[a-zA-Z0-9.]+$/.test(id));
    assert.deepEqual(bad, [], p);
  }
});

test('marker counts', (t) => {
  for (const p of PAGES) t.diagnostic(`${p}.html: ${ids(html[p]).length} data-cms-id markers`);
});
