# nosMedia: project context for Claude

This is Carson Coen's videographer site (Honolulu). Laakea drives the work, and Carson is the one
who uses the editor.

- **Live demo:** https://laakeasalvani.github.io/nosmedia-demo/ (GitHub Pages, `main` branch, repo root, `noindex` on every page)
- **Firebase project:** `nosmedia-site` (Blaze plan)
- **Local preview:** launch config `nosmedia`, port 4520
- **Spec / plan:** `docs/superpowers/specs/2026-11-12-cms-design.md`, `docs/superpowers/plans/2026-11-12-cms.md`

The CMS is a port of CaptureWithKi's inline editor (`~/capturewithki/cms/`). Read that project's
`CLAUDE.md` for the history behind the copied modules.

## How Carson edits

Tap the gear in the footer of any page (on `review.html` it's a fixed corner button) and log in.
That turns on editing:

- **Text:** tap any dashed outline and type. Enter or tapping away saves. Links and buttons don't
  navigate while editing; tap **Done** to browse normally.
- **Hero video / About photo:** use the **Replace video** / **Replace photo** button.
- **Lists:** services (home + Services + the contact dropdown), slides (home slider) and films
  (Work). Each item has ← → to reorder, Replace video (or Upload film), Paste link (films),
  Form label (services) and × to delete. There's also **+ Add** below each list.
- **Settings** (in the bottom bar): email, Instagram, calendar link, Google review link, and the
  book-a-call video.

Login is per browser tab, so Carson signs in again in each new tab.

## HARD RULES

1. **Never run a bare `firebase deploy`.** Always `firebase deploy --only firestore:rules,storage --project nosmedia-site`. There are no Functions yet.
2. **Never re-encode, shrink or transcode Carson's videos.** Uploads go up byte-for-byte. The only generated file is a JPEG poster still (max 2560px).
3. **H.264 only.** `cms/video-check.js` refuses HEVC and ProRes by reading the file's `stsd` sample entries. Don't relax this to "it plays in my browser": Safari plays HEVC, but Firefox and many Android and Windows browsers don't.
4. **Never ask for, guess or type Carson's or Laakea's password.** When a logged-in test is needed, ask Laakea to type it in the Browser pane.
5. **No build step.** Plain ES modules in `cms/`. No `package.json` at the root. Firebase web SDK pinned to exactly `10.13.0` in every gstatic import.
6. **`cms/no-indexeddb.js` is the first `<script>` on every page.** Safari's IndexedDB can hang Firebase forever. Login is tab-only (`browserSessionPersistence`), so it never needs IndexedDB.
7. **Don't break the markers.** After any HTML or `cms/` change, run:
   ```
   node --test 'tests/*.test.js'
   ```
   `tests/markers.test.js` checks the `data-cms-id` keys, shared keys, `data-setting` links and the script order. Marker counts on 2026-11-12: index 44, work 24, services 33, about 29, book-a-call 35, contact 32, review 14.
8. **Carson's phone number never appears anywhere on the site.** Contact routes are email, the form and Instagram.
9. **Email and Instagram are settings, not text.** Every link and every bit of text showing them carries `data-setting`, and `cms/settings-ui.js` fills them in. Never hard-code them.
10. **Every Firestore read the page waits on has a 3s limit** (`cms/timeout.js`). Seeding a list always re-reads strictly first (`readCollection`), so a timeout is never mistaken for "empty".

## Content model

- `content/site`: flat keys. `shared.*` keys repeat across pages (header, menu, footer, closing CTA). `<page>.<section>.<name>` keys are used once (page = `home|work|services|about|book|contact|review`). Media slots store `{src, poster}` (video) or a URL (image).
- `content/settings`: overrides for `js/config.js` (`email`, `instagram`, `calendarUrl`, `googleReviewUrl`, `vslUrl`).
- `services`, `slides`, `films`: one doc per item, with an `order` field. These stay empty until Carson first turns on editing; then the HTML items are copied in.
- Storage: `media/<slot>/<id>/<timestamp>-<name>`. Public read; admin write; < 2GB; `video/*` or `image/*` only.
- `admins/{uid}`: who can edit. It's added by hand in the Firebase console.

## What's next (the backend, in order)

1. The contact form actually sends (Cloud Function + Resend), like CaptureWithKi's `submitInquiry`.
2. `/int/` inquiries inbox.
3. Client galleries.
4. Contracts.

Each gets its own spec first.
