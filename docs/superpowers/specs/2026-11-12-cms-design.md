# nosMedia CMS: design

Date: 2026-11-12
Repo: `~/nosmedia`. GitHub: `laakeasalvani/nosmedia-demo`, branch `main`, GitHub Pages.
Model to copy: CaptureWithKi (`~/capturewithki`), especially `cms/` and its `CLAUDE.md` hard rules.

## Why

Carson Coen (nosMedia, a Honolulu videographer) has approved site option A. He wants to change
every video and every piece of text himself, without asking Laakea. Laakea wants the same setup
Khiara has on CaptureWithKi, built in phases. **This doc covers phase 1, the CMS (the in-place
editor), only.** The backend phases come later, in this order: the contact form that sends email,
the `/int/` inquiries inbox, client galleries, then contracts. Each one gets its own design.

## Goals

- Carson taps a gear in the footer and logs in. After that, every bit of text on all 7 pages can
  be tapped and edited in place, and every video and photo can be tapped and replaced.
- **Video quality is never reduced.** His files upload byte-for-byte, exactly as he exported them.
  Carson is a videographer, and Khiara already pushed back when her photos were recompressed
  (see the comment at the top of `capturewithki/cms/edit-image.js`).
- He can grow and shrink the lists: add, remove and reorder the service cards, the slider clips
  and the Work films.
- The values in `js/config.js` (email, Instagram, VSL, calendar link, Google review link, reel)
  become editable from the site. `config.js` stays as the fallback.
- Visitors see no change while Carson isn't logged in: same look, same motion, no flash of old text.

## Non-goals (phase 1)

- Any Cloud Functions, email, inquiries, galleries or contracts.
- Shrinking or transcoding video, in the browser or on a server. We might add an optional
  "make a phone-size copy" later, but not now.
- Changing the design, the page layout or the navigation structure (which pages exist, what the
  menu links to). Button labels can be edited; where links point cannot.
- A separate admin dashboard. All editing happens on the live pages.

## Anti-goals (would count as failure even if it "works")

- Any visible quality loss on Carson's footage.
- Editing that's fiddly on his phone. He'll often edit from his iPhone, so tap targets and the
  upload flow have to work in iOS Safari.
- A half-finished upload that blanks a video on the live site. The old file stays live until the
  new one has fully uploaded and saved.
- Breaking the visitor site when Firebase is slow or down. The HTML text and the bundled `media/`
  files stay in place as the fallback.

## Approaches considered

1. **Port CaptureWithKi's inline CMS (chosen).** Same gear login, `data-cms-id` tags, a Firestore
   `content/site` doc, Storage uploads and an `admins` collection. It's proven, Laakea knows it, and
   it's the same thing Khiara uses.
2. A separate dashboard page with forms. Rejected because it's a second thing for Carson to learn
   and doesn't match CaptureWithKi.
3. A Git-based CMS (Decap, Pages CMS). Rejected because Carson would need a GitHub login, and
   GitHub's 100MB-per-file and ~1GB-per-site limits rule out real video.

Video handling: Laakea chose **upload untouched** over shrinking in the browser.

## Decided

- **Firebase:** a new project just for nosMedia, separate from CaptureWithKi. It needs the Blaze
  plan, because new projects need Blaze for Cloud Storage. Laakea creates the project and turns on
  billing; Claude gives exact click-by-click steps and does everything after that (web config,
  rules, deploy, authorized domains). Carson's and Laakea's Firebase Auth accounts go in `admins/{uid}`.
- **Copy CaptureWithKi's rules:** no build step (plain ES modules in `cms/`), Firebase web SDK pinned
  to exactly `10.13.0` in every import, `cms/no-indexeddb.js` loaded first in `<head>` on every
  page, and always-scoped `firebase deploy --only …` commands.
- **Uploads:** any size up to **2GB** per file. Uses `uploadBytesResumable` with a visible progress
  bar and a cancel button, unlike CaptureWithKi's `uploadBytes`, because big videos on phone
  networks need it. **Only H.264 video is accepted (Laakea's decision, 2026-11-12).** HEVC from an
  iPhone or Mac plays fine in Safari, but not in Firefox or on many Android and Windows setups, so
  those visitors would see a frozen video. Before uploading, the browser reads the file's header
  (the MP4/MOV `stsd` sample entry) and accepts only `avc1`/`avc3`. It refuses `hvc1`/`hev1`,
  ProRes and anything it can't read, with a plain-words message telling him to export it again as
  "H.264 MP4" at a high bitrate. It also confirms the file loads in a hidden `<video>`. The editor
  also shows a gentle tip: background loops look best as short 1080p–4K H.264 MP4s. The same rule
  applies to every video slot.
- **Posters:** when a video is replaced, the browser grabs a frame from the new video to use as the
  poster (the still shown while it loads). Carson can also upload his own poster image. The poster
  is a JPEG still and doesn't count as shrinking the video.
- **Hero:** one file serves every screen size, so `data-src-small`/`data-src-large` both fall back
  to the uploaded file. This means phones download the full file. That's accepted for now; the
  optional phone copy later would fix it.

## What's editable

The site has 7 pages (`index`, `work`, `services`, `about`, `book-a-call`, `contact`, `review`).

**Shared across pages, so one edit updates everywhere:** the menu's footer line (location, email
and Instagram text), the footer tagline, the "Reach Carson" block, the footer copyright line, and
the closing CTA block ("Let's make something people watch.", its lead line and its button labels).
CaptureWithKi has one page; here, shared keys are the new idea.

