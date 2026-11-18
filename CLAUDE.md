# tools-hub

Static landing page that lists the tools Omri has built, plus several in-repo tool pages. Hebrew RTL.
Old detail and the full feature logs: `docs/HISTORY.md`.

- **Live:** https://tools.omri-iram.co.il (GitHub Pages, `master` root, `CNAME` file; DNS at Hostinger: CNAME `tools` → `omri-il.github.io`).
- **Stack:** vanilla HTML + CSS + small inline/`js/` scripts. No build step.
- **Audience:** anyone who lands here from a video, post or business card: find a tool in one click.
- **The cards are NOT in `index.html`.** They live in a JSON config in the `go-shortener` backend and are drawn in the browser.
- **Look (2026-11-15):** the hub (`index.html` + `css/style.css`) follows the business design language
  (claude-config `design/business-brand.json`): light page, navy `#002045` text and titles, white cards,
  ochre `#FFC250` only as a small "this one" mark (card hover line, favourites line), Rubik titles + Assistant text.
  A category's `accent` colour from the admin no longer paints anything on the hub.
  Since commit `09e293d` (2026-11-15) the tool pages randomizer, qr, tinyurl, email-generator and password-cards
  are on the same business look too.
  Since 2026-11-18 admin, shortener, qr-dynamic, video-search, utm and extra are on it too; `css/style-dark.css` is unused.

## How the hub works

- **Edit cards at** `tools.omri-iram.co.il/admin/` (`admin/index.html`, `noindex`, Google sign-in).
  Drag-and-drop reorder of cards and categories, card CRUD (title/desc/icon/href/newTab/tags),
  per-card visibility (🌐 public / 🔒 admin / 👁️‍🗨️ hidden draft), per-category accent + icon + adminOnly,
  global layout (density / card size / show tags), live preview. **Save** POSTs the whole config;
  **בטל שינוי אחרון** restores the previous version. Nothing publishes until Save.
  Drag lib = `admin/vendor/Sortable.min.js` (vendored, no CDN).
- **Data + endpoints** in `go-shortener` (`hub_config` table, seeded from `hub_seed.py`):
  `GET/POST /api/hub-config` + `POST /api/hub-config/undo` (see go-shortener/CLAUDE.md).
  Anonymous `GET` is filtered server-side (admin/hidden cards and adminOnly categories stripped).
  `init_db()` seeds `hub_config` from `hub_seed.py` only on first run (no env needed).
- **Rendering:** `js/hub-render.js` (`HubRender.renderHub` / `applyLayout`) builds the `.cat-section` / `.tool-card` DOM
  into `#hubRoot`. The page paints at once from `localStorage['hub_config_cache']`, then re-fetches `/api/hub-config`
  (with `X-Session` if present) and updates the cache; on total failure it shows a Hebrew "reload" message, never blank.
  `localStorage['hub_api_base']` overrides the API base for testing.
- **Live config ≠ seed.** The live config was reorganised through the API (2026-07-19, 8 thematic categories:
  וידאו ויוטיוב · אירועים והרשמות · אימייל ודיוור · קישורים וקודים · לכיתה ולמורים · AI ועוזרים · TAU · 🧰 אישי adminOnly).
  `hub_seed.py` still reproduces the original 6 categories and lacks later cards (e.g. `davinci-control-laptop`).
- **To add a tool:** `/admin/` → ➕ כרטיס → fill in, set visibility → Save. No repo edit, no deploy.
  The card `id` is also its analytics `data-tool` id and is auto-registered for click tracking.

## Public vs private: ONE link + hidden admin mode

- One link only: `tools.omri-iram.co.il`. Private tools sit on the same page, hidden until admin mode.
- **Admin mode (visibility only):** triple-click the "OI" logo (hub) or the "הכלים של עומרי אירם" kicker (tool page)
  within ~1.2 s → PIN `9464` → `localStorage['omri_admin']='1'` → `body.admin`. A "🔓 מצב אדמין · יציאה" chip exits.
  This is obscurity, not security.
- **Admin cards need Google sign-in too:** admin/hidden cards only arrive from the backend with a valid `omri_session`.
  An expired token = fewer cards; sign in again through any admin tool.
