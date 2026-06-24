# tools-hub

Static landing page that lists all public-facing tools Omri has built. Hebrew RTL.

- **Live:** https://tools.omri-iram.co.il (GitHub Pages, `master` root)
- **Stack:** vanilla HTML + CSS. No JS, no build step.
- **Audience:** anyone who lands here from a video, post, or business card — needs to find a tool in one click.

## Adding a new tool

Edit `index.html` and append a new `<a class="tool-card">` block inside `.tools-grid`. Each card needs:

- `href` — the live URL
- `.tool-icon` — one emoji (will sit in a soft gradient badge)
- `.tool-title` — short Hebrew name
- `.tool-desc` — 1–2 sentence Hebrew description (what it does + who it's for)
- `.tool-tags` — 2–3 short tags (audience / pricing / where it runs)

That's it — the grid auto-flows.

## Public vs private — ONE link + hidden admin unlock

There is **one link only**: `tools.omri-iram.co.il`. No separate private URL. Private tools live on the *same* page but are hidden until **admin mode** is unlocked.

**Admin unlock (client-side, same-origin, shared across all tool pages):**
- Trigger: **triple-click the "OI" brand logo** (on the hub) or the **"הכלים של עומרי אירם" kicker** (on a tool page) within ~1.2s → PIN prompt → code **`9464`** → sets `localStorage['omri_admin']='1'` → `document.body.classList.add('admin')`. A "🔓 מצב אדמין · יציאה" chip lets you exit.
- This is **obscurity, not security** (the flag is client-side). It only controls *visibility*. Truly sensitive tools are protected at their own endpoints — by **TOTP** (shortener, qr, extra — see below) or by **Tailscale-only** network gating (DaVinci control, video downloader).

### TOTP admin auth (shortener · qr · extra bridges)

The bridge tools no longer use static passwords. They share **one TOTP secret** (Google Authenticator entry "Omri Admin Tools"), so **one 6-digit code unlocks all of them**:
- `POST /api/auth` (go-shortener) or `/api/extra/auth` (extra-bridge) exchanges a 6-digit code for a **30-day, HMAC-signed session token** (stateless → works across gunicorn workers).
- The frontend stores that token in `localStorage['omri_session']` (shared key across all three tools) and sends it as the **`X-Session`** header. On `401` it re-prompts for a fresh code once and retries.
- Because both bridges sign tokens with the **same** `TOTP_SECRET`, a single `omri_session` token is **cross-valid** on both — log in once, authed everywhere for 30 days.
- The old static passwords (`ADMIN_PASSWORD`, `EXTRA_BRIDGE_PASSWORD`) remain as a **break-glass fallback only** (backend still accepts `X-Admin-Password`); **no UI exposes them**. If the phone/Authenticator is lost, recover via that, or re-mint the secret over SSH.
- Re-enroll the Authenticator: render a QR from the shared `TOTP_SECRET` as `otpauth://totp/Omri%20Admin%20Tools?secret=…&issuer=omri-iram` (segno, generated locally so the secret never leaves the machine).

**When building a new tool, ask Omri: ציבורי / פרטי / שניהם**, then:
- **Public** → normal `<a class="tool-card">` in `index.html`.
- **Private** → `<a class="tool-card admin-only">` in `index.html` — hidden by `body:not(.admin) .admin-only{display:none}`, shown in a **distinct purple identity** when admin. Add the `אדמין` tag.
- **Both** → just public (everyone sees it).
- A tool that touches Omri's machine/data also gets its **own** password at its endpoint.

Per-tool admin behaviour inside a tool (not just the card): read the same flag — `const ADMIN = localStorage.getItem('omri_admin')==='1'` (wrap in try/catch) — and reveal admin-only features. Example: the email-generator hides the MailerLite section and leaves sender/contact blank for the public, but in admin shows MailerLite + prefills Omri's details.

(Superseded: an earlier separate `go.omri-iram.co.il/my/` private hub. The VPS page/route may still exist but is **not** the model — the single link + admin unlock is. Tool pages also no longer show a "חזרה לכל הכלים" back-link, so sharing a tool URL doesn't expose the hub.)

## Current tools

1. **סרגל פרקים ליוטיוב** → `chapter-bar-web` (GitHub Pages)
2. **מערכת מענה המוני ב-Gmail** *(admin-only card)* → Google Apps Script web app
3. **תמלול אוטומטי לסרטונים** *(admin-only card)* → whisper-agent dashboard (VPS, http://147.79.114.195:8080)
4. **הגרלת זוכה** → `randomizer/` (in-repo static page, client-side raffle/randomizer)
5. **מחולל אימייל אוטומטי לטופס** → `email-generator/` (in-repo static page). Generates a Google Apps Script for "auto-email on Google Form submit" from a friendly Hebrew form + live preview. Mirrors Omri's real bound-script template (MailApp send + signature + button palette). **Tool page** uses the "correspondence desk" editorial theme (cream paper, Frank Ruhl Libre serif, ink-blue accent). **The email itself** is customizable: sender name (sets Gmail display name + sign-off, saved in localStorage), email font (web-safe stacks + optional Google webfonts Heebo/Rubik/Assistant/Frank Ruhl Libre loaded via `@import` with graceful fallback), and accent color (heading + links). Body is the full message (no auto greeting); `{שם}` token → participant name at runtime. Optional MailerLite webhook is stored in **localStorage only** (never committed) so the public page never exposes the n8n endpoint; when present, the generated code includes the `addAttendeeToMailerLite_` integration, otherwise it generates email-only code. **Click tracking** (optional): a "מעקב קליקים" toggle + campaign name makes the generated script wrap each button link through *its own* Web App URL (`ScriptApp.getService().getUrl()` + `doGet`), so each click is logged (time · campaign · recipient · link) to a **Clicks** tab in the *user's own* Google Sheet, then redirected to the target — fully serverless, per-user, no central backend (an earlier VPS-service idea was dropped because the tool is public-facing). Requires the user to deploy the script as a Web App (Execute as: Me, Access: Anyone); a note under the generated code explains this. **Templates** (תבנית dropdown fills subject/body/buttons: materials/thanks/webinar/update). **Top image/logo** (URL field → centered at the top of the email; carried into the generated code as `TOP_IMAGE`). **🔍 full-size preview** button opens the rendered email in a new tab as a quick visual "test"; a real inbox test is the generated `sendTestEmail()` (run once in Apps Script). **Buttons** support an optional icon/emoji + per-button **style** (filled / outline / pill). **Save your own template** (💾 — stored in `localStorage['eg_my_templates']`, listed under "התבניות שלי" in the dropdown, 🗑 to delete) and **↺ reset to default**. Click tracking now logs the **button label** (a "כפתור" column) next to the URL in the Clicks sheet. (Open/read tracking is intentionally NOT offered — unreliable in Gmail and not feasible from Apps Script, which can't serve an image pixel.)
6. **מקצר קישורים ממותג** *(admin-only card)* → `shortener/` (in-repo static page). The public TinyURL mode is now its own public tool (#10); this branded one stays admin. Management UI for Omri's own URL shortener. The page is static (GitHub Pages) and calls the **`go-shortener`** Flask service at `https://go.omri-iram.co.il/api/*` over CORS. A **segmented chooser** picks the link type: **🔗 "הקישור שלי"** → branded `go.omri-iram.co.il/xxx` (optional custom alias, listed below with click counts) via `/api/create`; **⚡ "TinyURL"** → plain `tinyurl.com/xxx` (no alias, create+copy only, not tracked) via `/api/tinyurl`. **TOTP-gated** (see "TOTP admin auth" above) — a 6-digit Google Authenticator code → `omri_session` token sent as `X-Session`; the login gate now asks for the code, not a password. The redirect backend + DB live in the separate `go-shortener` repo on the VPS (not here). `noindex`.
7. **מרכז השליטה של DaVinci** *(admin-only card)* → `http://100.111.186.101:5007/` (Tailscale, your devices only, **no password**). The DaVinci Control Center on Omri's home PC. The public `go.omri-iram.co.il/davinci/` VPS route was **removed** (it runs scripts on the PC). Built/documented in the `davinci-automation` repo (`control/`).
8. **מחולל קודי QR** → `qr/` (in-repo static page). URL/text → live QR; color, size, **error-correction default H**, transparent-bg, **center logo** (white backing so it still scans), **caption above/below** with font+size+color; download PNG (full composite) or SVG (code only). Uses node-qrcode via CDN (`https://cdn.jsdelivr.net/npm/qrcode@1/build/qrcode.min.js` — `toCanvas`/`toDataURL`/`toString`). Public, client-side. **Admin (unlock):** a "QR דינמי" section creates/repoints `go-shortener` links and shows scan counts — QR of a short link you can re-target after printing. Calls `go.omri-iram.co.il/api/{create,update,list}` (CORS-allowed origin) authed by the shared **`omri_session`** TOTP token (`X-Session`).
9. **בונה קישורי UTM** *(admin-only card)* → `utm/` (in-repo static page). Base URL + utm_source/medium/campaign/term/content → live tagged URL + copy; handles existing `?` in base, URL-encodes values, omits empty params. No deps. (Planned admin add-on: shorten each UTM link via `go-shortener` and compare click counts.)
10. **מקצר קישורים מהיר (TinyURL)** *(public)* → `tinyurl/` (in-repo static page). URL (+ optional custom **alias**) → plain `tinyurl.com/xxx` via the now-public `go-shortener` `/api/tinyurl` (accepts `alias`; CORS-locked to the tools origin; no password). Split out from #6 so anyone can use it.
11. **הקלטות שיחות (Extra)** *(admin-only card)* → `extra/` (in-repo static page) backed by the **`extra-bridge`** Flask service on the VPS. Search Extra (אקסטרה) call recordings by phone / date / contact name / recent, then listen + download (MP3). Calls `https://go.omri-iram.co.il/extra/api/{search,download}` authed by the shared **`omri_session`** TOTP token (`X-Session`, re-prompt-on-401 `apiFetch`); the Extra Bearer token stays server-side. Repo: `omri-il/extra-bridge` (VPS `/root/Projects/extra-bridge`, systemd `extra-bridge.service`, port 8092, **not a git repo on the VPS — deploy via scp**).
12. **מוריד וידאו** *(admin-only card)* → `http://100.111.186.101:5112/` (Tailscale, your devices only, **no password** — trusts localhost + `100.64.0.0/10`, like the DaVinci card). A Hebrew RTL download manager **served by the existing `ytdlp-bridge`** on the home PC: paste a YouTube / Facebook / TikTok / Instagram URL → pick video (mp4 + quality best/1080p/720p) or audio (mp3) → background download into a library on the PC → per-item buttons **שמור למכשיר / תמלל / מחק** and **הורד כתוביות (SRT)**. The "תמלל" button reuses the VPS whisper-agent flow. The card links out to the Tailscale URL (no mixed-content issue — the page is served from the home PC, not GitHub Pages). Repo: `omri-il/ytdlp-bridge` (port 5112). The same service still serves the unchanged machine API `POST /download` (X-API-KEY) that the VPS whisper-agent depends on.

**Hub layout:** `index.html` groups cards into category `<section class="cat-section">` blocks (🎬 וידאו ויוטיוב · ✉️ אימייל · 🔗 קישורים וקודים · 🎲 כללי · 🔒 אדמין). The whole **אדמין** section is `cat-section admin-only` (hidden unless admin); individual admin tools in other sections keep the `tool-card admin-only` class. The shortener/qr/extra tools log in with a 6-digit TOTP code (shared `omri_session` token, 30-day) and re-prompt inline on 401.

## Deploy

Push to `master`; GitHub Pages serves the repo root. Custom domain via `CNAME` file (`tools.omri-iram.co.il`).

DNS at Hostinger: CNAME `tools` → `omri-il.github.io`.
