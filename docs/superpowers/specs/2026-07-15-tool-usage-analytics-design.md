# Tool Usage Analytics for tools-hub — Design

**Date:** 2026-07-15
**Status:** Approved, pending implementation plan
**Repos touched:** `tools-hub` (frontend, local) · `go-shortener` (backend, VPS)

## Goal

Know which tools on `tools.omri-iram.co.il` get used the most — both:

1. **Omri's own usage** ("just for me"), and
2. **Visitors' usage** of the public tools.

Per tool, keep a running total plus a per-day tally so a simple trend is visible over time. View it inline on the hub in admin mode. Counts only — no PII, no cookies, no third-party analytics.

## Non-goals (YAGNI)

- No full per-click event log (a 90-day daily bucket is enough for trends).
- No tracking of *who* a visitor is — only anonymous counts.
- No instrumentation inside external tools (Tailscale pages, Apps Script apps, other subdomains). The hub click is the one uniform counting point.
- No new service, no new subdomain, no third-party analytics (Clarity/GA/etc.).

## Architecture overview

```
Browser (tools.omri-iram.co.il/index.html)
  │  click on <a class="tool-card" data-tool="qr">
  │  → fetch POST /api/track {tool:"qr"}  (keepalive, fire-and-forget,
  │     optional X-Session header from localStorage['omri_session'])
  ▼
go-shortener (Flask, VPS, https://go.omri-iram.co.il)
  ├─ POST /api/track  → validate tool against allowlist; if valid X-Session
  │                     (hello@) → admin increment, else visitor increment;
  │                     bump tool_stats + tool_stats_daily; 204
  └─ GET  /api/stats  → (X-Session, hello@ only) per-tool totals + last-90d daily
  ▼
Admin panel (index.html, admin mode only)
  → GET /api/stats → ranked Hebrew RTL table: total / my / visitor + sparkline
```

## Component 1 — Click tracking (tools-hub `index.html`)

### Per-card id
Each `<a class="tool-card">` gets a stable `data-tool="<id>"` attribute. Ids are short, stable slugs — for in-repo tools use the folder name (`qr`, `qr-dynamic`, `utm`, `shortener`, `tinyurl`, `extra`, `randomizer`, `email-generator`, `video-search`); for external tools use a hand-picked slug (`chapter-bar`, `biomimicry`, `micropod`, `energy`, `whisper`, `gmail-mass-reply`, `time-tracker`, `plant-care`, `video-downloader`, `davinci-control`, `notebooklm`, `gems`, `thanks-letter`, `geg-events`, `forms-mailerlite`). This exact list is the backend allowlist (kept in sync manually — the spec and the allowlist are the one truth; adding a tool means adding its id in both, documented in tools-hub CLAUDE.md).

A card with no `data-tool` is simply not tracked (graceful).

### The ping
A small inline `<script>` (theme-independent, no dependencies):

```js
const TRACK_URL = 'https://go.omri-iram.co.il/api/track';
const DEBOUNCE_MS = 5000;

function track(toolId) {
  try {
    // Light debounce: skip a repeat ping for the same tool within 5s.
    const key = 'tt_last_' + toolId;
    const now = Date.now();
    const last = Number(localStorage.getItem(key) || 0);
    if (now - last < DEBOUNCE_MS) return;
    localStorage.setItem(key, String(now));

    let session = '';
    try { session = localStorage.getItem('omri_session') || ''; } catch (_) {}
    const headers = { 'Content-Type': 'application/json' };
    if (session) headers['X-Session'] = session;

    fetch(TRACK_URL, {
      method: 'POST',
      keepalive: true,               // completes even as the link opens
      headers,
      body: JSON.stringify({ tool: toolId }),
    }).catch(() => {});               // fire-and-forget; never block navigation
  } catch (_) { /* analytics must never break the page */ }
}

document.querySelectorAll('.tool-card[data-tool]').forEach((card) => {
  card.addEventListener('click', () => track(card.dataset.tool));
});
```

Notes:
- **`fetch(..., {keepalive:true})`, not `navigator.sendBeacon`** — beacon can't set the `X-Session` header, which we need to attribute the click to Omri. `keepalive` lets the request survive the page navigation.
- The click is **not** `preventDefault`-ed; the link opens exactly as today.
- Entirely wrapped in try/catch — a tracking failure must never affect the page.

### "Me" vs "visitor" — decided server-side
Attribution is **not** a client-supplied boolean (spoofable). The ping simply forwards the `omri_session` token if present. The backend verifies it (same HMAC check go-shortener already uses for `X-Session`); a valid hello@ token counts as Omri, anything else counts as a visitor. So Omri's personal counter is genuinely authenticated, and no visitor can inflate it.

### Known limitation (documented, accepted)
Only clicks **from the hub page** are counted. Direct/bookmarked visits to a tool URL, and any navigation inside external tools, are invisible to the counter. This is acceptable for the "which tools are most used" question and is called out in tools-hub CLAUDE.md.

## Component 2 — Backend (go-shortener, VPS)

Three additions to the existing Flask app. Reuses the existing SQLite DB, CORS config (origin already locked to the tools origin), and `X-Session` HMAC verification.