- **Google sign-in** (shortener, qr, utm, extra, video-search, whatsapp; only hello@omri-iram.co.il):
  the page redirects to `go.omri-iram.co.il/api/auth/google/start?return=<page>` → go-shortener checks hello@
  (`email_verified`) and mints a 30-day HMAC-signed token → back to `<page>#omri_session=<token>` → an inline IIFE moves it
  into `localStorage['omri_session']` and strips the URL. Sent as the `X-Session` header. On `401` the page bounces through Google again.
- go-shortener and extra-bridge sign with the same `TOTP_SECRET`, so one token works on both.
  Setup + env (`GOOGLE_OAUTH_CLIENT_ID/SECRET`, `ADMIN_EMAIL`, `FLASK_SECRET`, redirect URI
  `https://go.omri-iram.co.il/api/auth/google/callback`): go-shortener/CLAUDE.md → "Google sign-in setup".
  It is a Web OAuth client shared with Thank-you-letter / forms-to-mailerlite.
- **Break-glass:** `POST /api/auth` (go-shortener) / `/api/extra/auth` (extra-bridge) with a TOTP `{code}`
  (Google Authenticator "Omri Admin Tools") mints the same token from any HTTP client; no UI shows it.
  Static passwords (`ADMIN_PASSWORD`, `EXTRA_BRIDGE_PASSWORD` via `X-Admin-Password`) are a deeper fallback.

## The tools

| Tool | Where | Notes |
|---|---|---|
| סרגל פרקים ליוטיוב | `chapter-bar-web` (GitHub Pages) | |
| מערכת מענה המוני ב-Gmail | Google Apps Script web app | |
| תמלול אוטומטי | whisper-agent dashboard, VPS :8080 (Tailscale + localhost per PROJECTS.md) | |
| הגרלת זוכה | `randomizer/` | client-side |
| מחולל אימייל לטופס | `email-generator/` | generates an Apps Script for the user's own Form. Admin mode adds MailerLite + Omri's details |
| מקצר קישורים ממותג | `shortener/` → go-shortener `/api/*` | Google sign-in |
| מקצר מהיר (TinyURL) | `tinyurl/` → go-shortener `/api/tinyurl` | CORS-locked to the tools origin |
| מחולל קודי QR | `qr/` (node-qrcode via jsDelivr CDN) | admin mode adds "QR דינמי" (go-shortener links + scan counts) |
| QR דינמי (גוגל שיטס) | `qr-dynamic/` | generates an Apps Script whose cell B1 holds the target |
| בונה קישורי UTM | `utm/` | admin mode adds shorten + click comparison |
| הקלטות שיחות (Extra) | `extra/` → `go.omri-iram.co.il/extra/api/*` | extra-bridge (VPS :8092) |
| מחפש סרטונים | `video-search/` → scraper-bridge (VPS :8094, repo Social-Media-Scraper) | YouTube for all; TikTok/IG/FB need admin (Apify) |
| כרטיסי סיסמה לתלמידים | `password-cards/` | 100% client-side, v1.4.0 |
| פוסטים לוואטסאפ | `whatsapp/` → `go.omri-iram.co.il/wa/api` | Content Machine's posts, also an Android PWA |
| DaVinci control | `http://100.111.186.101:5007/` (home PC) and `http://127.0.0.1:5007/` (this machine) | Tailscale, no password; repo davinci-automation `control/` |
| מוריד וידאו | `http://100.111.186.101:5112/` (ytdlp-bridge, home PC) | Tailscale, no password |
| סטודיו ה-Gems | `http://100.111.186.101:5012/` (home PC) | Tailscale; repo Gems-in-STEM is archived (→ gemstem `studio`) |
| ייבוא טופס ל-MailerLite | `https://forms.omri-iram.co.il/admin/import` | repo forms-to-mailerlite, VPS unit `forms-import` :5021 |
| TAU stations | biomimicry / micropod / energy `.omri-iram.co.il` | |

The live list, and each card's visibility (🌐 / 🔒 / 👁️‍🗨️), is the config in `/admin/`; this table is only a map of
folders and backends, so it has no visibility column (it disagreed with live config v29 on 2026-11-18).
`teacher-club/favicon.png` is not a card: it is the Teacher-Club-TLV Apps Script app's favicon
(art from claude-config `scripts/favicon/make_favicons.py`, row `teacherclub`). Do not delete it, the live app links to it.

