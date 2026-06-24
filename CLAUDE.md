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
- This is **obscurity, not security** (the flag is client-side). It only controls *visibility*. Truly sensitive tools (DaVinci control, shortener) are still password-protected at their own endpoints.

**When building a new tool, ask Omri: ציבורי / פרטי / שניהם**, then:
- **Public** → normal `<a class="tool-card">` in `index.html`.
- **Private** → `<a class="tool-card admin-only">` in `index.html` — hidden by `body:not(.admin) .admin-only{display:none}`, shown in a **distinct purple identity** when admin. Add the `אדמין` tag.
- **Both** → just public (everyone sees it).
- A tool that touches Omri's machine/data also gets its **own** password at its endpoint.

Per-tool admin behaviour inside a tool (not just the card): read the same flag — `const ADMIN = localStorage.getItem('omri_admin')==='1'` (wrap in try/catch) — and reveal admin-only features. Example: the email-generator hides the MailerLite section and leaves sender/contact blank for the public, but in admin shows MailerLite + prefills Omri's details.

(Superseded: an earlier separate `go.omri-iram.co.il/my/` private hub. The VPS page/route may still exist but is **not** the model — the single link + admin unlock is. Tool pages also no longer show a "חזרה לכל הכלים" back-link, so sharing a tool URL doesn't expose the hub.)

## Current tools

1. **סרגל פרקים ליוטיוב** → `chapter-bar-web` (GitHub Pages)
2. **מערכת מענה המוני ב-Gmail** → Google Apps Script web app
3. **תמלול אוטומטי לסרטונים** → whisper-agent dashboard (VPS, http://147.79.114.195:8080)
4. **הגרלת זוכה** → `randomizer/` (in-repo static page, client-side raffle/randomizer)
5. **מחולל אימייל אוטומטי לטופס** → `email-generator/` (in-repo static page). Generates a Google Apps Script for "auto-email on Google Form submit" from a friendly Hebrew form + live preview. Mirrors Omri's real bound-script template (MailApp send + signature + button palette). **Tool page** uses the "correspondence desk" editorial theme (cream paper, Frank Ruhl Libre serif, ink-blue accent). **The email itself** is customizable: sender name (sets Gmail display name + sign-off, saved in localStorage), email font (web-safe stacks + optional Google webfonts Heebo/Rubik/Assistant/Frank Ruhl Libre loaded via `@import` with graceful fallback), and accent color (heading + links). Body is the full message (no auto greeting); `{שם}` token → participant name at runtime. Optional MailerLite webhook is stored in **localStorage only** (never committed) so the public page never exposes the n8n endpoint; when present, the generated code includes the `addAttendeeToMailerLite_` integration, otherwise it generates email-only code. **Click tracking** (optional): a "מעקב קליקים" toggle + campaign name makes the generated script wrap each button link through *its own* Web App URL (`ScriptApp.getService().getUrl()` + `doGet`), so each click is logged (time · campaign · recipient · link) to a **Clicks** tab in the *user's own* Google Sheet, then redirected to the target — fully serverless, per-user, no central backend (an earlier VPS-service idea was dropped because the tool is public-facing). Requires the user to deploy the script as a Web App (Execute as: Me, Access: Anyone); a note under the generated code explains this.
6. **מקצר קישורים** *(private — card on the private hub only, not on the public page)* → `shortener/` (in-repo static page). Management UI for Omri's own URL shortener. The page is static (GitHub Pages) and calls the **`go-shortener`** Flask service at `https://go.omri-iram.co.il/api/*` over CORS. A **segmented chooser** picks the link type: **🔗 "הקישור שלי"** → branded `go.omri-iram.co.il/xxx` (optional custom alias, listed below with click counts) via `/api/create`; **⚡ "TinyURL"** → plain `tinyurl.com/xxx` (no alias, create+copy only, not tracked) via `/api/tinyurl`. Password-gated; the admin password is stored in `localStorage` only (`go_shortener_pw`) and sent as `X-Admin-Password`. The redirect backend + DB live in the separate `go-shortener` repo on the VPS (not here). `noindex`.
7. **מרכז השליטה של DaVinci** *(admin-only card)* → `https://go.omri-iram.co.il/davinci/`. The DaVinci Control Center dashboard on Omri's home PC, proxied through the VPS over Tailscale, password-gated. Built/documented in the `davinci-automation` repo (`control/`).
8. **מחולל קודי QR** → `qr/` (in-repo static page). URL/text → live QR; color, size, error-correction, transparent-bg; download PNG or SVG. Uses node-qrcode via CDN (`https://cdn.jsdelivr.net/npm/qrcode@1/build/qrcode.min.js` — `toCanvas`/`toDataURL`/`toString`). Public, client-side. (Planned admin add-on: **dynamic/repointable QR** = QR of a `go-shortener` short link you can re-target + click counts.)
9. **בונה קישורי UTM** → `utm/` (in-repo static page). Base URL + utm_source/medium/campaign/term/content → live tagged URL + copy; handles existing `?` in base, URL-encodes values, omits empty params. Public, no deps. (Planned admin add-on: shorten each UTM link via `go-shortener` and compare click counts.)

## Deploy

Push to `master`; GitHub Pages serves the repo root. Custom domain via `CNAME` file (`tools.omri-iram.co.il`).

DNS at Hostinger: CNAME `tools` → `omri-il.github.io`.