### Data model (two small tables)
```sql
CREATE TABLE IF NOT EXISTS tool_stats (
  tool_id      TEXT PRIMARY KEY,
  total        INTEGER NOT NULL DEFAULT 0,   -- all clicks
  admin_total  INTEGER NOT NULL DEFAULT 0    -- Omri's clicks (subset of total)
);

CREATE TABLE IF NOT EXISTS tool_stats_daily (
  tool_id  TEXT NOT NULL,
  day      TEXT NOT NULL,                     -- 'YYYY-MM-DD' (Asia/Jerusalem)
  total    INTEGER NOT NULL DEFAULT 0,
  admin    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tool_id, day)
);
```
`admin_total` / `admin` are a subset of `total`; visitor count = `total - admin`.

### `POST /api/track` (public, CORS-locked to tools origin)
- Body: `{ "tool": "<id>" }`.
- Reject if `tool` not in the allowlist (return `204` anyway — silent, so probing learns nothing; just don't write).
- Determine `is_admin`: if a valid hello@ `X-Session` is present → true, else false.
- Upsert both tables (`total += 1`, and `admin(_total) += 1` when `is_admin`), `day` = today in Asia/Jerusalem.
- **Rate-limit** per IP (light token bucket, e.g. ≤ ~60/min) purely as an abuse guard. IP is used only in-memory for the limiter and **never stored**.
- Return `204 No Content`.

### `GET /api/stats` (authed — hello@ `X-Session` only)
- Returns JSON:
  ```json
  { "tools": [
    { "tool": "qr", "total": 340, "me": 12, "visitors": 328,
      "daily": [ { "day": "2026-07-14", "total": 8, "admin": 1 }, ... ] }
  ] }
  ```
- `daily` limited to the last 90 days.
- `401` on missing/expired token (the panel then bounces through Google, same as other admin tools).

### Retention
`tool_stats_daily` rows older than 90 days are trimmed — either lazily on write or in an existing periodic job (whichever fits go-shortener's current structure; decided during implementation against the real code).

### CORS / security notes
- `/api/track` is intentionally open (visitors have no token) but CORS-restricted to the tools origin and allowlist-guarded, so it can only ever bump a known tool's counter — no arbitrary data written.
- `/api/stats` requires the shared `omri_session` token, identical to shortener/qr/utm/extra.

## Component 3 — Admin stats panel (tools-hub `index.html`)

- Visible only in admin mode (`localStorage['omri_admin']==='1'`, the existing flag).
- A **📊 סטטיסטיקה** section/button on the hub. On open, `GET /api/stats` with `X-Session`.
- Renders a Hebrew RTL, dark-theme table sorted by `total` desc:

  | כלי | סה״כ שימושים | השימושים שלי | מבקרים | מגמה |
  |-----|-------------|-------------|--------|------|
  | מחולל קודי QR | 340 | 12 | 328 | ▁▂▅▇▃▁ |

- **Sparkline** = hand-rolled inline SVG from the last ~30 daily buckets (same no-chart-library approach used in Time-tracker). No new dependencies.
- Tool display name resolved from the card's `.tool-title` (the id → Hebrew name map is built from the DOM, so it stays in sync automatically).
- On `401`, reuse the existing Google bounce.

## Error handling

| Failure | Behaviour |
|---|---|
| go-shortener down / network error | Ping `.catch(()=>{})`; page + navigation unaffected. Stats panel shows a small "לא ניתן לטעון סטטיסטיקה" message. |
| Unknown/junk `tool` id | Backend silently ignores (allowlist), returns 204. |
| `localStorage` blocked | try/catch around all storage; tracking degrades to no-debounce or no-op, page fine. |
| Rapid double-click | 5s client debounce per tool suppresses the repeat. |
| Expired session on `/api/stats` | 401 → existing Google re-auth bounce. |

## Testing

- **Backend (go-shortener):** unit tests for `/api/track` (allowlist accept/reject, admin vs visitor attribution via presence of valid token, daily bucket increment, rate-limit) and `/api/stats` (auth required, shape, 90-day window). Follow go-shortener's existing test style.
- **Frontend:** manual/Playwright check that (a) clicking a card fires exactly one `/api/track` with the right `tool`, (b) a second click within 5s does not, (c) the admin panel renders a ranked table + sparkline from a mocked `/api/stats`, (d) a public (non-admin) load never shows the panel and its pings carry no `X-Session`.

## Rollout

1. Backend first (tables + endpoints + tests) on the VPS, deployed and verified with `curl`.
2. Then frontend: add `data-tool` ids, the ping script, and the admin panel; verify against the live backend.
3. Update tools-hub CLAUDE.md: document the analytics feature, the id allowlist, and the "add a tool → add its id in both places" rule.

## Open implementation details (resolved against real code, not blockers)

- Exact go-shortener rate-limiter reuse and retention-trim placement — decided when reading the actual go-shortener source on the VPS.
- Whether the stats panel is always-rendered-hidden vs injected on unlock — minor; pick whatever matches the hub's existing admin-reveal pattern.