**`whatsapp/` in short:** the API is content-machine's `bot/wa_web.py` (systemd `content-machine-wa-web`), which checks
`X-Session` with go-shortener; posts live in the Google Sheet "פוסטים לוואטסאפ". Board views חודש · שבוע · יום · רשימה,
approvals, typo check, ideas, 🎬 kanban, 📣 versions for other channels (✓ פרסמתי כאן, 🚀 Claude posts to Facebook),
late-hour warning, 📊 מי עוזר לי (2026-11-15: clicks a post and sign-ups per channel). Feature-by-feature detail
lives in content-machine's CLAUDE.md and in `docs/HISTORY.md`. PWA files: `whatsapp/manifest.webmanifest`, `whatsapp/sw.js`, `whatsapp/icons/`.

## Usage analytics

Each `.tool-card` has `data-tool="<id>"`; a hub click sends a `keepalive` ping to go-shortener `POST /api/track {tool}`
(event delegation, so rendered cards work). Omri vs visitor is decided server-side by a valid `omri_session`.
go-shortener keeps lifetime totals + 90-day daily buckets (`tool_stats` / `tool_stats_daily`), served at authed `GET /api/stats`.
Counts only: no PII, no cookies, no third party. Only clicks on the hub page count.
The allow-list comes from the hub config (every card `id`); `TRACK_TOOLS` in go-shortener `app.py` is only a boot fallback.
The admin `#statsPanel` is **hidden since 2026-07-19** (Omri's request): `hidden` attribute in `index.html`,
`maybeRenderStats()` returns early. Remove `hidden` to bring it back.

## Run, test, deploy

- **Run locally:** `python -m http.server 8099` in the repo root, open `http://127.0.0.1:8099/`.
- **Test:** with that server running, `npm install` and `npx playwright install chromium` once, then
  `npx playwright test tests/analytics.spec.mjs` (expects `http://127.0.0.1:8099`; stubs `go.omri-iram.co.il/api/track`).
  The second test checks the stats panel, which is hidden since 2026-07-19; it may need updating.
- **Deploy:** push / merge to `master`; GitHub Pages serves the root. No workflow, no server here.
- The hub also needs the go-shortener backend (`/api/hub-config`). Its deploy is on the VPS
  (`ssh root@147.79.114.195`, `cd /root/Projects/go-shortener`, `git pull`, `systemctl restart go-shortener`). Deploy your own merged work yourself (NOTES.md item 11b):
  note a rollback point (the current commit) first, then check `https://go.omri-iram.co.il/api/hub-config` live; roll back if it breaks.
  If Pages is live but go-shortener is not updated, the hub renders from cache or shows the reload message.

## Rules and known gotchas

**Whole repo**
- **Everything in this repo is public.** GitHub Pages (with `.nojekyll`) serves every file, including this CLAUDE.md and `docs/`
  (checked 2026-11-15: `/CLAUDE.md` returns 200). Never put a secret, key or private note in any file.
- A change to `css/style.css` → bump the `?v=` cache-buster in `index.html` (it is `v=4` now).
- New tool: its card is 🔒 admin by default; say so in the wrap-up, and Omri can make it 🌐 public (2026-11-18).
  A tool that touches Omri's machine or data also gets its **own** auth at its endpoint (Google sign-in or Tailscale-only).
- Admin features inside a tool page read the same flag: `const ADMIN = localStorage.getItem('omri_admin')==='1'` (wrap in try/catch).
- The "חזרה לכל הכלים" back-link to the hub is standard on tool pages (since 2026-06-24); a new tool page gets one too.
- The old separate private hub `go.omri-iram.co.il/my/` is superseded; do not build on it.
- The Google OAuth flow lives only in go-shortener; extra-bridge only verifies `X-Session`.
- `qr.svg` holds the fixed address `https://tools.omri-iram.co.il` only (made once with `segno`, error M, border 2). Nothing generated at run time.
- extra-bridge on the VPS is **not a git repo**: it deploys by scp.
- ytdlp-bridge also serves the machine API `POST /download` (X-API-KEY) that the VPS whisper-agent depends on: do not break it.
- video-search paid search has server-side caps: `max` ≤ 25 and 50 paid searches/day (429 over cap); `/analyze` 10/min per IP + 200/day.

**Text and look teachers see (Omri, 2026-11-18)**
- No em dash (—) on any page or card a teacher sees: use a full stop or a comma.
- "Gemini Skills" / "כישורים", never "Gems", in any text a teacher reads, gemstem's card and pages included.
  Only product or address names keep their spelling (e.g. gemstem.co.il).
- "Gemini Notebook", never "NotebookLM".
- Favicons of business tools: navy `#002045` background with a white or ochre glyph; tools differ by the glyph's shape,
  not by colour. claude-config `scripts/favicon/make_favicons.py` rows match this (2026-11-18).
- Fonts are self-hosted, never from a CDN.

**Done 2026-11-18** (fonts self-hosted in `fonts/` + `css/fonts.css`; every page on the business look; navy favicons;
card texts fixed in the live config and `hub_seed.py`). Only exception: the email the email-generator writes may
`@import` a Google font for the teacher's own email (it is the user's product, not our page).