**Per page:** every heading, paragraph, lead, button label, the reveal-text lines, the "How it
works" steps (home and services have different wording, so they get separate keys) and the
"Anywhere on Oʻahu" heading and blurb.

**Single media slots:** the home hero video, the About portrait photo (a placeholder today) and
the Book-a-call VSL (upload or paste a YouTube/Vimeo link).

**Lists (CaptureWithKi `collection-store` / `collection-ui` pattern):**
- `services`: video, title, description. **One list shared by home and Services**, since they show
  the same three cards today.
- `slides`: the home "Anywhere on Oʻahu" slider. Each slide has a video and a caption.
- `films`: the Work page, newest first. Each film has the film itself (an uploaded video played
  with sound and controls, or a YouTube/Vimeo link), a poster, title, blurb, client, type and year.
  Today these are "Film coming soon" placeholders, and an empty video shows that placeholder.

**Settings panel** (opens from the gear while logged in): email, Instagram URL, calendar URL,
Google review URL. These override `js/config.js`.
*(Claude's call)* Every place the email or Instagram appears, both the visible text and the link
(`mailto:` including the pre-filled subject, the header icon, the menu, the footer, contact and
book-a-call), is filled in from these settings and is **not** edited as free text. That way the
text and the link can never disagree. The "@handle" is worked out from the Instagram URL.

*(Claude's call)* The contact form's "What do you need?" dropdown is built from the `services` list
(each card gets a short-label field, which defaults to its title), with "Not sure yet" always last.
So when Carson adds or renames a service, the form follows, as CaptureWithKi's prices drive its form.

## Data layout (builder may refine)

- `content/site`: one doc of flat keys, `shared.*` and `<page>.*` (for example
  `home.hero.title`, `shared.cta.title`). The same idea as CaptureWithKi's `getField/setField`.
- `content/settings`: the config overrides.
- `services/{id}`, `slides/{id}`, `films/{id}`: each has an `order` field.
- Storage: `media/<collection-or-slot>/<id>/<timestamp>-<filename>`. The old file is deleted
  only after the new one is saved.
- Rules: public read and admin-only write on all of the above. Storage write is admin-only with a
  2GB cap and only `video/*` and `image/*` content types allowed.

## Constraints

- Static GitHub Pages hosting, no build step, no npm outside a future `functions/`.
- Authorized domains: `laakeasalvani.github.io`, `localhost`, and Carson's domain once he has one.
- `js/site.js` already wires up autoplay, the slider and reveal animations. Elements created or
  re-rendered from Firestore must be wired up the same way (the slider must count the new slides,
  and new videos must autoplay).
- Pages stay `noindex` while this is still a demo.
- Bandwidth: Firebase Storage charges for downloads. That's fine at Carson's traffic, but a
  multi-GB Work film watched a lot could cost real money. *(Claude's call)* For any upload over
  1GB, the editor shows Carson a warning (not a block) that suggests a YouTube/Vimeo link for long
  films. Laakea gets no notice in phase 1.
- *(Claude's call)* Sign-in works the way CaptureWithKi's `auth.js` really does: it lasts for the
  browser tab only, so it never touches IndexedDB and is compatible with `no-indexeddb.js` loaded on
  every page. Carson signs in again in each new tab, which is the same thing Khiara lives with.

## Left to the builder

- Exactly which elements get `data-cms-id`, and the key names. Keep a marker count per page in a
  `CLAUDE.md`, like CaptureWithKi does.
- How to avoid flashing the old text (CaptureWithKi's `reveal.js` approach, or an equivalent).
- Whether to share modules with CaptureWithKi or copy and adapt them. Copying is expected,
  because the projects deploy separately.
- How to test before the Firebase project exists (the emulator if it runs on this Mac, otherwise
  build against the real project once Laakea makes it).
- A project `CLAUDE.md` for nosMedia with its own hard rules, written in CaptureWithKi's style.
