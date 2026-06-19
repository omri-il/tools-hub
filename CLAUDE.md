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

## Current tools

1. **סרגל פרקים ליוטיוב** → `chapter-bar-web` (GitHub Pages)
2. **מערכת מענה המוני ב-Gmail** → Google Apps Script web app
3. **תמלול אוטומטי לסרטונים** → whisper-agent dashboard (VPS, http://147.79.114.195:8080)

## Deploy

Push to `master`; GitHub Pages serves the repo root. Custom domain via `CNAME` file (`tools.omri-iram.co.il`).

DNS at Hostinger: CNAME `tools` → `omri-il.github.io`.