**`email-generator/` (Apps Script it generates)**
- Tracked links use the pasted `WEBAPP_URL` (must end in `/exec`), fallback `ScriptApp.getService().getUrl()`; otherwise the raw link, untracked.
  Never a `/dev` URL. `_webAppBase_` rewrites `/macros/u/N/s/` → `/macros/s/` (account-slot URLs fail for logged-out recipients).
- The `doGet` redirect page: no meta-refresh (it loads the target inside Google's sandbox iframe → "refused to connect");
  use `window.top.location.href` **plus** `.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)`,
  and keep the `➜ המשך ליעד` button with `target="_top"` as the fallback. The click is logged before the page renders.
- `setup()` ends with `ss.toast()` + `Logger.log`, never `Browser.msgBox` (blocks, and throws "Cannot call from this context" from the editor).
- Clicks are written beside each response row: a `לחצו?` summary column + one column per button (`BUTTON_LABELS`),
  `count · dd/MM HH:mm`; button lookups start at the `לחצו?` column so a label cannot collide with a question header; `LockService` guards it.
- Follow-ups baseline all existing rows on the first run, so old submissions are never blasted. They get no Drive attachment.
- An uploaded logo goes in as base64 and is sent as an inline CID image (`cid:topLogo`): Gmail/Outlook strip `data:` URIs.
- No open/read tracking: unreliable in Gmail and Apps Script cannot serve a pixel.
- The MailerLite webhook is kept in localStorage only, never committed; it and the logo data are stripped from the `#t=` share link.
- Theme toggle: do not put `background`/`background-color` in a `transition` on var()-driven buttons;
  Chromium freezes the colour after a `[data-theme]` switch.

**`password-cards/`**
- Privacy is the point: zero external requests. Libraries and fonts are vendored (`vendor/`, `fonts/`); keep it that way.
- Card art: flat SVG only, no CSS/SVG filters or masks (unreliable in html2canvas → PDF).
- Preview scales by an inline `--u` var, never `transform: scale` (the layout box stays big and cards clip).
- Parser: the Ministry PDF maps Hebrew to U+02A0–U+02BA and stores names reversed (`fixHebrew()`); passwords are not always
  6 digits, so fields are assigned by elimination using pdfjs x/y coords, not fixed regex.
- Duplex mirror: front grid `dir:rtl`, back grid `dir:ltr`. The version tag is a static constant: bump it on a release.

**`whatsapp/`**
- A change to `whatsapp/sw.js` → bump `SHELL`.
- `localStorage.wa_api_base` overrides the API base for a local test.
- Confirmations use `sheet()`, not `confirm()`. The late-hour check is a warning, never a block ("בכל זאת" sends `late_ok`).
- Ochre `#ffc250` is unreadable as text on white: text uses `--accent-text` `#7D5700` (the brand file's `ochre_text`).
- The API's `/state` range limit is 12 weeks each way.

**`qr-dynamic/`**: Apps Script cannot send a header redirect, so scans show a short "מעבירים אתכם…" page.

## History

Dated feature logs, fix stories and the old numbered tool list: `docs/HISTORY.md`.
